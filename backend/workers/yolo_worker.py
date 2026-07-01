"""GPU YOLO batch worker: yolo_jobs → route to locate/candidates/review."""

from __future__ import annotations

import logging
import os
import sys
from collections import defaultdict
from pathlib import Path

from workers import _bootstrap  # noqa: F401

from app.config import settings
from app.models.civic_issues import PASSIVE_SKIP_INCIDENT_SLUGS
from app.services import passive_jobs
from app.services.confidence_router import route_detection
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
        _detector = YOLODetector(model_path=model_path, confidence=settings.yolo_confidence)
    return _detector


def _route_and_enqueue(det_payload: dict, issue_type: str, confidence: float, frames_with_issue: int) -> None:
    mode = det_payload.get("processing_mode") or current_mode(stream_lengths())
    trust = float(det_payload.get("trust_score") or 1.0)
    action = route_detection(
        issue_type=issue_type,
        confidence=confidence,
        trust_score=trust,
        frames_with_issue=frames_with_issue,
        mode=mode,
    )
    base = {**det_payload, "issue_type": issue_type, "confidence": confidence, "route_action": action}
    if action in ("auto_candidate", "urgent_unverified"):
        enqueue(STREAM_CANDIDATES, {
            **base,
            "verification_status": "yolo_auto" if action == "auto_candidate" else "yolo_urgent",
            "source": "yolo",
        })
    elif action == "locate_verify":
        enqueue(STREAM_LOCATE, {**base, "verification_status": "pending_locate", "source": "yolo"})
    elif action == "review":
        enqueue(STREAM_REVIEW, {**base, "verification_status": "needs_review", "source": "yolo"})


def _process_batch(batch: list[tuple[str, dict]]) -> None:
    paths = [p["frame_path"] for _, p in batch]
    results = _get_detector().detect_batch(paths)

    by_job_issue: dict[tuple[str, str], list[tuple[dict, object]]] = defaultdict(list)
    for (_, payload), det in zip(batch, results):
        if det is None or det.issue_type in PASSIVE_SKIP_INCIDENT_SLUGS:
            continue
        payload = {
            **payload,
            "bounding_box": det.bounding_box,
            "severity_score": det.severity_score,
            "raw_class": det.raw_class,
            "frame_timestamp": payload.get("frame_timestamp"),
        }
        by_job_issue[(payload["job_id"], det.issue_type)].append((payload, det))

    for (_job_id, issue_type), items in by_job_issue.items():
        best = max(items, key=lambda x: x[1].confidence)
        payload, det = best
        _route_and_enqueue(payload, issue_type, det.confidence, len(items))


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
            _process_batch(pending)
            for msg_id, _ in pending:
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
