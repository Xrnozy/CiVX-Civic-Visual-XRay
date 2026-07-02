import json
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.models.schemas import RouteSessionCreate
from app.services.clip_enqueue import enqueue_clip
from app.services.queue_mode import queue_status_payload
from app.services.redis_queue import stream_lengths

router = APIRouter(prefix="/api/passive", tags=["passive"])

WORKER_READ = ("street_sweeper",)


def _session_owned(sb, session_id: str, user_id: str) -> dict:
    row = (
        sb.table("passive_route_sessions")
        .select("*")
        .eq("id", session_id)
        .maybe_single()
        .execute()
        .data
    )
    if not row or row.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Session not found")
    return row


def _chunk_ids_for_sessions(sb, session_ids: list[str]) -> list[str]:
    if not session_ids:
        return []
    chunks = (
        sb.table("video_chunks")
        .select("id")
        .in_("route_session_id", session_ids)
        .execute()
        .data
        or []
    )
    return [c["id"] for c in chunks]


def _count_detections(sb, chunk_ids: list[str]) -> int:
    if not chunk_ids:
        return 0
    rows = (
        sb.table("detection_results")
        .select("id")
        .in_("video_chunk_id", chunk_ids)
        .execute()
        .data
        or []
    )
    return len(rows)


@router.get("/me/summary")
def my_summary(user: AuthUser = Depends(require_roles(*WORKER_READ))):
    sb = get_supabase()
    sessions = (
        sb.table("passive_route_sessions")
        .select("id, route_status, total_chunks")
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )
    session_ids = [s["id"] for s in sessions]
    chunk_ids = _chunk_ids_for_sessions(sb, session_ids)
    active_session_id = next(
        (s["id"] for s in sessions if s.get("route_status") == "active"),
        None,
    )
    return {
        "total_sessions": len(sessions),
        "total_chunks": sum(s.get("total_chunks") or 0 for s in sessions),
        "total_detections": _count_detections(sb, chunk_ids),
        "active_session_id": active_session_id,
    }


@router.get("/sessions")
def list_sessions(
    limit: int = 20,
    user: AuthUser = Depends(require_roles(*WORKER_READ)),
):
    sb = get_supabase()
    rows = (
        sb.table("passive_route_sessions")
        .select("id, mode, started_at, ended_at, route_status, total_chunks")
        .eq("user_id", user.id)
        .order("started_at", desc=True)
        .limit(min(limit, 50))
        .execute()
        .data
        or []
    )
    return rows


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user: AuthUser = Depends(require_roles(*WORKER_READ))):
    sb = get_supabase()
    row = _session_owned(sb, session_id, user.id)
    chunks = (
        sb.table("video_chunks")
        .select("processing_status")
        .eq("route_session_id", session_id)
        .execute()
        .data
        or []
    )
    completed = sum(1 for c in chunks if c.get("processing_status") == "completed")
    pending = sum(1 for c in chunks if c.get("processing_status") in ("pending", "processing"))
    failed = sum(1 for c in chunks if c.get("processing_status") == "failed")
    return {
        **row,
        "chunks_completed": completed,
        "chunks_pending": pending,
        "chunks_failed": failed,
    }


@router.get("/sessions/{session_id}/detections")
def session_detections(
    session_id: str,
    limit: int = 20,
    user: AuthUser = Depends(require_roles(*WORKER_READ)),
):
    sb = get_supabase()
    _session_owned(sb, session_id, user.id)
    chunk_ids = _chunk_ids_for_sessions(sb, [session_id])
    if not chunk_ids:
        return []
    rows = (
        sb.table("detection_results")
        .select(
            "id, detected_issue_type, confidence, severity_score, "
            "matched_latitude, matched_longitude, created_at, video_chunk_id"
        )
        .in_("video_chunk_id", chunk_ids)
        .order("created_at", desc=True)
        .limit(min(limit, 50))
        .execute()
        .data
        or []
    )
    return [{**r, "session_id": session_id} for r in rows]


