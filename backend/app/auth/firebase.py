import os
from dataclasses import dataclass
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import get_supabase

security = HTTPBearer(auto_error=False)

_firebase_initialized = False


def init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return
    cred_path = settings.resolved_firebase_credentials
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    elif settings.firebase_project_id:
        firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
    _firebase_initialized = True


@dataclass
class AuthUser:
    id: str
    firebase_uid: str
    email: str | None
    full_name: str
    role: str
    registration_completed: bool = False


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth token")
    init_firebase()
    try:
        decoded = auth.verify_id_token(creds.credentials)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    firebase_uid = decoded["uid"]
    email = decoded.get("email")
    name = decoded.get("name") or email or "CiVX User"

    sb = get_supabase()
    result = sb.table("users").select("*").eq("firebase_uid", firebase_uid).limit(1).execute()
    if result.data:
        row = result.data[0]
        role = row.get("role", "citizen")
        if settings.demo_lgu_auto_role and role == "citizen":
            sb.table("users").update({"role": "lgu_staff"}).eq("id", row["id"]).execute()
            role = "lgu_staff"
        return AuthUser(
            id=row["id"],
            firebase_uid=firebase_uid,
            email=row.get("email") or email,
            full_name=row.get("full_name") or name,
            role=role,
            registration_completed=bool(row.get("registration_completed_at")),
        )

    default_role = "lgu_staff" if settings.demo_lgu_auto_role else "citizen"
    insert = sb.table("users").insert({
        "firebase_uid": firebase_uid,
        "email": email,
        "full_name": name,
        "role": default_role,
    }).execute()
    row = insert.data[0]
    return AuthUser(
        id=row["id"],
        firebase_uid=firebase_uid,
        email=email,
        full_name=name,
        role=default_role,
        registration_completed=False,
    )


def require_roles(*roles: str):
    async def checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


def require_registration_complete(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not user.registration_completed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration not completed")
    return user


async def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser | None:
    if not creds:
        return None
    return await get_current_user(creds)
