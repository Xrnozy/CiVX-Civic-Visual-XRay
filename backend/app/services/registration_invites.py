"""Registration invite helpers for street sweeper onboarding."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.db import get_supabase

LGU_ROLES = ("lgu_admin", "lgu_staff")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def refresh_invite_status(invite: dict[str, Any]) -> dict[str, Any]:
    """Mark invite expired if past expires_at and still active."""
    if invite.get("status") != "active":
        return invite
    expires = _parse_ts(invite.get("expires_at"))
    if expires and expires < _now():
        sb = get_supabase()
        sb.table("registration_invites").update({"status": "expired"}).eq("id", invite["id"]).execute()
        invite["status"] = "expired"
    return invite


def get_invite_by_token(token: str) -> dict[str, Any] | None:
    sb = get_supabase()
    result = sb.table("registration_invites").select("*").eq("token", token).limit(1).execute()
    if not result.data:
        return None
    return refresh_invite_status(result.data[0])


def validate_invite_for_registration(token: str) -> dict[str, Any]:
    invite = get_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.get("status") == "revoked":
        raise HTTPException(status_code=400, detail="Invite has been revoked")
    if invite.get("status") == "used":
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.get("status") == "expired":
        raise HTTPException(status_code=400, detail="Invite has expired")
    expires = _parse_ts(invite.get("expires_at"))
    if expires and expires < _now():
        sb = get_supabase()
        sb.table("registration_invites").update({"status": "expired"}).eq("id", invite["id"]).execute()
        raise HTTPException(status_code=400, detail="Invite has expired")
    return invite


def redeem_invite(invite_id: str, user_id: str) -> None:
    sb = get_supabase()
    now = _now().isoformat()
    sb.table("registration_invites").update({
        "status": "used",
        "used_at": now,
        "used_by": user_id,
    }).eq("id", invite_id).eq("status", "active").execute()
