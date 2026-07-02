from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase import AuthUser, get_current_user, require_roles, get_optional_user
from app.db import get_supabase
from app.models.schemas import IncidentUpdate
from app.utils.audit import log_audit, sanitize_incident_public, sanitize_incident_lgu, normalize_submitter_type
from app.utils.geocoding import resolve_barangay
from app.utils.storage import resolve_photo_url, resolve_photo_urls
from app.agents.lgu_triage import LGUTriageAgent

from app.utils.dispatch_routing import recommend_department

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
LGU = ("lgu_admin", "lgu_staff", "field_worker")


def _barangay_from_reports(sb, incident_id: str, incident: dict) -> str:
    reports = (
        sb.table("reports")
        .select("address_text")
        .eq("merged_incident_id", incident_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    address_text = next(
        (r["address_text"] for r in reports if r.get("address_text") and r["address_text"].strip()),
        None,
    )
    return resolve_barangay(
        address_text=address_text,
        latitude=incident.get("latitude"),
        longitude=incident.get("longitude"),
    )


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
    incident = sb.table("incidents").select("id,status,source,verified_at").eq("id", incident_id).single().execute().data
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
    incident_source = incident.get("source")
    incident_status = incident.get("status")
    signed_reports = []
    for report in reports:
        signed = {
            **report,
            "submitter_type": submitter_type,
            "source": incident_source,
            "incident_status": incident_status,
            "photo_url": resolve_photo_url(report.get("photo_url")),
            "photo_urls": resolve_photo_urls(report.get("photo_urls") if isinstance(report.get("photo_urls"), list) else []),
        }
        signed_reports.append(signed)
    return signed_reports


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
        incident = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
        updates["barangay"] = _barangay_from_reports(sb, incident_id, incident)
    if "status" in updates and updates["status"] == "resolved":
        updates["resolved_at"] = "now()"
    sb.table("incidents").update(updates).eq("id", incident_id).execute()
    log_audit(user.id, "update_incident", "incident", incident_id, updates)
    return sb.table("incidents").select("*").eq("id", incident_id).single().execute().data


@router.post("/{incident_id}/verify")
def verify_incident(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    incident = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
    barangay = _barangay_from_reports(sb, incident_id, incident)
    sb.table("incidents").update({
        "status": "verified",
        "verified_at": "now()",
        "barangay": barangay,
    }).eq("id", incident_id).execute()
    log_audit(user.id, "verify", "incident", incident_id, {"barangay": barangay})
    return {"status": "verified", "barangay": barangay}


@router.post("/{incident_id}/reject")
def reject_incident(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("incidents").update({"status": "archived"}).eq("id", incident_id).execute()
    log_audit(user.id, "reject", "incident", incident_id, {})
    return {"status": "archived"}


@router.get("/{incident_id}/dispatch-recommendation")
def dispatch_recommendation(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    incident = sb.table("incidents").select("primary_issue_type").eq("id", incident_id).single().execute().data
    return recommend_department(incident.get("primary_issue_type"))


@router.get("/{incident_id}/dispatch-status")
def incident_dispatch_status(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    assignment = (
        sb.table("dispatch_assignments")
        .select("*")
        .eq("incident_id", incident_id)
        .order("assigned_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    activity = []
    row = assignment[0] if assignment else None
    if row:
        activity = (
            sb.table("dispatch_activity_log")
            .select("*")
            .eq("dispatch_assignment_id", row["id"])
            .order("created_at")
            .execute()
            .data
            or []
        )
        if row.get("checker_user_id"):
            checker = (
                sb.table("users")
                .select("id, full_name, email")
                .eq("id", row["checker_user_id"])
                .maybe_single()
                .execute()
                .data
            )
            row = {**row, "checker": checker}
    return {"assignment": row, "activity": activity}


@router.post("/{incident_id}/dispatch-checker")
def dispatch_to_checker(
    incident_id: str,
    checker_user_id: str = Query(...),
    department_id: str | None = Query(None),
    user: AuthUser = Depends(require_roles(*LGU)),
):
    sb = get_supabase()
    incident = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
    rec = recommend_department(incident.get("primary_issue_type"))
    dept_id = department_id or rec.get("department_id")
    if not dept_id:
        raise HTTPException(status_code=400, detail="No department available")

    checker = sb.table("users").select("id, role").eq("id", checker_user_id).single().execute().data
    if checker.get("role") != "field_checker":
        raise HTTPException(status_code=400, detail="User is not a field checker")

    sb.table("incidents").update({
        "assigned_department_id": dept_id,
        "status": "assigned",
    }).eq("id", incident_id).execute()

    assignment = (
        sb.table("dispatch_assignments")
        .insert({
            "incident_id": incident_id,
            "department_id": dept_id,
            "checker_user_id": checker_user_id,
            "assigned_by_user_id": user.id,
            "dispatch_status": "assigned",
            "priority": incident.get("triage_priority") or 0,
        })
        .execute()
        .data[0]
    )
    sb.table("dispatch_activity_log").insert({
        "dispatch_assignment_id": assignment["id"],
        "actor_user_id": user.id,
        "dispatch_status": "assigned",
        "notes": f"Assigned to field checker for {rec.get('dispatch_label', 'site inspection')}",
    }).execute()
    sb.table("department_assignments").insert({
        "incident_id": incident_id,
        "department_id": dept_id,
        "assigned_by_user_id": user.id,
        "assigned_to_user_id": checker_user_id,
        "status": "assigned",
    }).execute()
    log_audit(user.id, "dispatch_checker", "incident", incident_id, {
        "checker_user_id": checker_user_id,
        "department_id": dept_id,
    })
    return {"status": "assigned", "assignment_id": assignment["id"], "recommendation": rec}


@router.post("/{incident_id}/dispatch")
def dispatch_incident(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    """Legacy dispatch — marks ongoing if assignment exists."""
    sb = get_supabase()
    existing = (
        sb.table("dispatch_assignments")
        .select("id")
        .eq("incident_id", incident_id)
        .limit(1)
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(
            status_code=400,
            detail="Assign a field checker first using dispatch-checker",
        )
    sb.table("incidents").update({"status": "ongoing"}).eq("id", incident_id).execute()
    sb.table("dispatch_assignments").update({"dispatch_status": "on_the_way"}).eq("id", existing[0]["id"]).execute()
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
