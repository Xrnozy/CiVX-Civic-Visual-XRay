"""CPU prefilter: clip_jobs → frame extraction → yolo_jobs."""

from __future__ import annotations

import logging
import os
import sys

import cv2

from workers import _bootstrap  # noqa: F401
from workers._common import process_message

from app.config import settings
from app.services import passive_jobs, pipeline_storage
from app.services.evidence_trust import frame_perceptual_hash, is_perceptual_duplicate
from app.services.queue_mode import current_mode, sample_fps_for_mode
from app.services.redis_queue import (
    STREAM_CLIP,
    STREAM_YOLO,
    ensure_consumer_groups,
    enqueue,
    read_group,
    stream_lengths,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("prefilter_worker")
CONSUMER = f"prefilter-{os.getpid()}"


def _blur_score(frame) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _handle(payload: dict) -> None:
    job_id = payload["job_id"]
    video_path = payload["video_path"]
    passive_jobs.update_clip_job(job_id, status="prefiltering")

    job = passive_jobs.get_clip_job(job_id) or payload
    mode = job.get("processing_mode") or current_mode(stream_lengths())
    fps = sample_fps_for_mode(mode)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    interval = max(1, int(video_fps / fps))
    frame_num = 0
    frame_index = 0
    last_hash: str | None = None
    yolo_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_num % interval != 0:
            frame_num += 1
            continue

        if _blur_score(frame) < settings.blur_laplacian_min:
            frame_num += 1
            continue

        out_path = pipeline_storage.frame_path(job_id, frame_index)
        cv2.imwrite(str(out_path), frame)
        phash = frame_perceptual_hash(str(out_path))
        if last_hash and is_perceptual_duplicate(last_hash, phash):
            out_path.unlink(missing_ok=True)
            frame_num += 1
            continue
        last_hash = phash

        ts = frame_num / video_fps
        enqueue(STREAM_YOLO, {
            "job_id": job_id,
            "frame_path": str(out_path),
            "frame_index": frame_index,
            "frame_timestamp": ts,
            "lat": job.get("lat"),
            "lng": job.get("lng"),
            "trust_score": float(job.get("trust_score") or 1.0),
            "capture_mode": job.get("capture_mode", "passive_camera"),
            "processing_mode": mode,
            "gps_trace_json": job.get("gps_trace_json") or [],
            "yolo_confidence": settings.yolo_confidence,
        })
        yolo_count += 1
        frame_index += 1
        frame_num += 1

    cap.release()
    if yolo_count == 0:
        passive_jobs.update_clip_job(job_id, status="discarded", error_message="No usable frames")
    else:
        passive_jobs.update_clip_job(job_id, status="yolo_processing")


def main() -> None:
    ensure_consumer_groups()
    logger.info("Prefilter worker started (%s)", CONSUMER)
    while True:
        messages = read_group(STREAM_CLIP, CONSUMER, count=1, block_ms=5000)
        for msg_id, payload in messages:
            process_message(STREAM_CLIP, msg_id, payload, _handle)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
