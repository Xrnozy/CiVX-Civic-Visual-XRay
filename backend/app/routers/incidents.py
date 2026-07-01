from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase import AuthUser, get_current_user, require_roles, get_optional_user
from app.db import get_supabase
from app.models.schemas import IncidentUpdate
from app.utils.audit import log_audit, sanitize_incident_public, sanitize_incident_lgu, normalize_submitter_type
from app.agents.lgu_triage import LGUTriageAgent

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
LGU = ("lgu_admin", "lgu_staff", "field_worker")


@router.get("/public")
def list_public_incidents(status: str | None = None, issue_type: str | None = None):
    sb = get_supabase()
    q = sb.table("incidents").select("*")
    if status:
        q = q.eq("status", status)
    else:
        q = q.in_("status", ["verified", "assigned", "ongoing", "resolved"])
    if issue_type:
        q = q.eq("primary_issue_type", issue_type)
    data = q.order("created_at", desc=True).limit(500).execute().data or []
    return [sanitize_incident_public(r) for r in data]


@router.get("")
def list_incidents(
    status: str | None = None,
    issue_type: str | None = None,
    barangay: str | None = None,
    source: str | None = None,
    user: AuthUser = Depends(require_roles(*LGU)),
):
    sb = get_supabase()
    q = sb.table("incidents").select("*")
    if status:
        q = q.eq("status", status)
    if issue_type:
        q = q.eq("primary_issue_type", issue_type)
    if barangay:
        q = q.ilike("barangay", f"%{barangay}%")
    if source:
        q = q.eq("source", source)
    data = q.order("triage_priority", desc=True).limit(200).execute().data or []
    return [sanitize_incident_lgu(r) for r in data]


@router.get("/{incident_id}/reports")
def list_incident_reports(incident_id: str, user: AuthUser | None = Depends(get_optional_user)):
    sb = get_supabase()
    incident = sb.table("incidents").select("id,status,source").eq("id", incident_id).single().execute().data
    can_view_all = bool(user and user.role in LGU)
    if not can_view_all and incident["status"] not in {"verified", "assigned", "ongoing", "resolved"}:
        raise HTTPException(status_code=403, detail="Not allowed")

    reports = (
        sb.table("reports")
        .select("id,issue_type,description,photo_url,photo_urls,ai_suggested_type,ai_confidence,ai_bounding_box,ai_severity_score,status,created_at,reporter_user_id,latitude,longitude,address_text")
        .eq("merged_incident_id", incident_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    submitter_type = normalize_submitter_type(incident.get("source"))
    return [{**report, "submitter_type": submitter_type} for report in reports]


@router.get("/{incident_id}")
def get_incident(incident_id: str, user: AuthUser | None = Depends(get_optional_user)):
    sb = get_supabase()
    row = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
    if user and user.role in LGU:
        return sanitize_incident_lgu(row)
    return sanitize_incident_public(row)


@router.patch("/{incident_id}")
def update_incident(
    incident_id: str,
    body: IncidentUpdate,
    user: AuthUser = Depends(require_roles(*LGU)),
):
    sb = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "status" in updates and updates["status"] == "verified":
        updates["verified_at"] = "now()"
    if "status" in updates and updates["status"] == "resolved":
        updates["resolved_at"] = "now()"
    sb.table("incidents").update(updates).eq("id", incident_id).execute()
    log_audit(user.id, "update_incident", "incident", incident_id, updates)
    return sb.table("incidents").select("*").eq("id", incident_id).single().execute().data


@router.post("/{incident_id}/verify")
def verify_incident(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("incidents").update({"status": "verified", "verified_at": "now()"}).eq("id", incident_id).execute()
    log_audit(user.id, "verify", "incident", incident_id, {})
    return {"status": "verified"}


@router.post("/{incident_id}/reject")
def reject_incident(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("incidents").update({"status": "archived"}).eq("id", incident_id).execute()
    log_audit(user.id, "reject", "incident", incident_id, {})
    return {"status": "archived"}


@router.post("/{incident_id}/dispatch")
def dispatch_incident(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("incidents").update({"status": "ongoing"}).eq("id", incident_id).execute()
    log_audit(user.id, "dispatch", "incident", incident_id, {})
    return {"status": "ongoing"}


@router.post("/{incident_id}/assign")
def assign_department(
    incident_id: str,
    department_id: str = Query(...),
    user: AuthUser = Depends(require_roles(*LGU)),
):
    sb = get_supabase()
    sb.table("incidents").update({
        "assigned_department_id": department_id,
        "status": "assigned",
    }).eq("id", incident_id).execute()
    sb.table("department_assignments").insert({
        "incident_id": incident_id,
        "department_id": department_id,
        "assigned_by_user_id": user.id,
        "status": "assigned",
    }).execute()
    log_audit(user.id, "assign", "incident", incident_id, {"department_id": department_id})
    return {"status": "assigned"}


@router.post("/{incident_id}/triage")
def retriage(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    agent = LGUTriageAgent()
    return agent.apply_triage(incident_id)
