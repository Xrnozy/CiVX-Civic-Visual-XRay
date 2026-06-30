from fastapi import APIRouter, Depends
from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.models.schemas import UserProfileUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
def get_me(user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    return sb.table("users").select("*").eq("id", user.id).single().execute().data


@router.patch("/me")
def update_me(body: UserProfileUpdate, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    sb.table("users").update(updates).eq("id", user.id).execute()
    return sb.table("users").select("*").eq("id", user.id).single().execute().data


@router.post("/{user_id}/role")
def set_role(user_id: str, role: str, admin: AuthUser = Depends(require_roles("lgu_admin"))):
    sb = get_supabase()
    sb.table("users").update({"role": role}).eq("id", user_id).execute()
    return {"user_id": user_id, "role": role}
