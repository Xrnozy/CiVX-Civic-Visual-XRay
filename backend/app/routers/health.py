from fastapi import APIRouter

from app.services import demo_sessions

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok", "service": "civx-api"}


@router.post("/api/demo/sessions")
def create_demo_session(label: str | None = None):
    """Create a mobile demo session (also registered here so QR works even on minimal deploys)."""
    return demo_sessions.create_session(label)


@router.get("/api/demo/sessions/{token}")
def get_demo_session(token: str):
    return demo_sessions.get_session_public(token)
