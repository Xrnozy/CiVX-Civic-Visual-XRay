import uuid
from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.models.schemas import CleanupEventCreate
from app.agents.cleanup_coordination import CleanupCoordinationAgent
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/cleanup-events", tags=["cleanup"])
LGU = ("lgu_admin", "lgu_staff")


@router.get("")
def list_events(approved_only: bool = False):
    sb = get_supabase()
    q = sb.table("cleanup_events").select("*")
    if approved_only:
        q = q.eq("approval_status", "approved")
    return q.order("scheduled_start", desc=True).limit(100).execute().data


@router.post("")
def create_event(body: CleanupEventCreate, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    qr = str(uuid.uuid4())
    row = sb.table("cleanup_events").insert({
        **body.model_dump(),
        "organizer_user_id": user.id,
        "qr_code_token": qr,
    }).execute().data[0]
    agent = CleanupCoordinationAgent()
    agent.match_event_to_incident(row["id"])
    return row


@router.get("/{event_id}")
def get_event(event_id: str):
    sb = get_supabase()
    return sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data


@router.post("/{event_id}/approve")
def approve_event(event_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("cleanup_events").update({"approval_status": "approved"}).eq("id", event_id).execute()
    log_audit(user.id, "approve_cleanup", "cleanup_event", event_id, {})
    return {"approval_status": "approved"}


@router.post("/{event_id}/reject")
def reject_event(event_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("cleanup_events").update({"approval_status": "rejected"}).eq("id", event_id).execute()
    log_audit(user.id, "reject_cleanup", "cleanup_event", event_id, {})
    return {"approval_status": "rejected"}


@router.get("/{event_id}/package")
def approval_package(event_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    agent = CleanupCoordinationAgent()
    return agent.build_approval_package(event_id)
