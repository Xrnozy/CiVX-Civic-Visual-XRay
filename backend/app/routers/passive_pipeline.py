"""Spec passive pipeline API routes."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth.firebase import AuthUser, get_current_user
from app.config import settings
from app.services import passive_jobs
from app.services.clip_enqueue import enqueue_clip
from app.services.evidence_trust import hash_nonce
from app.services.queue_mode import queue_status_payload
from app.services.redis_queue import stream_lengths

router = APIRouter(tags=["passive-pipeline"])

ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "application/octet-stream"}
MAX_VIDEO_BYTES = 50 * 1024 * 1024


@router.post("/api/passive/session/start")
def start_passive_session(
    device_id: str = Form(...),
    user: AuthUser = Depends(get_current_user),
):
    nonce = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.pipeline_session_ttl_minutes)
    row = passive_jobs.create_capture_session(
        device_id=device_id,
        user_id=user.id if user else None,
        nonce_hash=hash_nonce(nonce),
        expires_at=expires_at,
    )
    return {
        "ok": True,
        "session_id": row["session_id"],
        "nonce": nonce,
        "expires_at": expires_at.isoformat(),
    }


@router.post("/api/passive/upload")
async def passive_upload(
    video: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    device_id: str = Form(...),
    session_id: str = Form(...),
    nonce: str = Form(...),
    gps_accuracy: float | None = Form(None),
    client_timestamp: str | None = Form(None),
    capture_mode: str = Form("passive_camera"),
    user: AuthUser = Depends(get_current_user),
):
    if video.content_type and video.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported video type")

    content = await video.read()
    if not content:
        raise HTTPException(status_code=400, detail="Video file is empty")
    if len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=400, detail="Video exceeds 50 MB limit")

    client_ts = None
    if client_timestamp:
        try:
            client_ts = datetime.fromisoformat(client_timestamp.replace("Z", "+00:00"))
        except ValueError:
            pass

    result = enqueue_clip(
        content,
        lat=lat,
        lng=lng,
        device_id=device_id,
        user_id=user.id,
        session_id=session_id,
        nonce=nonce,
        capture_mode=capture_mode,
        gps_accuracy=gps_accuracy,
        client_timestamp=client_ts,
    )
    return {
        "ok": True,
        "job_id": result["job_id"],
        "message": result["message"],
        "trust_score": result["trust_score"],
        "suspicion_flags": result["suspicion_flags"],
    }


@router.get("/api/passive/job/{job_id}")
def get_passive_job(job_id: str, user: AuthUser = Depends(get_current_user)):
    job = passive_jobs.get_clip_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/api/system/queue-status")
def system_queue_status():
    lengths = stream_lengths()
    return queue_status_payload(lengths)


@router.get("/api/passive/review-queue")
def passive_review_queue(
    limit: int = 50,
    user: AuthUser = Depends(get_current_user),
):
    jobs = passive_jobs.list_jobs_by_status("needs_review", limit=min(limit, 100))
    return {"jobs": jobs, "count": len(jobs)}


@router.get("/api/system/failed-jobs")
def system_failed_jobs(limit: int = 20, user: AuthUser = Depends(get_current_user)):
    jobs = passive_jobs.list_jobs_by_status("failed", limit=min(limit, 100))
    return {"jobs": jobs, "count": len(jobs)}
