"""Shared worker utilities."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.services import passive_jobs
from app.services.redis_queue import ack, requeue_with_retry

logger = logging.getLogger(__name__)


def process_message(
    stream: str,
    msg_id: str,
    payload: dict[str, Any],
    handler: Callable[[dict[str, Any]], None],
) -> None:
    job_id = payload.get("job_id")
    try:
        handler(payload)
        ack(stream, msg_id)
    except Exception as exc:
        logger.exception("Worker failed on %s job=%s", stream, job_id)
        if requeue_with_retry(stream, payload, str(exc)) is None and job_id:
            passive_jobs.update_clip_job(job_id, status="failed", error_message=str(exc)[:500])
        ack(stream, msg_id)


def match_gps(trace: list, timestamp: float, fallback_lat: float | None, fallback_lng: float | None) -> tuple[float, float]:
    if not trace:
        return fallback_lat or 14.55, fallback_lng or 121.03
    best = trace[0]
    best_diff = abs(trace[0].get("t", 0) - timestamp)
    for pt in trace:
        diff = abs(pt.get("t", 0) - timestamp)
        if diff < best_diff:
            best_diff = diff
            best = pt
    return best.get("lat", fallback_lat or 14.55), best.get("lng", fallback_lng or 121.03)
