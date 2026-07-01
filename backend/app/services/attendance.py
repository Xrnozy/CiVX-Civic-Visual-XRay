import math
from typing import Any

from fastapi import HTTPException

from app.auth.firebase import AuthUser
from app.config import settings
from app.db import get_supabase

LGU_ROLES = ("lgu_admin", "lgu_staff")
MONITOR_ROLES = ("lgu_admin", "lgu_staff", "organizer")

STATUS_API_TO_DB = {
    "registered": "registered",
    "checked-in": "checked_in",
    "checked-out": "checked_out",
    "verified": "verified",
    "rejected": "rejected",
}
STATUS_DB_TO_API = {v: k for k, v in STATUS_API_TO_DB.items()}


def status_to_api(db_status: str | None) -> str:
    if not db_status:
        return "registered"
    return STATUS_DB_TO_API.get(db_status, db_status.replace("_", "-"))


def status_to_db(api_status: str) -> str:
    if api_status in STATUS_API_TO_DB:
        return STATUS_API_TO_DB[api_status]
    return api_status.replace("-", "_")


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def get_event(event_id: str) -> dict[str, Any]:
    sb = get_supabase()
    result = sb.table("cleanup_events").select("*").eq("id", event_id).limit(1).execute()
    if not result.data:
        raise HTTPException(404, "Event not found")
    return result.data[0]


def can_access_event(user: AuthUser, event: dict[str, Any]) -> bool:
    if user.role in LGU_ROLES:
        return True
    if user.role == "organizer" and event.get("organizer_user_id") == user.id:
        return True
    return False


def require_event_access(user: AuthUser, event: dict[str, Any]) -> None:
    if user.role not in MONITOR_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    if not can_access_event(user, event):
        raise HTTPException(403, "Not authorized for this event")


def can_view_pii(user: AuthUser, event: dict[str, Any]) -> bool:
    if user.role == "lgu_admin":
        return True
    if user.role == "organizer" and event.get("organizer_user_id") == user.id:
        return True
    return False


def can_organizer_act(user: AuthUser, event: dict[str, Any]) -> bool:
    return user.role == "lgu_admin" or (
        user.role == "organizer" and event.get("organizer_user_id") == user.id
    )


def can_lgu_act(user: AuthUser) -> bool:
    return user.role in LGU_ROLES


def gps_valid(record: dict[str, Any], event: dict[str, Any]) -> bool | None:
    lat, lng = record.get("check_in_latitude"), record.get("check_in_longitude")
    if lat is None or lng is None:
        return None
    dist = haversine_m(lat, lng, event["latitude"], event["longitude"])
    return dist <= settings.attendance_gps_radius_m


def qr_valid(record: dict[str, Any], event: dict[str, Any]) -> bool | None:
    qr = record.get("qr_code_id")
    if not qr:
        return None
    return qr == event.get("qr_code_token")


def verified_hours(record: dict[str, Any]) -> float:
    if record.get("lgu_status") != "verified":
        return 0.0
    return float(record.get("calculated_hours") or 0)


def build_volunteer_row(
    record: dict[str, Any],
    registration: dict[str, Any] | None,
    event: dict[str, Any],
    user: AuthUser,
) -> dict[str, Any]:
    show_pii = can_view_pii(user, event)
    reg = registration or {}
    row: dict[str, Any] = {
        "user_id": record["user_id"],
        "attendance_id": record["id"],
        "full_name": reg.get("full_name") or "Volunteer",
        "barangay": reg.get("barangay"),
        "organizer_status": status_to_api(record.get("organizer_status")),
        "lgu_status": status_to_api(record.get("lgu_status")),
        "check_in_time": record.get("check_in_time"),
        "check_out_time": record.get("check_out_time"),
        "check_in_latitude": record.get("check_in_latitude"),
        "check_in_longitude": record.get("check_in_longitude"),
        "gps_valid": gps_valid(record, event),
        "qr_valid": qr_valid(record, event),
        "selfie_url": record.get("selfie_url"),
        "calculated_hours": float(record.get("calculated_hours") or 0),
        "verified_hours": verified_hours(record),
        "registered_at": reg.get("created_at"),
    }
    if show_pii:
        row["phone_number"] = reg.get("phone_number")
        row["emergency_contact"] = reg.get("emergency_contact")
    return row


def event_permissions(user: AuthUser, event: dict[str, Any]) -> dict[str, bool]:
    return {
        "can_view_pii": can_view_pii(user, event),
        "can_organizer_verify": can_organizer_act(user, event),
        "can_lgu_verify": can_lgu_act(user),
    }


def summarize_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {s: 0 for s in STATUS_API_TO_DB}
    total_verified_hours = 0.0
    total = len(records)
    for rec in records:
        status = status_to_api(rec.get("lgu_status"))
        counts[status] = counts.get(status, 0) + 1
        total_verified_hours += verified_hours(rec)
    checked = counts.get("checked-in", 0) + counts.get("checked-out", 0) + counts.get("verified", 0)
    return {
        "total_volunteers": total,
        "by_status": counts,
        "checked_in_percent": round((checked / total) * 100, 1) if total else 0,
        "total_verified_hours": round(total_verified_hours, 2),
    }


def fetch_event_records(event_id: str) -> list[dict[str, Any]]:
    sb = get_supabase()
    return sb.table("attendance_records").select("*").eq("event_id", event_id).execute().data or []


def fetch_registrations(event_id: str) -> dict[str, dict[str, Any]]:
    sb = get_supabase()
    rows = sb.table("volunteer_registrations").select("*").eq("event_id", event_id).execute().data or []
    return {r["user_id"]: r for r in rows}


