import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.config import settings
from app.db import get_supabase
from app.models.schemas import (
    AttendanceCheckIn,
    AttendanceCheckOut,
    AttendanceRejectBody,
    AttendanceWebCheckIn,
    AttendanceWebCheckOut,
    CertificateSettingsBody,
)
from app.services import attendance as att
from app.services import certificate_email as cert_email
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
        verified_hours = float(record.get("calculated_hours") or 0) if record.get("organizer_status") == "verified" else 0.0
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
            "tracker_status": att.tracker_status(record),
            "check_in_time": record.get("check_in_time"),
            "check_out_time": record.get("check_out_time"),
            "calculated_hours": float(record.get("calculated_hours") or 0),
            "verified_hours": verified_hours,
            "certificate_available": record.get("organizer_status") == "verified",
            "certificate_sent_at": record.get("certificate_sent_at"),
            "certificate_sent_to": record.get("certificate_sent_to"),
        }
        items.append(item)
        if item["certificate_available"]:
            certificates.append({
                "event_id": item["event_id"],
                "title": item["title"],
                "barangay": item["barangay"],
                "service_hours": verified_hours,
                "verified_at": record.get("check_out_time") or record.get("check_in_time") or record.get("created_at"),
                "certificate_sent_at": record.get("certificate_sent_at"),
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
    user: AuthUser = Depends(require_roles("organizer", "lgu_admin")),
):
    cert = att.build_certificate(event_id, user_id, user)
    if format == "html":
        return HTMLResponse(cert["html"])
    return cert


@router.post("/events/{event_id}/certificates/{user_id}/send")
def send_certificate(
    event_id: str,
    user_id: str,
    force: bool = False,
    user: AuthUser = Depends(require_roles("organizer")),
):
    return cert_email.send_certificate_email(event_id, user_id, user, force=force)


@router.post("/events/{event_id}/certificates/batch-send")
def batch_send_certificates(
    event_id: str,
    user: AuthUser = Depends(require_roles("organizer")),
):
    return cert_email.batch_send_certificates(event_id, user)


@router.patch("/events/{event_id}/certificate-settings")
def update_certificate_settings(
    event_id: str,
    body: CertificateSettingsBody,
    user: AuthUser = Depends(require_roles("organizer")),
):
    event = att.get_event(event_id)
    cert_email.require_send_certificate(user, event)
    sb = get_supabase()
    sb.table("cleanup_events").update({
        "auto_send_certificates": body.auto_send_certificates,
    }).eq("id", event_id).execute()
    return {"event_id": event_id, "auto_send_certificates": body.auto_send_certificates}


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
    _require_check_in_open(event)
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
    event = att.resolve_checkout_token(
        sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
    )
    _require_check_in_open(event)
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


@router.post("/events/{event_id}/web-check-out")
def web_check_out(event_id: str, body: AttendanceWebCheckOut, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    event = att.resolve_checkout_token(
        sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
    )
    _require_checkout_open(event, body.qr_code_id)
    dist = _haversine(body.latitude, body.longitude, event["latitude"], event["longitude"])
    if dist > settings.attendance_gps_radius_m:
        raise HTTPException(400, f"Too far from event ({dist:.0f}m). Move closer and try again.")
    rec = (
        sb.table("attendance_records")
        .select("*")
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
        .data
    )
    if not rec:
        raise HTTPException(400, "You must check in before checking out")
    record = rec[0]
    if record.get("check_out_time"):
        raise HTTPException(400, "You have already checked out")
    now = datetime.now(timezone.utc)
    check_in = _parse_dt(record["check_in_time"])
    hours = round((now - check_in).total_seconds() / 3600, 2)
    _finalize_checkout(sb, record["id"], event_id, user.id, now, hours)
    return {"status": "checked-out", "calculated_hours": hours, "check_out_time": now.isoformat()}


@router.post("/events/{event_id}/check-out")
def check_out(
    event_id: str,
    body: AttendanceCheckOut | None = None,
    user: AuthUser = Depends(get_current_user),
):
    sb = get_supabase()
    event = att.resolve_checkout_token(
        sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
    )
    checkout_token = event.get("checkout_qr_code_token")
    if checkout_token:
        qr_code_id = body.qr_code_id if body else None
        if not qr_code_id or qr_code_id != checkout_token:
            raise HTTPException(400, "Invalid checkout QR code")
    rec = sb.table("attendance_records").select("*").eq("event_id", event_id).eq("user_id", user.id).single().execute().data
    if rec.get("check_out_time"):
        raise HTTPException(400, "You have already checked out")
    now = datetime.now(timezone.utc)
    check_in = _parse_dt(rec["check_in_time"])
    hours = round((now - check_in).total_seconds() / 3600, 2)
    _finalize_checkout(sb, rec["id"], event_id, user.id, now, hours)
    return {"status": "checked-out", "calculated_hours": hours}


def _finalize_checkout(
    sb,
    record_id: str,
    event_id: str,
    user_id: str,
    now: datetime,
    hours: float,
) -> None:
    sb.table("attendance_records").update({
        "check_out_time": now.isoformat(),
        "calculated_hours": hours,
        "organizer_status": "verified",
        "lgu_status": "checked_out",
    }).eq("id", record_id).execute()
    cert_email.maybe_auto_send_certificate(event_id, user_id)


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


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _require_check_in_open(event: dict) -> None:
    if event.get("approval_status") != "approved":
        raise HTTPException(403, "Check-in is only available for approved events")
    if event.get("checkout_qr_code_token"):
        raise HTTPException(400, "Check-in is closed. Use the checkout QR to check out.")
    scheduled_start = event.get("scheduled_start")
    if scheduled_start and _parse_dt(scheduled_start) > datetime.now(timezone.utc):
        raise HTTPException(400, "Check-in opens when the event starts")
    scheduled_end = event.get("scheduled_end")
    if scheduled_end and _parse_dt(scheduled_end) <= datetime.now(timezone.utc):
        raise HTTPException(400, "This event has ended")


def _require_checkout_open(event: dict, qr_code_id: str) -> None:
    token = event.get("checkout_qr_code_token")
    if not token:
        raise HTTPException(400, "Checkout is not open for this event yet")
    if token != qr_code_id:
        raise HTTPException(400, "Invalid checkout QR code")
