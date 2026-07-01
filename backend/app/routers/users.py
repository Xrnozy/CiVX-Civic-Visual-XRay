from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.models.schemas import CompleteRegistration, SetUserRole, UserProfileUpdate
from app.services import registration_invites as invite_svc
from app.utils.audit import log_audit

PUBLIC_WORKER_TYPES = {
    "street_sweeper": "Street sweeper",
    "garbage_collector": "Garbage collector",
    "public_driver": "Public driver",
    "barangay_worker": "Barangay worker",
    "lgu_vehicle_operator": "LGU vehicle operator",
    "patrol": "Patrol / security",
}

router = APIRouter(prefix="/api/users", tags=["users"])

ACCOUNT_TYPE_TO_ROLE = {
    "citizen": "citizen",
    "organizer": "organizer",
    "street_sweeper": "street_sweeper",
}

LGU_TEAM_ROLES = ("lgu_admin", "lgu_staff", "field_worker")
ASSIGNABLE_ROLES = ("lgu_staff", "field_worker", "lgu_admin", "citizen")
USER_LIST_FIELDS = "id, full_name, email, role, barangay, registration_completed_at, created_at"


@router.get("/me")
def get_me(user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    row = sb.table("users").select("*").eq("id", user.id).single().execute().data
    return {
        **row,
        "registration_completed": bool(row.get("registration_completed_at")),
    }


@router.post("/complete-registration")
def complete_registration(body: CompleteRegistration, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    row = sb.table("users").select("*").eq("id", user.id).single().execute().data
    if row.get("registration_completed_at"):
        raise HTTPException(status_code=400, detail="Registration already completed")

    account_type = body.account_type
    if account_type not in ACCOUNT_TYPE_TO_ROLE:
        raise HTTPException(status_code=400, detail="Invalid account type")

    role = ACCOUNT_TYPE_TO_ROLE[account_type]
    invite_id = None

    if account_type == "organizer":
        if not body.organization_name or not body.organization_name.strip():
            raise HTTPException(status_code=400, detail="Organization name is required for community leaders")
    elif account_type == "street_sweeper":
        if not body.invite_token:
            raise HTTPException(status_code=400, detail="Worker invite token is required")
        if not body.public_worker_type or body.public_worker_type not in PUBLIC_WORKER_TYPES:
            raise HTTPException(status_code=400, detail="Public worker type is required")
        invite = invite_svc.validate_invite_for_registration(body.invite_token)
        invite_id = invite["id"]
        role = invite.get("target_role", "street_sweeper")

    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "full_name": body.full_name.strip(),
        "phone_number": body.phone_number.strip(),
        "barangay": body.barangay.strip(),
        "role": role,
        "registration_completed_at": now,
    }
    if body.organization_name:
        updates["organization_name"] = body.organization_name.strip()
    if invite_id:
        updates["invite_id"] = invite_id
        if not body.barangay.strip() and invite.get("barangay"):
            updates["barangay"] = invite["barangay"]
    if body.public_worker_type:
        updates["public_worker_type"] = body.public_worker_type.strip()

    sb.table("users").update(updates).eq("id", user.id).execute()
    if invite_id:
        invite_svc.redeem_invite(invite_id, user.id)

    log_audit(user.id, "complete_registration", "user", user.id, {"role": role, "account_type": account_type})
    updated = sb.table("users").select("*").eq("id", user.id).single().execute().data
    return {
        **updated,
        "registration_completed": True,
    }


@router.patch("/me")
def update_me(body: UserProfileUpdate, user: AuthUser = Depends(get_current_user)):
    sb = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    sb.table("users").update(updates).eq("id", user.id).execute()
    row = sb.table("users").select("*").eq("id", user.id).single().execute().data
    return {
        **row,
        "registration_completed": bool(row.get("registration_completed_at")),
    }


@router.get("/lgu-team")
def list_lgu_team(admin: AuthUser = Depends(require_roles("lgu_admin"))):
    sb = get_supabase()
    rows = (
        sb.table("users")
        .select(USER_LIST_FIELDS)
        .in_("role", list(LGU_TEAM_ROLES))
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return rows or []


@router.get("/lookup")
def lookup_users(email: str, admin: AuthUser = Depends(require_roles("lgu_admin"))):
    query = email.strip()
    if len(query) < 3:
        raise HTTPException(status_code=400, detail="Enter at least 3 characters of an email")
    sb = get_supabase()
    rows = (
        sb.table("users")
        .select(USER_LIST_FIELDS)
        .ilike("email", f"%{query}%")
        .limit(10)
        .execute()
        .data
    )
    return rows or []


@router.post("/{user_id}/role")
def set_role(user_id: str, body: SetUserRole, admin: AuthUser = Depends(require_roles("lgu_admin"))):
    if body.role not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Role must be one of: {', '.join(ASSIGNABLE_ROLES)}",
        )
    if user_id == admin.id and body.role != admin.role:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    sb = get_supabase()
    target = sb.table("users").select("id, email, role").eq("id", user_id).maybe_single().execute().data
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    sb.table("users").update({"role": body.role}).eq("id", user_id).execute()
    log_audit(
        admin.id,
        "set_user_role",
        "user",
        user_id,
        {"previous_role": target.get("role"), "new_role": body.role, "email": target.get("email")},
    )
    return {"user_id": user_id, "role": body.role}
