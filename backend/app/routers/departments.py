from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, require_roles
from app.db import get_supabase

router = APIRouter(prefix="/api/departments", tags=["departments"])
LGU = ("lgu_admin", "lgu_staff", "field_worker")


@router.get("")
def list_departments(user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    return sb.table("departments").select("id,name,code,description,issue_types").order("name").execute().data or []
