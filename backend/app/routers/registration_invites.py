import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase import AuthUser, require_roles
from app.config import settings
from app.db import get_supabase
from app.models.schemas import RegistrationInviteCreate
from app.services import registration_invites as invite_svc
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/registration-invites", tags=["registration-invites"])
LGU = ("lgu_admin", "lgu_staff")


def _register_url(token: str) -> str:
    base = settings.public_web_url.rstrip("/")
    return f"{base}/register?invite={token}"


@router.get("/validate")
def validate_invite(token: str = Query(..., min_length=8)):
    invite = invite_svc.get_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite = invite_svc.refresh_invite_status(invite)
    valid = invite.get("status") == "active"
    return {
        "valid": valid,
        "status": invite.get("status"),
        "barangay": invite.get("barangay"),
        "label": invite.get("label"),
        "expires_at": invite.get("expires_at"),
        "target_role": invite.get("target_role", "street_sweeper"),
    }


@router.get("")
def list_invites(user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    rows = (
        sb.table("registration_invites")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
        .data
        or []
    )
    refreshed = [invite_svc.refresh_invite_status(r) for r in rows]
    return refreshed


@router.post("")
def create_invite(body: RegistrationInviteCreate, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
    row = sb.table("registration_invites").insert({
        "token": token,
        "target_role": "street_sweeper",
        "created_by": user.id,
        "barangay": body.barangay,
        "label": body.label,
        "expires_at": expires_at.isoformat(),
        "status": "active",
    }).execute().data[0]
    log_audit(user.id, "create_registration_invite", "registration_invite", row["id"], {"label": body.label})
    return {
        **row,
        "register_url": _register_url(token),
    }


@router.post("/{invite_id}/revoke")
def revoke_invite(invite_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    existing = (
        sb.table("registration_invites")
        .select("*")
        .eq("id", invite_id)
        .eq("created_by", user.id)
        .limit(1)
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite = existing[0]
    if invite.get("status") != "active":
        raise HTTPException(status_code=400, detail="Only active invites can be revoked")
    sb.table("registration_invites").update({"status": "revoked"}).eq("id", invite_id).execute()
    log_audit(user.id, "revoke_registration_invite", "registration_invite", invite_id, {})
    return {"status": "revoked"}
