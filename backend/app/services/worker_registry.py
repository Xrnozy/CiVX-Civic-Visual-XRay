"""Redis-backed worker heartbeats for pipeline observability."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any

from app.config import settings
from app.services.redis_queue import get_redis

logger = logging.getLogger(__name__)

WORKER_NAMES = ("prefilter", "yolo", "locate", "incident", "review")
_HEARTBEAT_INTERVAL_SEC = 15
_STALE_AFTER_SEC = 45


def _key(name: str) -> str:
    return f"civx:workers:{name}"


def publish_heartbeat(
    name: str,
    *,
    model_loaded: bool | None = None,
    model_name: str | None = None,
    device: str | None = None,
    jobs_processed: int | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    now = int(time.time())
    payload: dict[str, Any] = {
        "name": name,
        "pid": os.getpid(),
        "last_seen": now,
        "host": os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "local",
    }
    existing = read_worker(name)
    if existing:
        payload["started_at"] = existing.get("started_at", now)
        if jobs_processed is None:
            jobs_processed = int(existing.get("jobs_processed", 0))
    else:
        payload["started_at"] = now

    if model_loaded is not None:
        payload["model_loaded"] = model_loaded
    elif existing and "model_loaded" in existing:
        payload["model_loaded"] = existing["model_loaded"]

    if model_name is not None:
        payload["model_name"] = model_name
    elif existing and existing.get("model_name"):
        payload["model_name"] = existing["model_name"]

    if device is not None:
        payload["device"] = device
    elif existing and existing.get("device"):
        payload["device"] = existing["device"]

    payload["jobs_processed"] = int(jobs_processed or 0)
    if extra:
        payload.update(extra)

    try:
        get_redis().set(_key(name), json.dumps(payload), ex=_STALE_AFTER_SEC * 4)
    except Exception as exc:
        logger.warning("Failed to publish heartbeat for %s: %s", name, exc)


def increment_jobs(name: str, count: int = 1) -> None:
    existing = read_worker(name) or {}
    publish_heartbeat(
        name,
        jobs_processed=int(existing.get("jobs_processed", 0)) + count,
    )


def read_worker(name: str) -> dict[str, Any] | None:
    try:
        raw = get_redis().get(_key(name))
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


def read_all_workers() -> dict[str, dict[str, Any]]:
    now = int(time.time())
    out: dict[str, dict[str, Any]] = {}
    for name in WORKER_NAMES:
        row = read_worker(name) or {}
        last_seen = int(row.get("last_seen", 0))
        age = now - last_seen if last_seen else None
        out[name] = {
            **row,
            "alive": bool(last_seen and age is not None and age <= _STALE_AFTER_SEC),
            "last_seen_sec": age,
        }
    return out


def redis_ok() -> tuple[bool, str]:
    try:
        get_redis().ping()
        return True, settings.redis_url
    except Exception as exc:
        return False, str(exc)


class WorkerHeartbeat:
    """Background heartbeat thread for a worker process."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._model_loaded: bool | None = None
        self._model_name: str | None = None
        self._device: str | None = None
        self._jobs_processed = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def set_model(self, *, loaded: bool, name: str | None = None, device: str | None = None) -> None:
        self._model_loaded = loaded
        if name is not None:
            self._model_name = name
        if device is not None:
            self._device = device
        self.touch()

    def increment_jobs(self, count: int = 1) -> None:
        self._jobs_processed += count
        self.touch()

    def touch(self) -> None:
        publish_heartbeat(
            self.name,
            model_loaded=self._model_loaded,
            model_name=self._model_name,
            device=self._device,
            jobs_processed=self._jobs_processed,
        )

    def start(self) -> None:
        self.touch()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"heartbeat-{self.name}")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _run(self) -> None:
        while not self._stop.wait(_HEARTBEAT_INTERVAL_SEC):
            self.touch()
