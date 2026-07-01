"""Dynamic queue processing modes."""

from __future__ import annotations

from typing import Literal

from app.config import settings

QueueMode = Literal["normal", "busy", "overloaded"]


def current_mode(lengths: dict[str, int]) -> QueueMode:
    yolo = lengths.get("yolo_jobs", 0)
    locate = lengths.get("locate_jobs", 0)
    if yolo >= settings.queue_yolo_overloaded or locate >= settings.queue_locate_overloaded:
        return "overloaded"
    if yolo >= settings.queue_yolo_busy or locate >= settings.queue_locate_busy:
        return "busy"
    return "normal"


def sample_fps_for_mode(mode: QueueMode) -> float:
    if mode == "overloaded":
        return settings.queue_sample_fps_overloaded
    if mode == "busy":
        return settings.queue_sample_fps_busy
    return settings.queue_sample_fps_normal


def yolo_batch_for_mode(mode: QueueMode) -> int:
    return settings.yolo_batch_busy if mode in ("busy", "overloaded") else settings.yolo_batch_normal


def queue_status_payload(lengths: dict[str, int]) -> dict:
    mode = current_mode(lengths)
    return {
        **lengths,
        "mode": mode,
        "sample_fps": sample_fps_for_mode(mode),
        "yolo_batch_size": yolo_batch_for_mode(mode),
    }
