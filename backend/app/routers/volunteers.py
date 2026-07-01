from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase import AuthUser, get_current_user
from app.db import get_supabase
from app.models.schemas import VolunteerRegister
from app.services import attendance as att

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.get("/events/{event_id}/me")
def my_event_registration(event_id: str, user: AuthUser = Depends(get_current_user)):
    att.get_event(event_id)
    return att.volunteer_event_status(event_id, user.id)


@router.post("/events/{event_id}/register")
def register_volunteer(event_id: str, body: VolunteerRegister, user: AuthUser = Depends(get_current_user)):
    if not body.safety_agreement:
        raise HTTPException(400, "Safety agreement required")
    event = att.get_event(event_id)
    if event.get("approval_status") != "approved":
        raise HTTPException(403, "Registration is only available for approved events")
    sb = get_supabase()
    existing = (
        sb.table("volunteer_registrations")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        raise HTTPException(409, "Already registered for this event")
    row = sb.table("volunteer_registrations").insert({
        "event_id": event_id,
        "user_id": user.id,
        "full_name": body.full_name,
        "phone_number": body.phone_number,
        "barangay": body.barangay,
        "emergency_contact": body.emergency_contact,
        "safety_agreement": body.safety_agreement,
    }).execute().data[0]
    sb.table("attendance_records").insert({
        "event_id": event_id,
        "user_id": user.id,
        "organizer_status": "registered",
        "lgu_status": "registered",
    }).execute()
    return row


@router.get("/events/{event_id}")
def list_volunteers(event_id: str, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    return sb.table("volunteer_registrations").select("*").eq("event_id", event_id).execute().data