def list_monitor_events(user: AuthUser, approved_only: bool = True) -> list[dict[str, Any]]:
    sb = get_supabase()
    q = sb.table("cleanup_events").select(
        "id,title,barangay,scheduled_start,scheduled_end,approval_status,organizer_user_id"
    )
    if approved_only:
        q = q.eq("approval_status", "approved")
    if user.role == "organizer":
        q = q.eq("organizer_user_id", user.id)
    events = q.order("scheduled_start", desc=True).limit(100).execute().data or []
    if not events:
        return []

    event_ids = [e["id"] for e in events]
    records = (
        sb.table("attendance_records")
        .select("event_id,lgu_status,calculated_hours")
        .in_("event_id", event_ids)
        .execute()
        .data
        or []
    )
    by_event: dict[str, list[dict[str, Any]]] = {eid: [] for eid in event_ids}
    for rec in records:
        by_event.setdefault(rec["event_id"], []).append(rec)

    result = []
    for event in events:
        summary = summarize_records(by_event.get(event["id"], []))
        result.append({**event, **summary})
    return result


def roster_for_event(event_id: str, user: AuthUser) -> dict[str, Any]:
    event = get_event(event_id)
    require_event_access(user, event)
    records = fetch_event_records(event_id)
    registrations = fetch_registrations(event_id)
    volunteers = [
        build_volunteer_row(rec, registrations.get(rec["user_id"]), event, user)
        for rec in records
    ]
    volunteers.sort(key=lambda v: v.get("full_name", ""))
    return {
        "event": {
            "id": event["id"],
            "title": event["title"],
            "barangay": event.get("barangay"),
            "scheduled_start": event.get("scheduled_start"),
            "scheduled_end": event.get("scheduled_end"),
            "approval_status": event.get("approval_status"),
            "organizer_user_id": event.get("organizer_user_id"),
        },
        "permissions": event_permissions(user, event),
        "summary": summarize_records(records),
        "volunteers": volunteers,
    }


def hours_for_event(event_id: str, user: AuthUser) -> dict[str, Any]:
    data = roster_for_event(event_id, user)
    hours = [
        {
            "user_id": v["user_id"],
            "full_name": v["full_name"],
            "barangay": v.get("barangay"),
            "lgu_status": v["lgu_status"],
            "calculated_hours": v["calculated_hours"],
            "verified_hours": v["verified_hours"],
        }
        for v in data["volunteers"]
    ]
    return {
        "event_id": event_id,
        "total_verified_hours": data["summary"]["total_verified_hours"],
        "volunteers": hours,
    }


def cumulative_hours(user_id: str) -> dict[str, Any]:
    sb = get_supabase()
    records = (
        sb.table("attendance_records")
        .select("event_id,calculated_hours,lgu_status")
        .eq("user_id", user_id)
        .eq("lgu_status", "verified")
        .execute()
        .data
        or []
    )
    total = sum(float(r.get("calculated_hours") or 0) for r in records)
    return {
        "user_id": user_id,
        "verified_events": len(records),
        "total_verified_hours": round(total, 2),
    }


def build_certificate(
    event_id: str,
    user_id: str,
    verifier: AuthUser,
) -> dict[str, Any]:
    event = get_event(event_id)
    require_event_access(verifier, event)
    sb = get_supabase()
    rec = (
        sb.table("attendance_records")
        .select("*")
        .eq("event_id", event_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not rec.data:
        raise HTTPException(404, "Attendance record not found")
    record = rec.data[0]
    if record.get("lgu_status") != "verified":
        raise HTTPException(400, "Certificate available only for LGU-verified attendance")

    reg_rows = (
        sb.table("volunteer_registrations")
        .select("*")
        .eq("event_id", event_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    reg = reg_rows[0] if reg_rows else {}
    hours = float(record.get("calculated_hours") or 0)
    volunteer_name = reg.get("full_name") or "Volunteer"
    event_title = event.get("title", "Cleanup Event")
    start = event.get("scheduled_start", "")[:10]
    end = event.get("scheduled_end", "")[:10]

    record_data = {
        "volunteer_name": volunteer_name,
        "event_title": event_title,
        "event_id": event_id,
        "barangay": reg.get("barangay") or event.get("barangay"),
        "service_hours": hours,
        "check_in_time": record.get("check_in_time"),
        "check_out_time": record.get("check_out_time"),
        "verified_by": verifier.full_name,
        "verified_status": status_to_api(record.get("lgu_status")),
    }
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Service Hour Certificate</title>
<style>
body {{ font-family: Georgia, serif; max-width: 640px; margin: 40px auto; padding: 24px; }}
h1 {{ font-size: 1.5rem; text-align: center; }}
.cert {{ border: 2px solid #1a5f4a; padding: 32px; }}
.meta {{ margin-top: 24px; line-height: 1.6; }}
.sig {{ margin-top: 48px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 0.9rem; }}
</style></head><body>
<div class="cert">
<h1>Certificate of Volunteer Service</h1>
<p>This certifies that <strong>{volunteer_name}</strong> participated in
<strong>{event_title}</strong> ({start}{f" – {end}" if end != start else ""})
and completed <strong>{hours:.2f}</strong> verified service hour(s).</p>
<div class="meta">
<p>Barangay: {record_data["barangay"] or "N/A"}</p>
<p>Check-in: {record.get("check_in_time") or "—"}</p>
<p>Check-out: {record.get("check_out_time") or "—"}</p>
</div>
<div class="sig">Verified by {verifier.full_name} · CiVX Civic Visual X-Ray</div>
</div></body></html>"""
    return {"record": record_data, "html": html}
