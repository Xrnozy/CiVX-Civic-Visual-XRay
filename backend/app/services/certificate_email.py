from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.auth.firebase import AuthUser
from app.db import get_supabase
from app.services import attendance as att
from app.services.email import send_email


def can_send_certificate(user: AuthUser, event: dict[str, Any]) -> bool:
    return user.role == "organizer" and event.get("organizer_user_id") == user.id


def require_send_certificate(user: AuthUser, event: dict[str, Any]) -> None:
    if not can_send_certificate(user, event):
        raise HTTPException(403, "Only the event organizer may send certificates")


def _volunteer_email(user_id: str) -> str | None:
    emails = att.fetch_user_emails([user_id])
    email = emails.get(user_id)
    if email and str(email).strip():
        return str(email).strip()
    return None


def send_certificate_email(
    event_id: str,
    user_id: str,
    sender: AuthUser,
    *,
    force: bool = False,
) -> dict[str, Any]:
    event = att.get_event(event_id)
    require_send_certificate(sender, event)

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

    if record.get("organizer_status") != "verified":
        raise HTTPException(400, "Certificate available only after tracker checkout is complete")

    if record.get("certificate_sent_at") and not force:
        return {
            "user_id": user_id,
            "sent": False,
            "skipped": True,
            "reason": "already_sent",
            "certificate_sent_at": record.get("certificate_sent_at"),
            "certificate_sent_to": record.get("certificate_sent_to"),
        }

    email = _volunteer_email(user_id)
    if not email:
        return {
            "user_id": user_id,
            "sent": False,
            "skipped": True,
            "reason": "no_email",
        }

    cert = att.build_certificate(event_id, user_id, sender)
    volunteer_name = cert["record"]["volunteer_name"]
    event_title = cert["record"]["event_title"]
    subject = f"Your volunteer certificate — {event_title}"

    result = send_email(
        to=email,
        subject=subject,
        html=cert["html"],
        metadata={"event_id": event_id, "user_id": user_id, "volunteer_name": volunteer_name},
    )

    now = datetime.now(timezone.utc).isoformat()
    sb.table("attendance_records").update({
        "certificate_sent_at": now,
        "certificate_sent_to": email,
    }).eq("id", record["id"]).execute()

    return {
        "user_id": user_id,
        "sent": True,
        "email": email,
        "certificate_sent_at": now,
        "mode": result.get("mode", "mock"),
    }


def batch_send_certificates(event_id: str, sender: AuthUser) -> dict[str, Any]:
    event = att.get_event(event_id)
    require_send_certificate(sender, event)

    records = att.fetch_event_records(event_id)
    eligible = [r for r in records if r.get("organizer_status") == "verified" and not r.get("certificate_sent_at")]

    sent: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for record in eligible:
        outcome = send_certificate_email(event_id, record["user_id"], sender)
        if outcome.get("sent"):
            sent.append(outcome)
        else:
            skipped.append(outcome)

    return {
        "event_id": event_id,
        "sent_count": len(sent),
        "skipped_count": len(skipped),
        "sent": sent,
        "skipped": skipped,
    }


def maybe_auto_send_certificate(event_id: str, user_id: str) -> None:
    """Fire-and-forget auto-send after checkout when enabled on the event."""
    try:
        event = att.get_event(event_id)
        if not event.get("auto_send_certificates", True):
            return
        sb = get_supabase()
        org_rows = (
            sb.table("users")
            .select("id, full_name, email")
            .eq("id", event.get("organizer_user_id"))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not org_rows:
            return
        org = org_rows[0]
        sender = AuthUser(
            id=org["id"],
            firebase_uid="",
            email=org.get("email"),
            full_name=org.get("full_name") or "Event Organizer",
            role="organizer",
        )
        send_certificate_email(event_id, user_id, sender)
    except Exception:
        pass
