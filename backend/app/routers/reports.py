from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.agents.report_intake import ReportIntakeAgent
from app.db import get_supabase
from app.models.schemas import ReportCreate
from app.utils.audit import log_audit

router = APIRouter(prefix="/api/reports", tags=["reports"])
limiter = Limiter(key_func=get_remote_address)


@router.post("")
async def create_report(
    background_tasks: BackgroundTasks,
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str | None = Form(None),
    issue_type: str | None = Form(None),
    barangay: str | None = Form(None),
    photo: UploadFile | None = File(None),
    photo_url: str | None = Form(None),
    user: AuthUser = Depends(get_current_user),
):
    photo_bytes = await photo.read() if photo else b""
    agent = ReportIntakeAgent()
    result = agent.process(
        user_id=user.id,
        photo_bytes=photo_bytes,
        latitude=latitude,
        longitude=longitude,
        description=description,
        issue_type=issue_type,
        barangay=barangay,
        photo_url=photo_url,
    )
    log_audit(user.id, "create_report", "report", result["report"]["id"], {"merged": result["merged"]})
    return result


@router.get("")
def list_reports(user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    if user.role in ("lgu_admin", "lgu_staff", "field_worker"):
        data = sb.table("reports").select("*").order("created_at", desc=True).limit(100).execute().data
    else:
        data = sb.table("reports").select("*").eq("reporter_user_id", user.id).order("created_at", desc=True).execute().data
    return data


@router.get("/{report_id}")
def get_report(report_id: str, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    return sb.table("reports").select("*").eq("id", report_id).single().execute().data


@router.post("/{report_id}/support")
def support_report(report_id: str, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    original = sb.table("reports").select("*").eq("id", report_id).single().execute().data
    agent = ReportIntakeAgent()
    return agent.process(
        user_id=user.id,
        photo_bytes=b"",
        latitude=original["latitude"],
        longitude=original["longitude"],
        description=f"Supported report {report_id}",
        issue_type=original["issue_type"],
        photo_url=original["photo_url"],
    )
