import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks

from app.auth.firebase import AuthUser, get_current_user
from app.db import get_supabase
from app.models.schemas import RouteSessionCreate
from app.agents.passive_video import PassiveVideoAgent

router = APIRouter(prefix="/api/passive", tags=["passive"])


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
    from datetime import datetime, timezone
    sb.table("passive_route_sessions").update({
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "route_status": "completed",
    }).eq("id", session_id).execute()
    return {"status": "completed"}


@router.post("/sessions/{session_id}/chunks")
async def upload_chunk(
    session_id: str,
    background_tasks: BackgroundTasks,
    chunk_index: int = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
    gps_trace_json: str = Form("[]"),
    video: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    import json
    sb = get_supabase()
    content = await video.read()
    key = f"{session_id}/{uuid.uuid4().hex}.mp4"
    sb.storage.from_("video-chunks").upload(key, content, {"content-type": "video/mp4"})
    url = sb.storage.from_("video-chunks").get_public_url(key)
    trace = json.loads(gps_trace_json) if gps_trace_json else []
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
    background_tasks.add_task(_process_chunk, chunk["id"])
    return chunk


def _process_chunk(chunk_id: str):
    from app.db import get_supabase
    try:
        PassiveVideoAgent().process_chunk(chunk_id)
    except Exception:
        sb = get_supabase()
        sb.table("video_chunks").update({"processing_status": "failed"}).eq("id", chunk_id).execute()
