"""GPU LocateAnything verification worker for medium-confidence YOLO hits."""

from __future__ import annotations

import logging
import os
import sys

from PIL import Image

from workers import _bootstrap  # noqa: F401
from workers._common import process_message

from app.config import settings
from app.models.civic_issues import phrase_for_issue
from app.models.locateanything_worker import LocateAnythingWorker, get_locateanything_worker
from app.services import passive_jobs
from app.services.gpu_queue import run_gpu_job
from app.services.redis_queue import (
    STREAM_CANDIDATES,
    STREAM_LOCATE,
    STREAM_REVIEW,
    ensure_consumer_groups,
    enqueue,
    read_group,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("locate_worker")
CONSUMER = f"locate-{os.getpid()}"


def _verify_frame(frame_path: str, issue_type: str) -> tuple[bool, float, dict]:
    def _run():
        worker = get_locateanything_worker()
        image = Image.open(frame_path).convert("RGB")
        phrase = phrase_for_issue(issue_type)
        kwargs = {
            "generation_mode": settings.locateanything_generation_mode,
            "max_new_tokens": settings.locateanything_max_new_tokens,
            "verbose": False,
        }
        result = worker.ground_single(image, phrase, **kwargs)
        width, height = image.size
        boxes = LocateAnythingWorker.parse_boxes(str(result.get("answer", "")), width, height)
        filtered = LocateAnythingWorker.filter_boxes(
            boxes,
            width,
            height,
            min_area_ratio=settings.locateanything_min_box_area_ratio,
            max_sky_center_ratio=settings.locateanything_max_sky_center_ratio,
            max_boxes=settings.locateanything_max_boxes_per_frame,
        )
        confirmed = len(filtered) > 0
        conf = 0.85 if confirmed else 0.4
        return confirmed, conf, {"answer": result.get("answer"), "boxes": filtered}

    return run_gpu_job(f"locate:{issue_type}", _run)


def _handle(payload: dict) -> None:
    job_id = payload["job_id"]
    passive_jobs.update_clip_job(job_id, status="locate_verifying")
    frame_path = payload["frame_path"]
    issue_type = payload["issue_type"]

    confirmed, conf, raw = _verify_frame(frame_path, issue_type)
    payload = {**payload, "confidence": conf, "raw_ai_result": raw}

    if confirmed:
        enqueue(STREAM_CANDIDATES, {
            **payload,
            "verification_status": "locate_confirmed",
            "source": "locate_anything",
        })
    else:
        enqueue(STREAM_REVIEW, {
            **payload,
            "verification_status": "locate_unsure",
            "source": "locate_anything",
        })


def main() -> None:
    ensure_consumer_groups()
    logger.info("Locate worker started (%s)", CONSUMER)
    while True:
        messages = read_group(STREAM_LOCATE, CONSUMER, count=1, block_ms=5000)
        for msg_id, payload in messages:
            process_message(STREAM_LOCATE, msg_id, payload, _handle)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
