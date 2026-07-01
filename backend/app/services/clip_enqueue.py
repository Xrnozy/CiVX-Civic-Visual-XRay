"""Shared logic to persist a clip and enqueue clip_jobs."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.services import passive_jobs, pipeline_storage, redis_queue
from app.services.evidence_trust import evaluate_upload_trust
from app.services.queue_mode import current_mode
from app.services.redis_queue import STREAM_CLIP, stream_lengths


def enqueue_clip(
    content: bytes,
    *,
    lat: float | None,
    lng: float | None,
    device_id: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    nonce: str | None = None,
    capture_mode: str = "passive_camera",
    gps_accuracy: float | None = None,
    client_timestamp: datetime | None = None,
    route_session_id: str | None = None,
    video_chunk_id: str | None = None,
    gps_trace_json: list | None = None,
    skip_session_check: bool = False,
    job_id: str | None = None,
) -> dict[str, Any]:
    jid = job_id or str(uuid.uuid4())
    video_path, sha256 = pipeline_storage.save_clip(content, jid)

    trust = evaluate_upload_trust(
        capture_mode=capture_mode,
        session_id=session_id,
        nonce=nonce,
        sha256=sha256,
        lat=lat,
        lng=lng,
        gps_accuracy=gps_accuracy,
        device_id=device_id,
        client_timestamp=client_timestamp,
        skip_session_check=skip_session_check,
    )

    is_new_hash = passive_jobs.register_file_hash(sha256, jid)
    if not is_new_hash and "duplicate_hash" not in trust.suspicion_flags:
        trust.suspicion_flags.append("duplicate_hash")
        trust.trust_score = max(0.0, trust.trust_score - 0.5)

    mode = current_mode(stream_lengths())

    job = passive_jobs.create_clip_job({
        "job_id": jid,
        "video_path": video_path,
        "sha256": sha256,
        "lat": lat,
        "lng": lng,
        "gps_accuracy": gps_accuracy,
        "device_id": device_id,
        "user_id": user_id,
        "session_id": session_id,
        "route_session_id": route_session_id,
        "video_chunk_id": video_chunk_id,
        "capture_mode": capture_mode,
        "client_timestamp": client_timestamp.isoformat() if client_timestamp else None,
        "trust_score": trust.trust_score,
        "suspicion_flags": trust.suspicion_flags,
        "processing_mode": mode,
        "gps_trace_json": gps_trace_json or [],
        "status": "queued",
    })

    redis_queue.enqueue(STREAM_CLIP, {
        "job_id": jid,
        "video_path": video_path,
        "lat": lat,
        "lng": lng,
        "device_id": device_id,
        "user_id": user_id,
        "trust_score": trust.trust_score,
        "capture_mode": capture_mode,
        "processing_mode": mode,
        "gps_trace_json": gps_trace_json or [],
    })

    return {
        "ok": True,
        "job_id": jid,
        "message": "Clip queued for analysis",
        "trust_score": trust.trust_score,
        "trust_level": trust.trust_level,
        "suspicion_flags": trust.suspicion_flags,
        "job": job,
    }
