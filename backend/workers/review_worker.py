"""Review queue worker: marks jobs needing manual review."""

from __future__ import annotations

import logging
import os
import sys

from workers import _bootstrap  # noqa: F401
from workers._common import process_message

from app.services import passive_jobs
from app.services.redis_queue import STREAM_REVIEW, ensure_consumer_groups, read_group

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("review_worker")
CONSUMER = f"review-{os.getpid()}"


def _handle(payload: dict) -> None:
    job_id = payload.get("job_id")
    if job_id:
        passive_jobs.update_clip_job(
            job_id,
            status="needs_review",
            error_message=payload.get("verification_status"),
        )


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
