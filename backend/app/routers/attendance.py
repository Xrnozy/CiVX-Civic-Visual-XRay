import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.config import settings
from app.db import get_supabase
from app.models.schemas import AttendanceCheckIn

router = APIRouter(prefix="/api/attendance", tags=["attendance"])
LGU = ("lgu_admin", "lgu_staff", "organizer")


@router.post("/events/{event_id}/check-in")
def check_in(event_id: str, body: AttendanceCheckIn, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    event = sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
    if event.get("qr_code_token") != body.qr_code_id:
        raise HTTPException(400, "Invalid QR code")
    dist = _haversine(body.latitude, body.longitude, event["latitude"], event["longitude"])
    if dist > settings.attendance_gps_radius_m:
        raise HTTPException(400, f"Too far from event ({dist:.0f}m)")
    now = datetime.now(timezone.utc).isoformat()
    sb.table("attendance_records").upsert({
        "event_id": event_id,
        "user_id": user.id,
        "check_in_time": now,
        "check_in_latitude": body.latitude,
        "check_in_longitude": body.longitude,
        "qr_code_id": body.qr_code_id,
        "selfie_url": body.selfie_url,
        "organizer_status": "checked_in",
        "lgu_status": "checked_in",
    }, on_conflict="event_id,user_id").execute()
    return {"status": "checked_in", "check_in_time": now}


@router.post("/events/{event_id}/check-out")
def check_out(event_id: str, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    rec = sb.table("attendance_records").select("*").eq("event_id", event_id).eq("user_id", user.id).single().execute().data
    now = datetime.now(timezone.utc)
    check_in = datetime.fromisoformat(rec["check_in_time"].replace("Z", "+00:00"))
    hours = round((now - check_in).total_seconds() / 3600, 2)
    sb.table("attendance_records").update({
        "check_out_time": now.isoformat(),
        "calculated_hours": hours,
        "organizer_status": "checked_out",
        "lgu_status": "checked_out",
    }).eq("id", rec["id"]).execute()
    return {"status": "checked_out", "calculated_hours": hours}


@router.post("/events/{event_id}/verify/{user_id}")
def verify_attendance(event_id: str, user_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("attendance_records").update({"lgu_status": "verified"}).eq("event_id", event_id).eq("user_id", user_id).execute()
    return {"status": "verified"}


@router.get("/events/{event_id}")
def event_attendance(event_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    return sb.table("attendance_records").select("*").eq("event_id", event_id).execute().data


def _haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
