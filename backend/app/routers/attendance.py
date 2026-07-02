import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.config import settings
from app.db import get_supabase
from app.models.schemas import AttendanceCheckIn, AttendanceRejectBody, AttendanceWebCheckIn
from app.services import attendance as att
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/attendance", tags=["attendance"])
LGU = ("lgu_admin", "lgu_staff", "organizer")
MONITOR = ("lgu_admin", "lgu_staff", "organizer")


@router.get("/events")
def list_attendance_events(
    approved_only: bool = True,
    user: AuthUser = Depends(require_roles(*MONITOR)),
):
    return att.list_monitor_events(user, approved_only=approved_only)


@router.get("/events/{event_id}")
def event_attendance(event_id: str, user: AuthUser = Depends(require_roles(*MONITOR))):
    return att.roster_for_event(event_id, user)


@router.get("/events/{event_id}/summary")
def event_attendance_summary(event_id: str, user: AuthUser = Depends(require_roles(*MONITOR))):
    data = att.roster_for_event(event_id, user)
    return {"event_id": event_id, **data["summary"]}


@router.get("/events/{event_id}/hours")
def event_hours(event_id: str, user: AuthUser = Depends(require_roles(*MONITOR))):
    return att.hours_for_event(event_id, user)


@router.get("/volunteers/{user_id}/hours")
def volunteer_hours(user_id: str, user: AuthUser = Depends(require_roles(*MONITOR))):
    return att.cumulative_hours(user_id)


