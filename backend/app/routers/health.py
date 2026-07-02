from fastapi import APIRouter

from app.services import demo_sessions
from app.services.pipeline_status import build_pipeline_status
from app.services.queue_mode import queue_status_payload
from app.services.redis_queue import stream_lengths

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok", "service": "civx-api"}


@router.get("/api/system/queue-status")
def system_queue_status():
    return queue_status_payload(stream_lengths())


@router.get("/api/system/pipeline-status")
def system_pipeline_status():
    """Redis, queue depths, and worker heartbeats (YOLO / LocateAnything)."""
    return build_pipeline_status()


@router.post("/api/demo/sessions")
def create_demo_session(label: str | None = None):
    """Create a mobile demo session (also registered here so QR works even on minimal deploys)."""
    return demo_sessions.create_session(label)


@router.get("/api/demo/sessions/{token}")
def get_demo_session(token: str):
    return demo_sessions.get_session_public(token)
