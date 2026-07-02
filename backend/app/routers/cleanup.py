import uuid
from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase import AuthUser, get_current_user, get_optional_user, require_roles
from app.db import get_supabase
from app.models.schemas import CleanupEventBannerUpdate, CleanupEventCreate, CleanupEventRejectBody
from app.agents.cleanup_coordination import CleanupCoordinationAgent
from app.services import attendance as att
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/cleanup-events", tags=["cleanup"])
LGU = ("lgu_admin", "lgu_staff")
ORGANIZER_AND_LGU = ("organizer", "lgu_admin", "lgu_staff")


def _enrich_cleanup_event(row: dict) -> dict:
    """Ensure rejected events expose rejection_reason when stored on the row or in audit logs."""
    event = dict(row)
    if event.get("approval_status") != "rejected":
        return event

    reason = (event.get("rejection_reason") or "").strip()
    if reason:
        event["rejection_reason"] = reason
        return event

    try:
        sb = get_supabase()
        audits = (
            sb.table("audit_logs")
            .select("details")
            .eq("action", "reject_cleanup")
            .eq("entity_id", event["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if audits:
            audit_reason = (audits[0].get("details") or {}).get("reason")
            if audit_reason and str(audit_reason).strip():
                event["rejection_reason"] = str(audit_reason).strip()
    except Exception:
        pass
    return event


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
    return [_enrich_cleanup_event(row) for row in (q.order("scheduled_start", desc=True).limit(100).execute().data or [])]


@router.post("")
def create_event(body: CleanupEventCreate, user: AuthUser = Depends(require_roles(*ORGANIZER_AND_LGU))):
    sb = get_supabase()
    qr = str(uuid.uuid4())
    payload = {
        **body.model_dump(),
        "organizer_user_id": user.id,
        "qr_code_token": qr,
    }
    # #region agent log
    import json, time
    from pathlib import Path
    _log = Path(__file__).resolve().parents[3] / "debug-8b92e3.log"
    try:
        _log.open("a", encoding="utf-8").write(
            json.dumps({"sessionId": "8b92e3", "location": "cleanup.py:create_event", "message": "insert cleanup event", "data": {"has_banner": bool(payload.get("banner_url"))}, "timestamp": int(time.time() * 1000), "hypothesisId": "H3", "runId": "banner-feature"}) + "\n"
        )
    except Exception:
        pass
    # #endregion
    row = sb.table("cleanup_events").insert(payload).execute().data[0]
    agent = CleanupCoordinationAgent()
    agent.match_event_to_incident(row["id"])
    return row


@router.get("/{event_id}")
def get_event(event_id: str):
    event = att.get_event(event_id)
    organizer_id = event.get("organizer_user_id")
    logo_url = att.fetch_organizer_logo(organizer_id)
    # #region agent log
    import json, time
    from pathlib import Path
    _log = Path(__file__).resolve().parents[3] / "debug-8b92e3.log"
    try:
        _log.open("a", encoding="utf-8").write(
            json.dumps({"sessionId": "8b92e3", "runId": "org-logo-only", "location": "cleanup.py:get_event", "message": "organizer logo fetched", "data": {"event_id": event_id, "organizer_id": organizer_id, "logo_url": logo_url}, "timestamp": int(time.time() * 1000), "hypothesisId": "B"}) + "\n"
        )
    except Exception:
        pass
    # #endregion
    return {
        **_enrich_cleanup_event(event),
        "going_count": att.public_going_count(event_id),
        "organizer_name": att.fetch_organizer_display_name(organizer_id),
        "organizer_logo_url": logo_url,
        "organizer_profile_photo_url": att.fetch_organizer_profile_photo(organizer_id),
    }


@router.patch("/{event_id}/banner")
def update_event_banner(
    event_id: str,
    body: CleanupEventBannerUpdate,
    user: AuthUser = Depends(require_roles(*ORGANIZER_AND_LGU)),
):
    event = att.get_event(event_id)
    if user.role == "organizer" and event.get("organizer_user_id") != user.id:
        raise HTTPException(403, "Not authorized for this event")
    banner_url = body.banner_url.strip()
    if not banner_url:
        raise HTTPException(400, "banner_url is required")
    sb = get_supabase()
    updated = (
        sb.table("cleanup_events")
        .update({"banner_url": banner_url})
        .eq("id", event_id)
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(404, "Event not found")
    # #region agent log
    import json, time
    from pathlib import Path
    _log = Path(__file__).resolve().parents[3] / "debug-8b92e3.log"
    try:
        _log.open("a", encoding="utf-8").write(
            json.dumps({"sessionId": "8b92e3", "location": "cleanup.py:update_event_banner", "message": "banner updated", "data": {"event_id": event_id}, "timestamp": int(time.time() * 1000), "hypothesisId": "H2", "runId": "banner-feature"}) + "\n"
        )
    except Exception:
        pass
    # #endregion
    log_audit(user.id, "update_cleanup_banner", "cleanup_event", event_id, {})
    return updated[0]


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
    sb.table("cleanup_events").update({
        "approval_status": "approved",
        "rejection_reason": None,
    }).eq("id", event_id).execute()
    log_audit(user.id, "approve_cleanup", "cleanup_event", event_id, {})
    return {"approval_status": "approved"}


@router.post("/{event_id}/reject")
def reject_event(
    event_id: str,
    body: CleanupEventRejectBody,
    user: AuthUser = Depends(require_roles(*LGU)),
):
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(400, "Rejection reason is required")
    sb = get_supabase()
    updated = (
        sb.table("cleanup_events")
        .update({
            "approval_status": "rejected",
            "rejection_reason": reason,
        })
        .eq("id", event_id)
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(404, "Event not found")
    log_audit(user.id, "reject_cleanup", "cleanup_event", event_id, {"reason": reason})
    return _enrich_cleanup_event(updated[0])


@router.get("/{event_id}/package")
def approval_package(event_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    agent = CleanupCoordinationAgent()
    return agent.build_approval_package(event_id)
