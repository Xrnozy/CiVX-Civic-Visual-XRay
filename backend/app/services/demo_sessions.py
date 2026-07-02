"""Demo session tokens for the mobile web QR flow (DB + in-memory fallback)."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

MOBILE_DEMO_BASE_URL = "https://civx.xrnozy.me/mobile"

# Fallback when demo_sessions table is missing or Supabase is unavailable.
_memory_sessions: dict[str, dict[str, Any]] = {}


def _mobile_demo_url(token: str) -> str:
    base = (settings.mobile_demo_base_url or MOBILE_DEMO_BASE_URL).rstrip("/")
    return f"{base}?session={token}"


def _session_expired(session: dict[str, Any]) -> bool:
    expires = session.get("expires_at")
    if not expires:
        return False
    try:
        exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        return exp < datetime.now(timezone.utc)
    except ValueError:
        return False


def _remember(token: str, session: dict[str, Any]) -> dict[str, Any]:
    _memory_sessions[token] = session
    return session


def _fetch_db_session(token: str) -> dict[str, Any] | None:
    try:
        from app.db import get_supabase

        sb = get_supabase()
        return (
            sb.table("demo_sessions")
            .select("*")
            .eq("token", token)
            .maybe_single()
            .execute()
            .data
        )
    except Exception as exc:
        logger.warning("demo_sessions DB read failed: %s", exc)
        return None


def _persist_db_session(token: str, label: str | None, expires: str) -> dict[str, Any] | None:
    try:
        from app.db import get_supabase

        sb = get_supabase()
        row = (
            sb.table("demo_sessions")
            .insert({"token": token, "label": label, "expires_at": expires})
            .execute()
            .data[0]
        )
        return row
    except Exception as exc:
        logger.warning("demo_sessions DB write failed (using memory): %s", exc)
        return None


def create_session(label: str | None = None) -> dict[str, Any]:
    token = secrets.token_urlsafe(16)
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    row = _persist_db_session(token, label, expires)
    session = row or {
        "id": str(uuid.uuid4()),
        "token": token,
        "label": label,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _remember(token, session)
    return {
        "id": session["id"],
        "token": token,
        "url": _mobile_demo_url(token),
        "expires_at": expires,
    }


def get_session_public(token: str) -> dict[str, Any]:
    session = resolve_session(token, allow_create=False)
    return {
        "id": session["id"],
        "token": session["token"],
        "expires_at": session.get("expires_at"),
        "label": session.get("label"),
    }


def resolve_session(token: str | None, allow_create: bool = True) -> dict[str, Any]:
    if not token or not str(token).strip():
        raise HTTPException(status_code=400, detail="Missing demo session token")

    token = str(token).strip()

    if token in _memory_sessions:
        session = _memory_sessions[token]
        if _session_expired(session):
            raise HTTPException(status_code=410, detail="Demo session expired")
        return session

    db_session = _fetch_db_session(token)
    if db_session:
        if _session_expired(db_session):
            raise HTTPException(status_code=410, detail="Demo session expired")
        return _remember(token, db_session)

    if not allow_create:
        raise HTTPException(status_code=404, detail="Invalid demo session")

    # Phone opened a client-generated or not-yet-synced session token.
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    session = _persist_db_session(token, label="auto", expires=expires) or {
        "id": str(uuid.uuid4()),
        "token": token,
        "label": "auto",
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return _remember(token, session)
