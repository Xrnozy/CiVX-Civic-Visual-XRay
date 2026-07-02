"""Aggregate Redis queue + worker heartbeat status for ops dashboards."""

from __future__ import annotations

from app.config import settings
from app.services.queue_mode import queue_status_payload
from app.services.redis_queue import stream_lengths
from app.services.worker_registry import read_all_workers, redis_ok


def build_pipeline_status() -> dict:
    redis_connected, redis_detail = redis_ok()
    workers = read_all_workers()
    all_alive = all(workers[name].get("alive") for name in workers)
    yolo = workers.get("yolo", {})
    locate = workers.get("locate", {})
    return {
        "redis": {"ok": redis_connected, "url": settings.redis_url if redis_connected else redis_detail},
        "queues": queue_status_payload(stream_lengths()),
        "workers": workers,
        "models": {
            "yolo": {
                "running": yolo.get("alive", False),
                "loaded": yolo.get("model_loaded", False),
                "model": yolo.get("model_name") or settings.yolo_model,
                "device": yolo.get("device"),
            },
            "locateanything": {
                "running": locate.get("alive", False),
                "loaded": locate.get("model_loaded", False),
                "model": locate.get("model_name") or settings.locateanything_model,
                "device": locate.get("device"),
            },
        },
        "healthy": redis_connected and all_alive,
    }
