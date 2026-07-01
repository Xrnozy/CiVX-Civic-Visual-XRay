"""Local clip/frame storage for passive pipeline."""

from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path

from app.config import settings


def _root() -> Path:
    root = settings.pipeline_storage_path
    for sub in ("clips", "frames", "evidence"):
        (root / sub).mkdir(parents=True, exist_ok=True)
    return root


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_clip(content: bytes, job_id: str | None = None) -> tuple[str, str]:
    jid = job_id or str(uuid.uuid4())
    path = _root() / "clips" / f"{jid}.mp4"
    path.write_bytes(content)
    return str(path), sha256_bytes(content)


def clip_path(job_id: str) -> Path:
    return _root() / "clips" / f"{job_id}.mp4"


def frame_path(job_id: str, frame_index: int) -> Path:
    return _root() / "frames" / f"{job_id}_{frame_index:04d}.jpg"


def evidence_path(job_id: str, frame_index: int) -> Path:
    return _root() / "evidence" / f"{job_id}_{frame_index:04d}.jpg"


def copy_to_evidence(src: Path, job_id: str, frame_index: int) -> str:
    dest = evidence_path(job_id, frame_index)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return str(dest)


def upload_evidence_to_supabase(local_path: str, object_key: str) -> str | None:
    if not settings.pipeline_upload_evidence_to_supabase or not settings.supabase_configured:
        return None
    try:
        from app.db import get_supabase

        with open(local_path, "rb") as f:
            data = f.read()
        sb = get_supabase()
        bucket = "report-photos"
        sb.storage.from_(bucket).upload(object_key, data, {"content-type": "image/jpeg", "upsert": "true"})
        return sb.storage.from_(bucket).get_public_url(object_key)
    except Exception:
        return None
