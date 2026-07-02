"""Distributed GPU lock via Redis — serializes YOLO and Locate across worker processes."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import contextmanager
from typing import Generator

from app.config import settings
from app.services.redis_queue import get_redis
from app.utils.pipeline_debug import pipeline_debug_log

logger = logging.getLogger(__name__)

_LOCK_KEY = "civx:gpu:lock"


def _acquire_lock(token: str, ttl: int) -> bool:
    return bool(get_redis().set(_LOCK_KEY, token, nx=True, ex=ttl))


def _release_lock(token: str) -> None:
    r = get_redis()
    current = r.get(_LOCK_KEY)
    if current == token:
        r.delete(_LOCK_KEY)


@contextmanager
def gpu_lock(label: str = "inference") -> Generator[None, None, None]:
    """Block until this process holds the sole GPU slot (when enabled)."""
    if not settings.gpu_lock_enabled:
        yield
        return

    token = f"{label}:{uuid.uuid4().hex[:12]}"
    ttl = settings.gpu_lock_ttl_seconds
    deadline = time.monotonic() + settings.gpu_lock_wait_seconds
    acquired = False
    wait_start = time.monotonic()

    while not acquired:
        acquired = _acquire_lock(token, ttl)
        if acquired:
            break
        if time.monotonic() >= deadline:
            raise TimeoutError(f"GPU lock timeout after {settings.gpu_lock_wait_seconds}s ({label})")
        time.sleep(0.25)

    wait_ms = int((time.monotonic() - wait_start) * 1000)
    if wait_ms > 50:
        pipeline_debug_log(
            "gpu_lock.py:gpu_lock",
            "gpu lock wait",
            {"label": label, "wait_ms": wait_ms},
            "H-F",
        )

    logger.debug("GPU lock acquired: %s", label)
    try:
        yield
    finally:
        _release_lock(token)
        logger.debug("GPU lock released: %s", label)
