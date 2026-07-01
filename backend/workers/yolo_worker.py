"""GPU YOLO batch worker: yolo_jobs → route to locate/candidates/review."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from workers import _bootstrap  # noqa: F401

from app.config import settings
from app.models.civic_issues import PASSIVE_SKIP_INCIDENT_SLUGS
from app.services import passive_jobs
from app.services.confidence_router import route_detection, verification_status_for_action
from app.services.evidence_trust import frame_perceptual_hash
from app.services.queue_mode import current_mode, yolo_batch_for_mode
from app.services.redis_queue import (
    STREAM_CANDIDATES,
    STREAM_LOCATE,
    STREAM_REVIEW,
    STREAM_YOLO,
    ack,
    ensure_consumer_groups,
    enqueue,
    read_group,
    requeue_with_retry,
    stream_lengths,
)
from detector import YOLODetector

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("yolo_worker")
CONSUMER = f"yolo-{os.getpid()}"

_detector: YOLODetector | None = None


def _get_detector() -> YOLODetector:
    global _detector
    if _detector is None:
        model_path = settings.yolo_model
        if not Path(model_path).is_absolute():
            backend_root = Path(__file__).resolve().parents[1]
            candidate = backend_root / model_path
            if candidate.is_file():
                model_path = str(candidate)
        _detector = YOLODetector(
            model_path=model_path,
            confidence=settings.yolo_confidence_medium,
        )
    return _detector


def _route_and_enqueue(det_payload: dict, issue_type: str, confidence: float, frames_with_issue: int) -> None:
    job_id = det_payload["job_id"]
    mode = det_payload.get("processing_mode") or current_mode(stream_lengths())
    trust = float(det_payload.get("trust_score") or 1.0)
    action = route_detection(
        issue_type=issue_type,
        confidence=confidence,
        trust_score=trust,
        frames_with_issue=frames_with_issue,
        mode=mode,
    )
    verification = verification_status_for_action(action)
    base = {
        **det_payload,
        "issue_type": issue_type,
        "confidence": confidence,
        "route_action": action,
        "verification_status": verification,
    }
    if action in ("auto_candidate", "urgent_unverified"):
        enqueue(STREAM_CANDIDATES, {**base, "source": "yolo"})
    elif action == "locate_verify":
        enqueue(STREAM_LOCATE, {**base, "source": "yolo"})
    elif action == "review":
        enqueue(STREAM_REVIEW, {**base, "source": "yolo"})
    elif action == "discard":
        logger.info("Discarded job=%s issue=%s conf=%.2f frames=%d", job_id, issue_type, confidence, frames_with_issue)


def _flush_job_routing(job_id: str) -> None:
    hits = passive_jobs.get_yolo_hits(job_id)
    if not hits:
        passive_jobs.update_clip_job(job_id, status="discarded", error_message="No YOLO detections")
        passive_jobs.clear_yolo_hits(job_id)
        return

    job = passive_jobs.get_clip_job(job_id) or {}
    for issue_type, entry in hits.items():
        if issue_type in PASSIVE_SKIP_INCIDENT_SLUGS:
            continue
        count = int(entry.get("count", 0))
        best = entry.get("best") or {}
        confidence = float(entry.get("best_confidence", 0))
        if not best:
            continue

        flags: list[str] = []
        if count < 2:
            flags.append("single_frame_only")
            passive_jobs.append_suspicion_flags(job_id, flags)

        frame_path = best.get("frame_path")
        if frame_path and os.path.isfile(frame_path):
            try:
                phash = frame_perceptual_hash(frame_path)
                if passive_jobs.perceptual_hash_exists(phash, exclude_job_id=job_id):
                    flags.append("perceptual_duplicate")
                    passive_jobs.append_suspicion_flags(job_id, ["perceptual_duplicate"])
            except Exception:
                phash = None

        det_payload = {**best, "trust_score": float(best.get("trust_score") or job.get("trust_score") or 1.0)}
        _route_and_enqueue(det_payload, issue_type, confidence, count)

    passive_jobs.clear_yolo_hits(job_id)


def _process_frame_batch(batch: list[tuple[str, dict]]) -> None:
    frame_items = [(mid, p) for mid, p in batch if p.get("type") != "clip_complete"]
    if not frame_items:
        return

    paths = [p["frame_path"] for _, p in frame_items]
    results = _get_detector().detect_batch(paths)

    for (_, payload), det in zip(frame_items, results):
        if det is None or det.issue_type in PASSIVE_SKIP_INCIDENT_SLUGS:
            continue
        frame_payload = {
            **payload,
            "bounding_box": det.bounding_box,
            "severity_score": det.severity_score,
            "raw_class": det.raw_class,
            "issue_type": det.issue_type,
            "confidence": det.confidence,
            "frame_timestamp": payload.get("frame_timestamp"),
        }
        passive_jobs.record_yolo_hit(
            payload["job_id"],
            det.issue_type,
            frame_payload,
            det.confidence,
        )


def main() -> None:
    ensure_consumer_groups()
    logger.info("YOLO worker started (%s)", CONSUMER)
    pending: list[tuple[str, dict]] = []

    while True:
        mode = current_mode(stream_lengths())
        batch_size = yolo_batch_for_mode(mode)
        need = max(1, batch_size - len(pending))
        messages = read_group(STREAM_YOLO, CONSUMER, count=need, block_ms=3000)

        for msg_id, payload in messages:
            pending.append((msg_id, payload))

        should_flush = len(pending) >= batch_size or (not messages and pending)
        if not should_flush:
            continue

        try:
            completes = [(mid, p) for mid, p in pending if p.get("type") == "clip_complete"]
            frames = [(mid, p) for mid, p in pending if p.get("type") != "clip_complete"]

            if frames:
                _process_frame_batch(frames)
                for msg_id, _ in frames:
                    ack(STREAM_YOLO, msg_id)

            for msg_id, payload in completes:
                _flush_job_routing(payload["job_id"])
                ack(STREAM_YOLO, msg_id)

        except Exception as exc:
            logger.exception("YOLO batch failed")
            for msg_id, payload in pending:
                job_id = payload.get("job_id")
                if job_id and requeue_with_retry(STREAM_YOLO, payload, str(exc)) is None:
                    passive_jobs.update_clip_job(job_id, status="failed", error_message=str(exc)[:500])
                ack(STREAM_YOLO, msg_id)
        pending = []


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
