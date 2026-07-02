from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, require_roles
from app.db import get_supabase

router = APIRouter(prefix="/api/external-partners", tags=["external-partners"])
LGU = ("lgu_admin", "lgu_staff")


@router.get("")
def search_external_partners(q: str = "", user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    query = sb.table("external_partners").select("id, name, created_at").order("name")
    term = q.strip()
    if term:
        query = query.ilike("name", f"%{term}%")
    return query.limit(20).execute().data or []
