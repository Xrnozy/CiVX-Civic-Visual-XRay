"""Redis Streams queue for passive incident pipeline."""

from __future__ import annotations

import json
import logging
from typing import Any

import redis

from app.config import settings

logger = logging.getLogger(__name__)

STREAM_CLIP = "clip_jobs"
STREAM_YOLO = "yolo_jobs"
STREAM_LOCATE = "locate_jobs"
STREAM_CANDIDATES = "incident_candidates"
STREAM_REVIEW = "review_jobs"
STREAM_FAILED = "failed_jobs"

ALL_STREAMS = (
    STREAM_CLIP,
    STREAM_YOLO,
    STREAM_LOCATE,
    STREAM_CANDIDATES,
    STREAM_REVIEW,
    STREAM_FAILED,
)

CONSUMER_GROUP = "civx_workers"

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def ensure_consumer_groups() -> None:
    r = get_redis()
    for stream in ALL_STREAMS:
        try:
            r.xgroup_create(stream, CONSUMER_GROUP, id="0", mkstream=True)
            logger.info("Created consumer group %s on %s", CONSUMER_GROUP, stream)
        except redis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise


def _serialize(payload: dict[str, Any]) -> dict[str, str]:
    return {k: json.dumps(v) if not isinstance(v, str) else v for k, v in payload.items()}


def _deserialize(fields: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in fields.items():
        try:
            out[k] = json.loads(v)
        except (json.JSONDecodeError, TypeError):
            out[k] = v
    return out


def enqueue(stream: str, payload: dict[str, Any]) -> str:
    msg_id = get_redis().xadd(stream, _serialize(payload))
    return str(msg_id)


def read_group(
    stream: str,
    consumer: str,
    *,
    count: int = 1,
    block_ms: int = 5000,
) -> list[tuple[str, dict[str, Any]]]:
    r = get_redis()
    entries = r.xreadgroup(CONSUMER_GROUP, consumer, {stream: ">"}, count=count, block=block_ms)
    results: list[tuple[str, dict[str, Any]]] = []
    for _stream_name, messages in entries:
        for msg_id, fields in messages:
            results.append((msg_id, _deserialize(fields)))
    return results


def ack(stream: str, message_id: str) -> None:
    get_redis().xack(stream, CONSUMER_GROUP, message_id)


def stream_lengths() -> dict[str, int]:
    r = get_redis()
    lengths: dict[str, int] = {}
    for stream in ALL_STREAMS:
        try:
            lengths[stream] = int(r.xlen(stream))
        except Exception:
            lengths[stream] = 0
    return lengths


def move_to_failed(
    original_stream: str,
    payload: dict[str, Any],
    error: str,
    retry_count: int,
) -> str:
    payload = {
        **payload,
        "original_stream": original_stream,
        "error": error,
        "retry_count": retry_count,
    }
    return enqueue(STREAM_FAILED, payload)


def requeue_with_retry(stream: str, payload: dict[str, Any], error: str) -> str | None:
    retry_count = int(payload.get("retry_count", 0)) + 1
    if retry_count > settings.pipeline_max_job_retries:
        move_to_failed(stream, payload, error, retry_count)
        return None
    payload["retry_count"] = retry_count
    return enqueue(stream, payload)
