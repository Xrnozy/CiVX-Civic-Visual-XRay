"""Remove temporary clip/frame files after pipeline stages per spec."""

from __future__ import annotations

import logging
from pathlib import Path

from app.services import pipeline_storage

logger = logging.getLogger(__name__)

TERMINAL_JOB_STATUSES = frozenset({
    "discarded",
    "report_created",
    "needs_review",
    "failed",
})


def delete_frame_file(frame_path: str | None) -> bool:
    if not frame_path:
        return False
    path = Path(frame_path)
    if not path.is_file():
        return False
    try:
        path.unlink()
        logger.debug("Deleted frame %s", path)
        return True
    except OSError as exc:
        logger.warning("Could not delete frame %s: %s", path, exc)
        return False


def cleanup_job_temp_files(job_id: str) -> dict[str, int]:
    """Delete intermediate clip + extracted frames; keep evidence copies."""
    deleted_frames = 0
    frames_dir = pipeline_storage.frames_dir()
    if frames_dir.is_dir():
        for path in frames_dir.glob(f"{job_id}_*.jpg"):
            try:
                path.unlink()
                deleted_frames += 1
            except OSError:
                pass

    clip_deleted = 0
    clip = pipeline_storage.clip_path(job_id)
    if clip.is_file():
        try:
            clip.unlink()
            clip_deleted = 1
        except OSError:
            pass

    if deleted_frames or clip_deleted:
        logger.info(
            "Cleaned temp storage for job %s: %d frames, %d clip",
            job_id,
            deleted_frames,
            clip_deleted,
        )
    return {"frames": deleted_frames, "clips": clip_deleted}


def cleanup_after_terminal_status(job_id: str, status: str) -> None:
    if status in TERMINAL_JOB_STATUSES:
        cleanup_job_temp_files(job_id)


def cleanup_orphan_frames(max_age_hours: int = 24) -> dict[str, int]:
    """Recovery script helper — delete frame/clip files older than max_age_hours."""
    import time

    now = time.time()
    cutoff = now - max_age_hours * 3600
    deleted_frames = 0
    deleted_clips = 0
    root = pipeline_storage.frames_dir().parent
    for sub in ("frames", "clips"):
        directory = root / sub
        if not directory.is_dir():
            continue
        for path in directory.iterdir():
            if not path.is_file():
                continue
            if path.stat().st_mtime < cutoff:
                try:
                    path.unlink()
                    if sub == "frames":
                        deleted_frames += 1
                    else:
                        deleted_clips += 1
                except OSError:
                    pass

    return {"frames": deleted_frames, "clips": deleted_clips}
