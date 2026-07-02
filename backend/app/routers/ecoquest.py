import uuid
from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.models.schemas import EcoQuestPartyEntry, EcoQuestTaskCreate, EcoQuestSubmit, EcoQuestTaskUpdate
from app.agents.ecoquest_verification import EcoQuestVerificationAgent
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/ecoquest", tags=["ecoquest"])
LGU = ("lgu_admin", "lgu_staff")


def _party_rows(task_id: str, party_role: str, entries: list[EcoQuestPartyEntry]) -> list[dict]:
    rows = []
    for index, entry in enumerate(entries):
        row = {
            "task_id": task_id,
            "party_role": party_role,
            "entry_type": entry.type,
            "sort_order": index,
            "user_id": None,
            "external_partner_id": None,
            "manual_name": None,
        }
        if entry.type == "user":
            row["user_id"] = entry.ref_id
        elif entry.type == "external":
            row["external_partner_id"] = entry.ref_id
        else:
            row["manual_name"] = entry.name.strip()
        rows.append(row)
    return rows


@router.get("/tasks")
def list_tasks(status: str | None = None):
    sb = get_supabase()
    q = sb.table("ecoquest_tasks").select("*")
    if status:
        q = q.eq("status", status)
    return q.order("created_at", desc=True).execute().data


@router.get("/tasks/{task_id}")
def get_task(task_id: str):
    sb = get_supabase()
    return sb.table("ecoquest_tasks").select("*").eq("id", task_id).single().execute().data


@router.post("/tasks")
def create_task(body: EcoQuestTaskCreate, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    data = body.model_dump(exclude={"collaborators", "sponsors"})
    if body.latitude and body.longitude:
        data["location"] = f"SRID=4326;POINT({body.longitude} {body.latitude})"
    data["qr_code_token"] = str(uuid.uuid4())
    row = sb.table("ecoquest_tasks").insert(data).execute().data[0]
    task_id = row["id"]
    party_rows = (
        _party_rows(task_id, "collaborator", body.collaborators)
        + _party_rows(task_id, "sponsor", body.sponsors)
    )
    if party_rows:
        sb.table("ecoquest_task_party_entries").insert(party_rows).execute()
    log_audit(user.id, "create_ecoquest_task", "ecoquest_task", task_id, {"title": body.title})
    return row


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, body: EcoQuestTaskUpdate, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    if not data:
        return sb.table("ecoquest_tasks").select("*").eq("id", task_id).single().execute().data
    sb.table("ecoquest_tasks").update(data).eq("id", task_id).execute()
    log_audit(user.id, "update_ecoquest_task", "ecoquest_task", task_id, data)
    return sb.table("ecoquest_tasks").select("*").eq("id", task_id).single().execute().data


@router.get("/submissions")
def list_submissions(
    verification_status: str | None = None,
    task_id: str | None = None,
    user: AuthUser = Depends(require_roles(*LGU)),
):
    sb = get_supabase()
    q = sb.table("ecoquest_submissions").select(
        "*, ecoquest_tasks(*), users(id, full_name, email, barangay)"
    )
    if verification_status:
        q = q.eq("verification_status", verification_status)
    if task_id:
        q = q.eq("task_id", task_id)
    return q.order("created_at", desc=True).limit(100).execute().data


@router.post("/tasks/{task_id}/submit")
def submit_task(task_id: str, body: EcoQuestSubmit, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    data = body.model_dump()
    if body.latitude and body.longitude:
        data["check_in_location"] = f"SRID=4326;POINT({body.longitude} {body.latitude})"
    data["task_id"] = task_id
    data["user_id"] = user.id
    row = sb.table("ecoquest_submissions").insert(data).execute().data[0]
    sb.table("ecoquest_tasks").update({"status": "pending_review"}).eq("id", task_id).execute()
    agent = EcoQuestVerificationAgent()
    verification = agent.verify_submission(row["id"])
    if verification["verification_status"] == "approved":
        sb.table("ecoquest_tasks").update({"status": "approved"}).eq("id", task_id).execute()
    return {"submission": row, "verification": verification}


@router.post("/submissions/{submission_id}/approve")
def approve_submission(submission_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sub = sb.table("ecoquest_submissions").select("task_id").eq("id", submission_id).single().execute().data
    sb.table("ecoquest_submissions").update({
        "verification_status": "approved",
        "verification_notes": "Approved by LGU",
        "reward_eligible": True,
    }).eq("id", submission_id).execute()
    sb.table("ecoquest_tasks").update({"status": "approved"}).eq("id", sub["task_id"]).execute()
    log_audit(user.id, "approve_ecoquest_submission", "ecoquest_submission", submission_id, {})
    return {"status": "approved"}


@router.post("/submissions/{submission_id}/reject")
def reject_submission(submission_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sub = sb.table("ecoquest_submissions").select("task_id").eq("id", submission_id).single().execute().data
    sb.table("ecoquest_submissions").update({
        "verification_status": "rejected",
        "verification_notes": "Rejected by LGU",
        "reward_eligible": False,
    }).eq("id", submission_id).execute()
    sb.table("ecoquest_tasks").update({"status": "rejected"}).eq("id", sub["task_id"]).execute()
    log_audit(user.id, "reject_ecoquest_submission", "ecoquest_submission", submission_id, {})
    return {"status": "rejected"}
