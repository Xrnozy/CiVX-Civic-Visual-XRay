from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.utils.audit import log_audit, sanitize_incident_lgu
from app.utils.dispatch_routing import incident_status_for_dispatch, recommend_department
from app.utils.storage import resolve_photo_url

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])
CHECKER = ("field_checker",)
LGU = ("lgu_admin", "lgu_staff", "field_worker")
LGU_OR_CHECKER = CHECKER + LGU


def _assignment_for_checker(sb, assignment_id: str, user: AuthUser) -> dict:
    row = (
        sb.table("dispatch_assignments")
        .select("*")
        .eq("id", assignment_id)
        .maybe_single()
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if user.role == "field_checker" and row.get("checker_user_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    return row


def _enrich_case(sb, assignment: dict) -> dict:
    incident = (
        sb.table("incidents")
        .select("*")
        .eq("id", assignment["incident_id"])
        .single()
        .execute()
        .data
    )
    reports = (
        sb.table("reports")
        .select("id, issue_type, description, photo_url, photo_urls, ai_suggested_type, ai_confidence, created_at, address_text")
        .eq("merged_incident_id", assignment["incident_id"])
        .order("created_at")
        .execute()
        .data
        or []
    )
    for r in reports:
        urls = r.get("photo_urls")
        if isinstance(urls, list) and urls:
            r["photo_url"] = resolve_photo_url(urls[0])
        elif r.get("photo_url"):
            r["photo_url"] = resolve_photo_url(r["photo_url"])

    dept = (
        sb.table("departments")
        .select("id, name, code")
        .eq("id", assignment["department_id"])
        .maybe_single()
        .execute()
        .data
    )
    activity = (
        sb.table("dispatch_activity_log")
        .select("*")
        .eq("dispatch_assignment_id", assignment["id"])
        .order("created_at")
        .execute()
        .data
        or []
    )
    checker = None
    if assignment.get("checker_user_id"):
        checker = (
            sb.table("users")
            .select("id, full_name, email")
            .eq("id", assignment["checker_user_id"])
            .maybe_single()
            .execute()
            .data
        )

    return {
        "assignment": {
            **assignment,
            "before_photo_url": resolve_photo_url(assignment.get("before_photo_url")),
            "after_photo_url": resolve_photo_url(assignment.get("after_photo_url")),
        },
        "incident": sanitize_incident_lgu(incident) if incident else None,
        "reports": reports,
        "department": dept,
        "checker": checker,
        "activity": activity,
        "recommendation": recommend_department(incident.get("primary_issue_type") if incident else None),
    }


@router.get("/cases")
def list_my_cases(
    status: str | None = None,
    user: AuthUser = Depends(require_roles(*CHECKER)),
):
    sb = get_supabase()
    q = (
        sb.table("dispatch_assignments")
        .select("*, incidents(id, primary_issue_type, status, latitude, longitude, barangay, severity_score, report_count, created_at)")
        .eq("checker_user_id", user.id)
    )
    if status:
        q = q.eq("dispatch_status", status)
    rows = q.order("assigned_at", desc=True).limit(100).execute().data or []
    return rows


@router.get("/cases/{assignment_id}")
def get_case(assignment_id: str, user: AuthUser = Depends(require_roles(*LGU_OR_CHECKER))):
    sb = get_supabase()
    assignment = _assignment_for_checker(sb, assignment_id, user)
    return _enrich_case(sb, assignment)


@router.patch("/cases/{assignment_id}/status")
def update_case_status(
    assignment_id: str,
    dispatch_status: str = Form(...),
    notes: str | None = Form(None),
    user: AuthUser = Depends(require_roles(*CHECKER)),
):
    sb = get_supabase()
    assignment = _assignment_for_checker(sb, assignment_id, user)
    valid = {"assigned", "on_the_way", "checking_site", "verified", "needs_action", "resolved"}
    if dispatch_status not in valid:
        raise HTTPException(status_code=400, detail="Invalid dispatch status")

    updates: dict = {"dispatch_status": dispatch_status}
    if notes:
        updates["checker_notes"] = notes
    if dispatch_status == "resolved":
        updates["completed_at"] = datetime.now(timezone.utc).isoformat()

    sb.table("dispatch_assignments").update(updates).eq("id", assignment_id).execute()
    sb.table("dispatch_activity_log").insert({
        "dispatch_assignment_id": assignment_id,
        "actor_user_id": user.id,
        "dispatch_status": dispatch_status,
        "notes": notes,
    }).execute()

    incident_status = incident_status_for_dispatch(dispatch_status)
    sb.table("incidents").update({
        "status": incident_status,
        **({"resolved_at": datetime.now(timezone.utc).isoformat()} if dispatch_status == "resolved" else {}),
    }).eq("id", assignment["incident_id"]).execute()

    log_audit(user.id, "dispatch_status", "dispatch_assignment", assignment_id, {"status": dispatch_status})
    return {"dispatch_status": dispatch_status, "incident_status": incident_status}


@router.post("/cases/{assignment_id}/photos")
async def upload_verification_photo(
    assignment_id: str,
    photo_type: str = Form(...),
    photo: UploadFile = File(...),
    user: AuthUser = Depends(require_roles(*CHECKER)),
):
    if photo_type not in ("before", "after"):
        raise HTTPException(status_code=400, detail="photo_type must be before or after")

    sb = get_supabase()
    assignment = _assignment_for_checker(sb, assignment_id, user)
    content = await photo.read()
    ext = "jpg"
    if photo.filename and "." in photo.filename:
        ext = photo.filename.rsplit(".", 1)[-1]
    key = f"dispatch/{assignment_id}/{photo_type}_{datetime.now(timezone.utc).timestamp():.0f}.{ext}"
    sb.storage.from_("report-photos").upload(key, content, {"content-type": photo.content_type or "image/jpeg"})
    public_url = sb.storage.from_("report-photos").get_public_url(key)

    field = "before_photo_url" if photo_type == "before" else "after_photo_url"
    sb.table("dispatch_assignments").update({field: public_url}).eq("id", assignment_id).execute()
    sb.table("dispatch_activity_log").insert({
        "dispatch_assignment_id": assignment_id,
        "actor_user_id": user.id,
        "notes": f"Uploaded {photo_type} verification photo",
        "photo_url": public_url,
    }).execute()
    log_audit(user.id, f"dispatch_{photo_type}_photo", "dispatch_assignment", assignment_id, {})
    return {"photo_url": resolve_photo_url(public_url), "photo_type": photo_type}


@router.get("/checkers")
def list_field_checkers(user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    return (
        sb.table("users")
        .select("id, full_name, email, checker_department_id, role")
        .eq("role", "field_checker")
        .order("full_name")
        .execute()
        .data
        or []
    )
