import uuid
from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.models.schemas import EcoQuestTaskCreate, EcoQuestSubmit
from app.agents.ecoquest_verification import EcoQuestVerificationAgent

router = APIRouter(prefix="/api/ecoquest", tags=["ecoquest"])
LGU = ("lgu_admin", "lgu_staff")


@router.get("/tasks")
def list_tasks(status: str | None = "open"):
    sb = get_supabase()
    q = sb.table("ecoquest_tasks").select("*")
    if status:
        q = q.eq("status", status)
    return q.order("created_at", desc=True).execute().data


@router.post("/tasks")
def create_task(body: EcoQuestTaskCreate, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    data = body.model_dump()
    if body.latitude and body.longitude:
        data["location"] = f"SRID=4326;POINT({body.longitude} {body.latitude})"
    data["qr_code_token"] = str(uuid.uuid4())
    return sb.table("ecoquest_tasks").insert(data).execute().data[0]


@router.post("/tasks/{task_id}/submit")
def submit_task(task_id: str, body: EcoQuestSubmit, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    data = body.model_dump()
    if body.latitude and body.longitude:
        data["check_in_location"] = f"SRID=4326;POINT({body.longitude} {body.latitude})"
    data["task_id"] = task_id
    data["user_id"] = user.id
    row = sb.table("ecoquest_submissions").insert(data).execute().data[0]
    agent = EcoQuestVerificationAgent()
    verification = agent.verify_submission(row["id"])
    return {"submission": row, "verification": verification}


@router.post("/submissions/{submission_id}/approve")
def approve_submission(submission_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    sb.table("ecoquest_submissions").update({
        "verification_status": "approved",
        "reward_eligible": True,
    }).eq("id", submission_id).execute()
    return {"status": "approved"}
