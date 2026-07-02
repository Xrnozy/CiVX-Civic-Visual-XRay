"""GPU YOLO batch worker: yolo_jobs → route to locate/candidates/review."""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np

from workers import _bootstrap  # noqa: F401

from app.config import settings
from app.models.civic_issues import PASSIVE_SKIP_INCIDENT_SLUGS
from app.services import passive_jobs, pipeline_cleanup
from app.services.confidence_router import route_detection, verification_status_for_action
from app.services.evidence_trust import frame_perceptual_hash
from app.services.gpu_lock import gpu_lock
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
from app.services.worker_registry import WorkerHeartbeat
from app.utils.pipeline_debug import pipeline_debug_log
from detector import YOLODetector

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("yolo_worker")
CONSUMER = f"yolo-{os.getpid()}"

_detector: YOLODetector | None = None
_device_label: str = "cpu"


def _resolve_device_label() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return str(torch.cuda.get_device_name(0))
    except Exception:
        pass
    return "cpu"


def _get_detector() -> YOLODetector:
    global _detector, _device_label
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
        _device_label = _resolve_device_label()
    return _detector


def _warmup_detector(hb: WorkerHeartbeat) -> None:
    detector = _get_detector()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        blank = np.zeros((640, 640, 3), dtype=np.uint8)
        cv2.imwrite(tmp.name, blank)
        path = tmp.name
    try:
        with gpu_lock("yolo:warmup"):
            detector.detect_batch([path])
    finally:
        Path(path).unlink(missing_ok=True)
    hb.set_model(loaded=True, name=settings.yolo_model, device=_device_label)
    logger.info("YOLO ready — model=%s device=%s", settings.yolo_model, _device_label)


def _route_and_enqueue(
    det_payload: dict,
    issue_type: str,
    confidence: float,
    frames_with_issue: int,
    high_conf_frames: int = 0,
) -> None:
    job_id = det_payload["job_id"]
    mode = det_payload.get("processing_mode") or current_mode(stream_lengths())
    trust = float(det_payload.get("trust_score") or 1.0)
    action = route_detection(
        issue_type=issue_type,
        confidence=confidence,
        trust_score=trust,
        frames_with_issue=frames_with_issue,
        high_conf_frames=high_conf_frames,
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
        pipeline_cleanup.delete_frame_file(det_payload.get("frame_path"))
        logger.info("Discarded job=%s issue=%s conf=%.2f frames=%d", job_id, issue_type, confidence, frames_with_issue)

    pipeline_debug_log(
        "yolo_worker.py:_route_and_enqueue",
        "routing decision",
        {
            "job_id": job_id,
            "issue_type": issue_type,
            "confidence": confidence,
            "frames_with_issue": frames_with_issue,
            "high_conf_frames": high_conf_frames,
            "trust_score": trust,
            "mode": mode,
            "action": action,
            "verification": verification,
        },
        "H-B" if frames_with_issue < 2 else "H-E",
    )


def _flush_job_routing(job_id: str) -> None:
    hits = passive_jobs.get_yolo_hits(job_id)
    if not hits:
        passive_jobs.update_clip_job(job_id, status="discarded", error_message="No YOLO detections")
        passive_jobs.clear_yolo_hits(job_id)
        pipeline_cleanup.cleanup_after_terminal_status(job_id, "discarded")
        return

    job = passive_jobs.get_clip_job(job_id) or {}
    for issue_type, entry in hits.items():
        if issue_type in PASSIVE_SKIP_INCIDENT_SLUGS:
            continue
        count = int(entry.get("count", 0))
        high_conf_count = int(entry.get("high_conf_count", 0))
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
                pass

        det_payload = {**best, "trust_score": float(best.get("trust_score") or job.get("trust_score") or 1.0)}
        _route_and_enqueue(det_payload, issue_type, confidence, count, high_conf_count)

    passive_jobs.clear_yolo_hits(job_id)


def _process_frame_batch(batch: list[tuple[str, dict]]) -> None:
    frame_items = [(mid, p) for mid, p in batch if p.get("type") != "clip_complete"]
    if not frame_items:
        return

    paths = [p["frame_path"] for _, p in frame_items]
    t0 = time.monotonic()
    with gpu_lock("yolo:batch"):
        results = _get_detector().detect_batch(paths)
    pipeline_debug_log(
        "yolo_worker.py:_process_frame_batch",
        "yolo batch inferred",
        {
            "batch_size": len(paths),
            "device": _device_label,
            "elapsed_ms": int((time.monotonic() - t0) * 1000),
            "job_ids": list({p["job_id"] for _, p in frame_items}),
        },
        "H-D",
    )

    for (_, payload), det in zip(frame_items, results):
        if det is None or det.issue_type in PASSIVE_SKIP_INCIDENT_SLUGS:
            pipeline_cleanup.delete_frame_file(payload.get("frame_path"))
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
    hb = WorkerHeartbeat("yolo")
    hb.start()
    try:
        _warmup_detector(hb)
    except Exception as exc:
        logger.warning("YOLO warmup failed (will retry on first batch): %s", exc)
        hb.set_model(loaded=False, name=settings.yolo_model)

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

        if messages:
            pipeline_debug_log(
                "yolo_worker.py:main",
                "yolo batch flush",
                {
                    "pending": len(pending),
                    "batch_size": batch_size,
                    "mode": mode,
                    "new_messages": len(messages),
                },
                "H-D",
            )

        try:
            completes = [(mid, p) for mid, p in pending if p.get("type") == "clip_complete"]
            frames = [(mid, p) for mid, p in pending if p.get("type") != "clip_complete"]

            if frames:
                _process_frame_batch(frames)
                for msg_id, _ in frames:
                    ack(STREAM_YOLO, msg_id)
                hb.increment_jobs(len(frames))

            for msg_id, payload in completes:
                _flush_job_routing(payload["job_id"])
                ack(STREAM_YOLO, msg_id)
                hb.increment_jobs()

        except Exception as exc:
            logger.exception("YOLO batch failed")
            for msg_id, payload in pending:
                job_id = payload.get("job_id")
                if job_id and requeue_with_retry(STREAM_YOLO, payload, str(exc)) is None:
                    passive_jobs.update_clip_job(job_id, status="failed", error_message=str(exc)[:500])
                    pipeline_cleanup.cleanup_after_terminal_status(job_id, "failed")
                ack(STREAM_YOLO, msg_id)
        pending = []


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