@router.get("/detections/recent")
def recent_detections(
    limit: int = 10,
    user: AuthUser = Depends(require_roles(*WORKER_READ)),
):
    sb = get_supabase()
    sessions = (
        sb.table("passive_route_sessions")
        .select("id")
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )
    session_ids = [s["id"] for s in sessions]
    chunk_ids = _chunk_ids_for_sessions(sb, session_ids)
    if not chunk_ids:
        return []
    chunk_to_session = {}
    chunks = (
        sb.table("video_chunks")
        .select("id, route_session_id")
        .in_("id", chunk_ids)
        .execute()
        .data
        or []
    )
    for c in chunks:
        chunk_to_session[c["id"]] = c["route_session_id"]
    rows = (
        sb.table("detection_results")
        .select(
            "id, detected_issue_type, confidence, severity_score, "
            "matched_latitude, matched_longitude, created_at, video_chunk_id"
        )
        .in_("video_chunk_id", chunk_ids)
        .order("created_at", desc=True)
        .limit(min(limit, 30))
        .execute()
        .data
        or []
    )
    return [
        {**r, "session_id": chunk_to_session.get(r["video_chunk_id"], "")}
        for r in rows
    ]


@router.post("/sessions")
def start_session(body: RouteSessionCreate, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    return sb.table("passive_route_sessions").insert({
        "user_id": user.id,
        "mode": body.mode,
        "device_id": body.device_id,
    }).execute().data[0]


@router.post("/sessions/{session_id}/end")
def end_session(session_id: str, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    _session_owned(sb, session_id, user.id)
    from datetime import datetime, timezone

    sb.table("passive_route_sessions").update({
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "route_status": "completed",
    }).eq("id", session_id).execute()
    return {"status": "completed"}


@router.get("/queue/status")
def queue_status(user: AuthUser = Depends(require_roles(*WORKER_READ))):
    """Redis pipeline queue depth."""
    return queue_status_payload(stream_lengths())


@router.post("/sessions/{session_id}/chunks")
async def upload_chunk(
    session_id: str,
    chunk_index: int = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
    gps_trace_json: str = Form("[]"),
    device_id: str | None = Form(None),
    video: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    sb = get_supabase()
    session = _session_owned(sb, session_id, user.id)
    content = await video.read()
    content_type = video.content_type or "video/mp4"
    extension = "webm" if content_type == "video/webm" else "mp4"
    key = f"{session_id}/{uuid.uuid4().hex}.{extension}"
    sb.storage.from_("video-chunks").upload(key, content, {"content-type": content_type})
    url = sb.storage.from_("video-chunks").get_public_url(key)
    trace = json.loads(gps_trace_json) if gps_trace_json else []
    lat = trace[-1]["lat"] if trace else None
    lng = trace[-1]["lng"] if trace else None

    chunk = sb.table("video_chunks").insert({
        "route_session_id": session_id,
        "storage_url": url,
        "chunk_index": chunk_index,
        "start_time": start_time,
        "end_time": end_time,
        "gps_trace_json": trace,
        "processing_status": "pending",
    }).execute().data[0]

    sb.table("passive_route_sessions").update({
        "total_chunks": chunk_index + 1,
    }).eq("id", session_id).execute()

    result = enqueue_clip(
        content,
        lat=lat,
        lng=lng,
        device_id=device_id or session.get("device_id"),
        user_id=user.id,
        capture_mode="driver_camera" if session.get("mode") == "driver" else "passive_camera",
        route_session_id=session_id,
        video_chunk_id=chunk["id"],
        gps_trace_json=trace,
        skip_session_check=True,
    )

    sb.table("video_chunks").update({
        "processing_status": "processing",
    }).eq("id", chunk["id"]).execute()

    return {**chunk, "job_id": result["job_id"], "pipeline": result}

