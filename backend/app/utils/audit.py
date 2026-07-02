from datetime import datetime
from typing import Any
from uuid import UUID

from app.db import get_supabase

USER_ROLE_LABELS = {
    "citizen": "Citizen",
    "volunteer": "Volunteer",
    "organizer": "Community leader",
    "lgu_admin": "LGU admin",
    "lgu_staff": "LGU staff",
    "field_worker": "Field worker",
    "driver": "Driver",
    "street_sweeper": "Public worker",
}

PUBLIC_WORKER_TYPE_LABELS = {
    "street_sweeper": "Street sweeper",
    "garbage_collector": "Garbage collector",
    "public_driver": "Public driver",
    "barangay_worker": "Barangay worker",
    "lgu_vehicle_operator": "LGU vehicle operator",
    "patrol": "Patrol / security",
}


def normalize_submitter_type(source: str | None) -> str:
    if source in {"citizen", "passive", "driver"}:
        return "community_member"
    if source and source.startswith("lgu"):
        return "lgu"
    return "community_member"


def format_reporter_role(role: str | None, public_worker_type: str | None = None) -> str:
    if role == "street_sweeper" and public_worker_type:
        return PUBLIC_WORKER_TYPE_LABELS.get(
            public_worker_type,
            public_worker_type.replace("_", " ").title(),
        )
    if role:
        return USER_ROLE_LABELS.get(role, role.replace("_", " ").title())
    return "Unknown"


def log_audit(
    user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    sb = get_supabase()
    sb.table("audit_logs").insert({
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }).execute()


def sanitize_incident_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "primary_issue_type": row["primary_issue_type"],
        "severity_score": row.get("severity_score"),
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "barangay": row.get("barangay"),
        "status": row["status"],
        "report_count": row.get("report_count", 1),
        "source": row.get("source"),
        "submitter_type": normalize_submitter_type(row.get("source")),
        "ai_summary": row.get("ai_summary"),
        "created_at": row.get("created_at"),
        "verified_at": row.get("verified_at"),
        "resolved_at": row.get("resolved_at"),
    }


def sanitize_incident_lgu(row: dict[str, Any]) -> dict[str, Any]:
    data = sanitize_incident_public(row)
    data.update({
        "triage_priority": row.get("triage_priority"),
        "suggested_department_id": row.get("suggested_department_id"),
        "assigned_department_id": row.get("assigned_department_id"),
        "ai_summary": row.get("ai_summary"),
        "verified_at": row.get("verified_at"),
    })
    return data
