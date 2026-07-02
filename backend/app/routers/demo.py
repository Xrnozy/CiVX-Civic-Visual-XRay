import json
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from app.agents.report_intake import ReportIntakeAgent
from app.db import get_supabase
from app.services import demo_sessions

router = APIRouter(prefix="/api/demo", tags=["demo"])
logger = logging.getLogger(__name__)

DEMO_USER_EMAIL = "mobile-demo@civx.demo"
CHUNK_HANDLER_REV = "gps_trace_json-v2"
_DEBUG_LOG_PATHS = (
    Path(__file__).resolve().parents[3] / "debug-8b92e3.log",
    Path(__file__).resolve().parents[3] / ".cursor" / "debug-8b92e3.log",
)


def _agent_log(location: str, message: str, data: dict, hypothesis_id: str, run_id: str = "pre-fix") -> None:
    # #region agent log
    payload = {
        "sessionId": "8b92e3",
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    line = json.dumps(payload)
    logger.info("debug %s %s", location, message, extra={"debug_data": data})
    for log_path in _DEBUG_LOG_PATHS:
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception:
            pass
    # #endregion


def _demo_user_id() -> str:
    sb = get_supabase()
    row = sb.table("users").select("id").eq("email", DEMO_USER_EMAIL).limit(1).execute().data
    if row:
        return row[0]["id"]
    row = sb.table("users").select("id").eq("role", "citizen").limit(1).execute().data
    if row:
        return row[0]["id"]
    raise HTTPException(status_code=503, detail="Demo user not configured")


@router.get("/sessions/{token}/reports")
def list_demo_session_reports(token: str):
    session = demo_sessions.resolve_session(token)
    sb = get_supabase()
    try:
        return (
            sb.table("reports")
            .select("id, issue_type, description, latitude, longitude, status, merged_incident_id, created_at")
            .eq("demo_session_id", session["id"])
            .order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
            or []
        )
    except Exception:
        return []


@router.post("/reports")
async def create_demo_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str | None = Form(None),
    issue_type: str | None = Form(None),
    barangay: str | None = Form(None),
    photo: UploadFile | None = File(None),
    x_demo_session: str | None = Header(None, alias="X-Demo-Session"),
):
    session = demo_sessions.resolve_session(x_demo_session)
    if not photo:
        raise HTTPException(status_code=400, detail="Photo is required")

    user_id = _demo_user_id()
    photo_bytes = await photo.read()
    agent = ReportIntakeAgent()
    result = agent.process(
        user_id=user_id,
        photo_payloads=[{"bytes": photo_bytes, "filename": photo.filename or "report.jpg"}],
        latitude=latitude,
        longitude=longitude,
        description=description or "Mobile demo report",
        issue_type=issue_type,
        barangay=barangay,
    )
    report_id = result["report"]["id"]
    sb = get_supabase()
    try:
        sb.table("reports").update({"demo_session_id": session["id"]}).eq("id", report_id).execute()
    except Exception:
        pass
    if result.get("incident_id") or result.get("report", {}).get("merged_incident_id"):
        inc_id = result.get("incident_id") or result["report"].get("merged_incident_id")
        sb.table("incidents").update({"source": "mobile_demo"}).eq("id", inc_id).execute()
    return {**result, "demo_session_id": session["id"]}


@router.post("/analyze/image")
async def demo_analyze_image(
    image: UploadFile = File(...),
    issue_type: str | None = Form(None),
    x_demo_session: str | None = Header(None, alias="X-Demo-Session"),
):
    demo_sessions.resolve_session(x_demo_session)
    from app.agents.ai_detection import AIDetectionAgent
    import os
    import tempfile

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Image is empty")
    suffix = ".jpg"
    if image.filename and "." in image.filename:
        suffix = "." + image.filename.rsplit(".", 1)[-1]
    local_path = os.path.join(tempfile.gettempdir(), f"demo_{uuid.uuid4().hex}{suffix}")
    with open(local_path, "wb") as f:
        f.write(content)
    try:
        agent = AIDetectionAgent()
        detection = agent.detect_image(local_path)
        return {
            "issue_type": issue_type or (detection.issue_type if detection else "garbage_pile"),
            "confidence": detection.confidence if detection else 0.3,
            "severity": detection.severity_score if detection else 1.5,
            "bounding_box": detection.bounding_box if detection else None,
            "ai_suggested_type": detection.issue_type if detection else issue_type,
        }
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)


