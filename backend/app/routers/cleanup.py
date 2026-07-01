import uuid
from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase import AuthUser, get_current_user, get_optional_user, require_roles
from app.db import get_supabase
from app.models.schemas import CleanupEventCreate
from app.agents.cleanup_coordination import CleanupCoordinationAgent
from app.services import attendance as att
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/cleanup-events", tags=["cleanup"])
LGU = ("lgu_admin", "lgu_staff")
ORGANIZER_AND_LGU = ("organizer", "lgu_admin", "lgu_staff")


@router.get("")
def list_events(
    approved_only: bool = False,
    mine: bool = False,
    user: AuthUser | None = Depends(get_optional_user),
):
    sb = get_supabase()
    q = sb.table("cleanup_events").select("*")
    if approved_only:
        q = q.eq("approval_status", "approved")
    if mine and user:
        q = q.eq("organizer_user_id", user.id)
    return q.order("scheduled_start", desc=True).limit(100).execute().data


@router.post("")
def create_event(body: CleanupEventCreate, user: AuthUser = Depends(require_roles(*ORGANIZER_AND_LGU))):
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
    event = att.get_event(event_id)
    organizer_id = event.get("organizer_user_id")
    return {
        **event,
        "going_count": att.public_going_count(event_id),
        "organizer_name": att.fetch_organizer_display_name(organizer_id),
        "organizer_profile_photo_url": att.fetch_organizer_profile_photo(organizer_id),
    }


@router.get("/{event_id}/participants")
def list_event_participants(event_id: str, user: AuthUser = Depends(get_current_user)):
    event = att.get_event(event_id)
    if event.get("approval_status") != "approved":
        raise HTTPException(403, "Participants are available only for approved events")
    return {"participants": att.public_participant_names(event_id)}


@router.get("/{event_id}/attendees")
def get_event_attendees(
    event_id: str,
    user: AuthUser = Depends(require_roles(*ORGANIZER_AND_LGU)),
):
    event = att.get_event(event_id)
    if event.get("approval_status") != "approved":
        raise HTTPException(403, "Attendee roster is available only for approved events")
    if user.role == "organizer" and event.get("organizer_user_id") != user.id:
        raise HTTPException(403, "Not authorized for this event")

    records = att.fetch_event_records(event_id)
    registrations = att.fetch_registrations(event_id)
    user_ids = [rec["user_id"] for rec in records]
    emails = att.fetch_user_emails(user_ids)
    attendees = []
    for rec in records:
        reg = registrations.get(rec["user_id"], {})
        attendees.append(
            {
                "user_id": rec["user_id"],
                "full_name": reg.get("full_name") or "Volunteer",
                "phone_number": reg.get("phone_number"),
                "email": emails.get(rec["user_id"]),
                "barangay": reg.get("barangay"),
                "emergency_contact": reg.get("emergency_contact"),
                "attendance_status": att.status_to_api(rec.get("lgu_status") or rec.get("organizer_status")),
                "check_in_time": rec.get("check_in_time"),
                "check_out_time": rec.get("check_out_time"),
                "calculated_hours": float(rec.get("calculated_hours") or 0),
            }
        )
    attendees.sort(key=lambda row: row.get("full_name", ""))
    return {
        "event": {
            "id": event["id"],
            "title": event.get("title"),
            "approval_status": event.get("approval_status"),
        },
        "attendees": attendees,
    }


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
