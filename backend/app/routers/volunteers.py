from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase import AuthUser, get_current_user
from app.db import get_supabase
from app.models.schemas import VolunteerRegister

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.post("/events/{event_id}/register")
def register_volunteer(event_id: str, body: VolunteerRegister, user: AuthUser = Depends(get_current_user)):
    if not body.safety_agreement:
        raise HTTPException(400, "Safety agreement required")
    sb = get_supabase()
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
