"""Review queue worker: persists evidence for manual review."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from workers import _bootstrap  # noqa: F401
from workers._common import match_gps, process_message

from app.services import passive_jobs, pipeline_storage
from app.services.evidence_trust import frame_perceptual_hash
from app.services.redis_queue import STREAM_REVIEW, ensure_consumer_groups, read_group

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("review_worker")
CONSUMER = f"review-{os.getpid()}"


def _handle(payload: dict) -> None:
    job_id = payload.get("job_id")
    if not job_id:
        return

    job = passive_jobs.get_clip_job(job_id) or {}
    passive_jobs.update_clip_job(
        job_id,
        status="needs_review",
        error_message=payload.get("verification_status") or payload.get("review_reason"),
    )

    frame_path = payload.get("frame_path")
    evidence_local = frame_path
    evidence_url = None
    phash = None
    if frame_path and os.path.isfile(frame_path):
        frame_index = int(payload.get("frame_index") or 0)
        evidence_local = pipeline_storage.copy_to_evidence(Path(frame_path), job_id, frame_index)
        phash = frame_perceptual_hash(evidence_local)
        evidence_url = pipeline_storage.upload_evidence_to_supabase(
            evidence_local,
            f"passive/review_{job_id}_{frame_index}.jpg",
        )

    trace = payload.get("gps_trace_json") or job.get("gps_trace_json") or []
    ts = float(payload.get("frame_timestamp") or 0)
    lat, lng = match_gps(trace, ts, job.get("lat"), job.get("lng"))

    passive_jobs.insert_evidence(passive_jobs.build_evidence_row(
        job,
        payload,
        frame_path=evidence_local,
        evidence_url=evidence_url,
        perceptual_hash=phash,
        lat=lat,
        lng=lng,
        verification_status="needs_review",
    ))


def main() -> None:
    ensure_consumer_groups()
    logger.info("Review worker started (%s)", CONSUMER)
    while True:
        messages = read_group(STREAM_REVIEW, CONSUMER, count=5, block_ms=5000)
        for msg_id, payload in messages:
            process_message(STREAM_REVIEW, msg_id, payload, _handle)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
