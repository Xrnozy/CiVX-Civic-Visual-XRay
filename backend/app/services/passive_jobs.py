"""Database helpers for passive_clip_jobs and related tables."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db import get_supabase


def create_capture_session(
    *,
    device_id: str | None,
    user_id: str | None,
    nonce_hash: str,
    expires_at: datetime,
) -> dict[str, Any]:
    session_id = str(uuid4())
    sb = get_supabase()
    row = sb.table("passive_capture_sessions").insert({
        "session_id": session_id,
        "nonce_hash": nonce_hash,
        "device_id": device_id,
        "user_id": user_id,
        "expires_at": expires_at.isoformat(),
    }).execute().data[0]
    return {**row, "session_id": session_id}


def get_capture_session(session_id: str) -> dict[str, Any] | None:
    sb = get_supabase()
    return (
        sb.table("passive_capture_sessions")
        .select("*")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
        .data
    )


def create_clip_job(data: dict[str, Any]) -> dict[str, Any]:
    sb = get_supabase()
    job_id = data.get("job_id") or str(uuid4())
    payload = {
        "job_id": job_id,
        "status": data.get("status", "queued"),
        "video_path": data["video_path"],
        "sha256": data.get("sha256"),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "gps_accuracy": data.get("gps_accuracy"),
        "device_id": data.get("device_id"),
        "user_id": data.get("user_id"),
        "session_id": data.get("session_id"),
        "route_session_id": data.get("route_session_id"),
        "video_chunk_id": data.get("video_chunk_id"),
        "capture_mode": data.get("capture_mode", "passive_camera"),
        "client_timestamp": data.get("client_timestamp"),
        "trust_score": data.get("trust_score", 1.0),
        "suspicion_flags": data.get("suspicion_flags", []),
        "processing_mode": data.get("processing_mode", "normal"),
        "gps_trace_json": data.get("gps_trace_json", []),
    }
    row = sb.table("passive_clip_jobs").insert(payload).execute().data[0]
    return row


def get_clip_job(job_id: str) -> dict[str, Any] | None:
    sb = get_supabase()
    return (
        sb.table("passive_clip_jobs")
        .select("*")
        .eq("job_id", job_id)
        .maybe_single()
        .execute()
        .data
    )


def update_clip_job(job_id: str, **fields: Any) -> None:
    sb = get_supabase()
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("passive_clip_jobs").update(fields).eq("job_id", job_id).execute()


def register_file_hash(sha256: str, job_id: str) -> bool:
    """Returns True if hash is new, False if duplicate replay."""
    sb = get_supabase()
    existing = (
        sb.table("passive_file_hashes")
        .select("sha256")
        .eq("sha256", sha256)
        .maybe_single()
        .execute()
        .data
    )
    if existing:
        return False
    sb.table("passive_file_hashes").insert({"sha256": sha256, "job_id": job_id}).execute()
    return True


def hash_exists(sha256: str) -> bool:
    sb = get_supabase()
    row = (
        sb.table("passive_file_hashes")
        .select("sha256")
        .eq("sha256", sha256)
        .maybe_single()
        .execute()
        .data
    )
    return row is not None


def insert_evidence(data: dict[str, Any]) -> dict[str, Any]:
    sb = get_supabase()
    return sb.table("passive_evidence").insert(data).execute().data[0]


def get_last_device_position(device_id: str) -> tuple[float, float] | None:
    if not device_id:
        return None
    sb = get_supabase()
    row = (
        sb.table("passive_clip_jobs")
        .select("lat,lng,created_at")
        .eq("device_id", device_id)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
        .data
    )
    if not row or row.get("lat") is None:
        return None
    return float(row["lat"]), float(row["lng"])