@router.post("/passive/sessions")
def start_demo_passive_session(
    mode: str = Form("passive"),
    x_demo_session: str | None = Header(None, alias="X-Demo-Session"),
):
    session = demo_sessions.resolve_session(x_demo_session)
    sb = get_supabase()
    user_id = _demo_user_id()
    row = (
        sb.table("passive_route_sessions")
        .insert({
            "user_id": user_id,
            "mode": mode,
            "device_id": f"demo:{session['token']}",
        })
        .execute()
        .data[0]
    )
    return row


@router.post("/passive/sessions/{session_id}/chunks")
async def upload_demo_chunk(
    session_id: str,
    chunk_index: int = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
    gps_trace_json: str = Form("[]"),
    video: UploadFile = File(...),
    x_demo_session: str | None = Header(None, alias="X-Demo-Session"),
):
    _agent_log(
        "demo.py:upload_demo_chunk",
        "handler entered",
        {"rev": CHUNK_HANDLER_REV, "session_id": session_id, "chunk_index": chunk_index},
        "F",
    )
    from app.services.passive_jobs import _maybe_single_data

    demo = demo_sessions.resolve_session(x_demo_session)
    sb = get_supabase()
    route = _maybe_single_data(
        sb.table("passive_route_sessions").select("*").eq("id", session_id)
    )
    if not route or route.get("device_id") != f"demo:{demo['token']}":
        raise HTTPException(status_code=403, detail="Session not found")

    content = await video.read()
    content_type = video.content_type or "video/webm"
    extension = "webm" if "webm" in content_type else "mp4"
    key = f"{session_id}/{uuid.uuid4().hex}.{extension}"
    sb.storage.from_("video-chunks").upload(key, content, {"content-type": content_type})
    trace = json.loads(gps_trace_json) if gps_trace_json else []
    lat = trace[-1]["lat"] if trace else None
    lng = trace[-1]["lng"] if trace else None

    insert_payload = {
        "route_session_id": session_id,
        "storage_url": "",
        "chunk_index": chunk_index,
        "start_time": start_time,
        "end_time": end_time,
        "gps_trace_json": trace,
        "processing_status": "pending",
    }
    _agent_log(
        "demo.py:upload_demo_chunk",
        "chunk insert payload",
        {"session_id": session_id, "chunk_index": chunk_index, "keys": list(insert_payload.keys())},
        "A",
    )

    try:
        chunk = sb.table("video_chunks").insert(insert_payload).execute().data[0]
    except Exception as exc:
        _agent_log(
            "demo.py:upload_demo_chunk",
            "chunk insert failed",
            {"session_id": session_id, "error": str(exc)},
            "A",
        )
        raise

    from app.services.clip_enqueue import enqueue_clip

    try:
        result = enqueue_clip(
            content,
            lat=lat,
            lng=lng,
            device_id=route.get("device_id"),
            user_id=route.get("user_id"),
            capture_mode="passive_camera",
            route_session_id=session_id,
            video_chunk_id=chunk["id"],
            gps_trace_json=trace,
            skip_session_check=True,
        )
    except Exception as exc:
        _agent_log(
            "demo.py:upload_demo_chunk",
            "enqueue failed",
            {"session_id": session_id, "chunk_id": chunk["id"], "error": str(exc)},
            "G",
        )
        raise

    sb.table("video_chunks").update({"processing_status": "processing"}).eq("id", chunk["id"]).execute()
    sb.table("passive_route_sessions").update({
        "total_chunks": chunk_index + 1,
    }).eq("id", session_id).execute()

    _agent_log(
        "demo.py:upload_demo_chunk",
        "chunk queued",
        {"chunk_id": chunk["id"], "job_id": result.get("job_id"), "storage_key": key},
        "C",
        run_id="post-fix",
    )
    return {"chunk_id": chunk["id"], "status": "queued", "job_id": result.get("job_id")}