@router.get("/me")
def my_attendance(user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    records = (
        sb.table("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )
    if not records:
        return {"events": [], "certificates": [], "summary": {"total_events": 0, "verified_events": 0, "total_verified_hours": 0}}

    event_ids = [record["event_id"] for record in records]
    events = (
        sb.table("cleanup_events")
        .select("id,title,barangay,scheduled_start,scheduled_end,approval_status")
        .in_("id", event_ids)
        .execute()
        .data
        or []
    )
    registrations = (
        sb.table("volunteer_registrations")
        .select("event_id,registration_status,created_at")
        .eq("user_id", user.id)
        .in_("event_id", event_ids)
        .execute()
        .data
        or []
    )
    events_by_id = {event["id"]: event for event in events}
    registrations_by_event = {registration["event_id"]: registration for registration in registrations}

    items = []
    certificates = []
    total_verified_hours = 0.0
    for record in records:
        event = events_by_id.get(record["event_id"], {})
        registration = registrations_by_event.get(record["event_id"], {})
        lgu_status = att.status_to_api(record.get("lgu_status"))
        organizer_status = att.status_to_api(record.get("organizer_status"))
        verified_hours = float(record.get("calculated_hours") or 0) if record.get("lgu_status") == "verified" else 0.0
        total_verified_hours += verified_hours
        item = {
            "event_id": record["event_id"],
            "attendance_id": record["id"],
            "title": event.get("title", "Cleanup event"),
            "barangay": event.get("barangay"),
            "scheduled_start": event.get("scheduled_start"),
            "scheduled_end": event.get("scheduled_end"),
            "approval_status": event.get("approval_status"),
            "registration_status": registration.get("registration_status", "registered"),
            "registered_at": registration.get("created_at") or record.get("created_at"),
            "organizer_status": organizer_status,
            "lgu_status": lgu_status,
            "check_in_time": record.get("check_in_time"),
            "check_out_time": record.get("check_out_time"),
            "calculated_hours": float(record.get("calculated_hours") or 0),
            "verified_hours": verified_hours,
            "certificate_available": record.get("lgu_status") == "verified",
        }
        items.append(item)
        if item["certificate_available"]:
            certificates.append({
                "event_id": item["event_id"],
                "title": item["title"],
                "barangay": item["barangay"],
                "service_hours": verified_hours,
                "verified_at": record.get("check_out_time") or record.get("check_in_time") or record.get("created_at"),
            })

    return {
        "events": items,
        "certificates": certificates,
        "summary": {
            "total_events": len(items),
            "verified_events": len(certificates),
            "total_verified_hours": round(total_verified_hours, 2),
        },
    }


@router.get("/events/{event_id}/certificates/{user_id}")
def service_certificate(
    event_id: str,
    user_id: str,
    format: str = "json",
    user: AuthUser = Depends(require_roles(*MONITOR)),
):
    cert = att.build_certificate(event_id, user_id, user)
    if format == "html":
        return HTMLResponse(cert["html"])
    return cert


@router.post("/events/{event_id}/organizer-verify/{target_user_id}")
def organizer_verify(
    event_id: str,
    target_user_id: str,
    user: AuthUser = Depends(require_roles(*MONITOR)),
):
    event = att.get_event(event_id)
    if not att.can_organizer_act(user, event):
        raise HTTPException(403, "Not authorized to verify as organizer")
    _update_status(event_id, target_user_id, "organizer_status", "verified")
    log_audit(user.id, "organizer_verify_attendance", "attendance_record", event_id, {"user_id": target_user_id})
    return {"organizer_status": "verified"}


@router.post("/events/{event_id}/organizer-reject/{target_user_id}")
def organizer_reject(
    event_id: str,
    target_user_id: str,
    body: AttendanceRejectBody | None = None,
    user: AuthUser = Depends(require_roles(*MONITOR)),
):
    event = att.get_event(event_id)
    if not att.can_organizer_act(user, event):
        raise HTTPException(403, "Not authorized to reject as organizer")
    _update_status(event_id, target_user_id, "organizer_status", "rejected")
    log_audit(
        user.id,
        "organizer_reject_attendance",
        "attendance_record",
        event_id,
        {"user_id": target_user_id, "reason": (body.reason if body else None)},
    )
    return {"organizer_status": "rejected"}


@router.post("/events/{event_id}/lgu-verify/{target_user_id}")
def lgu_verify(
    event_id: str,
    target_user_id: str,
    user: AuthUser = Depends(require_roles("lgu_admin", "lgu_staff")),
):
    event = att.get_event(event_id)
    att.require_event_access(user, event)
    _update_status(event_id, target_user_id, "lgu_status", "verified")
    log_audit(user.id, "lgu_verify_attendance", "attendance_record", event_id, {"user_id": target_user_id})
    return {"lgu_status": "verified"}


@router.post("/events/{event_id}/lgu-reject/{target_user_id}")
def lgu_reject(
    event_id: str,
    target_user_id: str,
    body: AttendanceRejectBody | None = None,
    user: AuthUser = Depends(require_roles("lgu_admin", "lgu_staff")),
):
    event = att.get_event(event_id)
    att.require_event_access(user, event)
    _update_status(event_id, target_user_id, "lgu_status", "rejected")
    log_audit(
        user.id,
        "lgu_reject_attendance",
        "attendance_record",
        event_id,
        {"user_id": target_user_id, "reason": (body.reason if body else None)},
    )
    return {"lgu_status": "rejected"}


@router.post("/events/{event_id}/verify/{target_user_id}")
def verify_attendance_legacy(
    event_id: str,
    target_user_id: str,
    user: AuthUser = Depends(require_roles("lgu_admin", "lgu_staff")),
):
    event = att.get_event(event_id)
    att.require_event_access(user, event)
    _update_status(event_id, target_user_id, "lgu_status", "verified")
    log_audit(user.id, "lgu_verify_attendance", "attendance_record", event_id, {"user_id": target_user_id})
    return {"lgu_status": "verified"}


# --- Mobile check-in flow (unchanged) ---

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
    return {"status": "checked-in", "check_in_time": now}


@router.post("/events/{event_id}/web-check-in")
def web_check_in(event_id: str, body: AttendanceWebCheckIn, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    event = sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
    if event.get("approval_status") != "approved":
        raise HTTPException(403, "Check-in is only available for approved events")
    scheduled_end = event.get("scheduled_end")
    if scheduled_end:
        end_dt = datetime.fromisoformat(scheduled_end.replace("Z", "+00:00"))
        if end_dt <= datetime.now(timezone.utc):
            raise HTTPException(400, "This event has ended")
    dist = _haversine(body.latitude, body.longitude, event["latitude"], event["longitude"])
    if dist > settings.attendance_gps_radius_m:
        raise HTTPException(400, f"Too far from event ({dist:.0f}m). Move closer and try again.")
    now = datetime.now(timezone.utc).isoformat()
    sb.table("attendance_records").upsert({
        "event_id": event_id,
        "user_id": user.id,
        "check_in_time": now,
        "check_in_latitude": body.latitude,
        "check_in_longitude": body.longitude,
        "organizer_status": "checked_in",
        "lgu_status": "checked_in",
    }, on_conflict="event_id,user_id").execute()
    return {"status": "checked-in", "check_in_time": now}


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
    return {"status": "checked-out", "calculated_hours": hours}


def _update_status(event_id: str, user_id: str, field: str, status: str) -> None:
    sb = get_supabase()
    existing = (
        sb.table("attendance_records")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(404, "Attendance record not found")
    db_status = att.status_to_db(status)
    sb.table("attendance_records").update({field: db_status}).eq("event_id", event_id).eq("user_id", user_id).execute()


def _haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
