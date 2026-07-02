"""Global single-GPU inference lock — one VLM job at a time across analyzer + passive."""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_lock = threading.Lock()
_meta = threading.Lock()
_waiting = 0
_current_label: str | None = None
_processed = 0
_total_wait_ms = 0
_total_run_ms = 0


def _debug_log(hypothesis_id: str, message: str, data: dict[str, Any]) -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": "8b92e3",
            "hypothesisId": hypothesis_id,
            "location": "gpu_queue.py",
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        log_path = Path(__file__).resolve().parents[3] / ".cursor" / "debug-8b92e3.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


def run_gpu_job(fn: Callable[[], T], *, label: str = "inference") -> T:
    """Block until this job's turn on the sole GPU worker slot."""
    global _waiting, _current_label, _processed, _total_wait_ms, _total_run_ms

    t_enqueue = time.perf_counter()
    with _meta:
        _waiting += 1
        depth = _waiting

    _debug_log("GPU-Q", "job_enqueued", {"label": label, "waiting_depth": depth})

    with _lock:
        wait_ms = round((time.perf_counter() - t_enqueue) * 1000)
        with _meta:
            _waiting -= 1
            _current_label = label
        _debug_log("GPU-Q", "job_started", {"label": label, "wait_ms": wait_ms})

        t0 = time.perf_counter()
        try:
            result = fn()
            run_ms = round((time.perf_counter() - t0) * 1000)
            with _meta:
                _processed += 1
                _total_wait_ms += wait_ms
                _total_run_ms += run_ms
            _debug_log("GPU-Q", "job_done", {"label": label, "wait_ms": wait_ms, "run_ms": run_ms})
            logger.info("GPU job %s done (wait=%sms run=%sms)", label, wait_ms, run_ms)
            return result
        finally:
            with _meta:
                _current_label = None
            _release_gpu_memory()


def status() -> dict[str, Any]:
    with _meta:
        return {
            "gpu_busy": _current_label is not None,
            "current_job": _current_label,
            "waiting_jobs": _waiting,
            "processed_total": _processed,
            "avg_wait_ms": round(_total_wait_ms / max(1, _processed)),
            "avg_run_ms": round(_total_run_ms / max(1, _processed)),
        }


def _release_gpu_memory() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
