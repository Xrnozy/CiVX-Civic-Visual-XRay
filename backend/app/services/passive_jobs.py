"""Database helpers for passive_clip_jobs and related tables."""

from __future__ import annotations

import copy
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
        "yolo_hits_json": data.get("yolo_hits_json", {}),
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


def append_suspicion_flags(job_id: str, flags: list[str]) -> list[str]:
    job = get_clip_job(job_id) or {}
    existing = list(job.get("suspicion_flags") or [])
    for f in flags:
        if f and f not in existing:
            existing.append(f)
    update_clip_job(job_id, suspicion_flags=existing)
    return existing


def record_yolo_hit(job_id: str, issue_type: str, frame_payload: dict[str, Any], confidence: float) -> None:
    job = get_clip_job(job_id) or {}
    hits: dict[str, Any] = dict(job.get("yolo_hits_json") or {})
    entry = hits.get(issue_type) or {"count": 0, "best": None, "best_confidence": 0.0}
    entry["count"] = int(entry.get("count", 0)) + 1
    if confidence >= float(entry.get("best_confidence", 0)):
        entry["best_confidence"] = confidence
        entry["best"] = copy.deepcopy(frame_payload)
    hits[issue_type] = entry
    update_clip_job(job_id, yolo_hits_json=hits)


def get_yolo_hits(job_id: str) -> dict[str, Any]:
    job = get_clip_job(job_id) or {}
    return dict(job.get("yolo_hits_json") or {})


def clear_yolo_hits(job_id: str) -> None:
    update_clip_job(job_id, yolo_hits_json={})


def perceptual_hash_exists(phash: str, exclude_job_id: str | None = None) -> bool:
    if not phash:
        return False
    sb = get_supabase()
    q = sb.table("passive_evidence").select("id").eq("perceptual_hash", phash)
    if exclude_job_id:
        q = q.neq("job_id", exclude_job_id)
    row = q.limit(1).maybe_single().execute().data
    return row is not None


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


def build_evidence_row(job: dict[str, Any], payload: dict[str, Any], **extra: Any) -> dict[str, Any]:
    capture_mode = payload.get("capture_mode") or job.get("capture_mode", "passive_camera")
    flags = list(job.get("suspicion_flags") or [])
    for f in payload.get("suspicion_flags") or []:
        if f not in flags:
            flags.append(f)
    row = {
        "job_id": payload.get("job_id") or job.get("job_id"),
        "frame_path": extra.get("frame_path") or payload.get("frame_path"),
        "evidence_url": extra.get("evidence_url"),
        "perceptual_hash": extra.get("perceptual_hash"),
        "lat": extra.get("lat", payload.get("lat", job.get("lat"))),
        "lng": extra.get("lng", payload.get("lng", job.get("lng"))),
        "ai_label": payload.get("issue_type"),
        "ai_confidence": payload.get("confidence"),
        "trust_score": payload.get("trust_score", job.get("trust_score")),
        "source": payload.get("source", "yolo"),
        "verification_status": payload.get("verification_status", "needs_review"),
        "raw_ai_result": payload.get("raw_ai_result"),
        "capture_mode": capture_mode,
        "session_id": job.get("session_id"),
        "device_id": job.get("device_id"),
        "user_id": job.get("user_id"),
        "gps_accuracy": job.get("gps_accuracy"),
        "client_timestamp": job.get("client_timestamp"),
        "suspicion_flags": flags,
        "is_gallery_upload": capture_mode in ("gallery_upload", "screenshot"),
        "incident_id": extra.get("incident_id"),
    }
    row.update({k: v for k, v in extra.items() if k not in row or extra[k] is not None})
    return row


def list_jobs_by_status(status: str, limit: int = 50) -> list[dict[str, Any]]:
    sb = get_supabase()
    return (
        sb.table("passive_clip_jobs")
        .select("*")
        .eq("status", status)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )


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
