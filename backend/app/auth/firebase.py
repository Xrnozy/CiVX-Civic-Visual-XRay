import os
import json
import time
from dataclasses import dataclass
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import get_supabase

security = HTTPBearer(auto_error=False)

_firebase_initialized = False
_debug_log = Path(__file__).resolve().parents[3] / "debug-8b92e3.log"


def _agent_log(location: str, message: str, data: dict, hypothesis_id: str) -> None:
    try:
        payload = {
            "sessionId": "8b92e3",
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
            "hypothesisId": hypothesis_id,
        }
        with _debug_log.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass


def init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return
    cred_path = settings.resolved_firebase_credentials
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _agent_log(
            "firebase.py:init_firebase",
            "initialized with service account",
            {"cred_path": os.path.basename(cred_path), "project_id": settings.firebase_project_id or getattr(cred, "project_id", "")},
            "H-token",
        )
        _firebase_initialized = True
    elif settings.firebase_project_id:
        firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
        _agent_log(
            "firebase.py:init_firebase",
            "initialized with project id only",
            {"project_id": settings.firebase_project_id},
            "H-token",
        )
        _firebase_initialized = True
    else:
        _agent_log(
            "firebase.py:init_firebase",
            "firebase not configured",
            {},
            "H-token",
        )


def _normalize_bearer_token(raw: str | None) -> str:
    token = (raw or "").strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token


def _looks_like_jwt(token: str) -> bool:
    if not token or token.startswith("{") or token.startswith("["):
        return False
    parts = token.split(".")
    return len(parts) == 3 and all(parts)


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
    if not _firebase_initialized or not firebase_admin._apps:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase auth is not configured on the server",
        )

    token = _normalize_bearer_token(creds.credentials)
    if not _looks_like_jwt(token):
        _agent_log(
            "firebase.py:get_current_user",
            "reject malformed token",
            {"token_prefix": token[:12], "token_len": len(token)},
            "H-token",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        decoded = auth.verify_id_token(token, clock_skew_seconds=60, check_revoked=False)
    except Exception as exc:
        _agent_log(
            "firebase.py:get_current_user",
            "verify_id_token failed",
            {"error_type": type(exc).__name__, "error": str(exc)[:300]},
            "H-token",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    firebase_uid = decoded["uid"]
    email = (decoded.get("email") or "").strip().lower() or None
    _agent_log(
        "firebase.py:get_current_user",
        "token verified",
        {"firebase_uid": firebase_uid[:8], "email_prefix": (email or "")[:3]},
        "H-token",
    )
    name = decoded.get("name") or email or "CiVX User"

    sb = get_supabase()
    result = sb.table("users").select("*").eq("firebase_uid", firebase_uid).limit(1).execute()
    if result.data:
        row = result.data[0]
        _agent_log("firebase.py:get_current_user", "found by firebase_uid", {"userId": row.get("id")}, "H5")
        if (row.get("status") or "active") != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
        role = (row.get("role") or "citizen").strip()
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

    if email:
        email_result = (
            sb.table("users")
            .select("*")
            .ilike("email", email)
            .limit(1)
            .execute()
        )
        if email_result.data:
            row = email_result.data[0]
            if (row.get("status") or "active") != "active":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
            if row.get("firebase_uid") != firebase_uid:
                _agent_log(
                    "firebase.py:get_current_user",
                    "rebinding firebase_uid by email",
                    {"userId": row.get("id"), "oldUid": row.get("firebase_uid")[:8]},
                    "H5",
                )
                sb.table("users").update({
                    "firebase_uid": firebase_uid,
                    "email": email or row.get("email"),
                }).eq("id", row["id"]).execute()
                row["firebase_uid"] = firebase_uid
            role = (row.get("role") or "citizen").strip()
            return AuthUser(
                id=row["id"],
                firebase_uid=firebase_uid,
                email=row.get("email") or email,
                full_name=row.get("full_name") or name,
                role=role,
                registration_completed=bool(row.get("registration_completed_at")),
            )

    default_role = "lgu_staff" if settings.demo_lgu_auto_role else "citizen"
    _agent_log("firebase.py:get_current_user", "inserting new user", {"firebase_uid": firebase_uid[:8], "role": default_role}, "H5")
    try:
        insert = sb.table("users").insert({
            "firebase_uid": firebase_uid,
            "email": email,
            "full_name": name,
            "role": default_role,
        }).execute()
        row = insert.data[0]
        _agent_log("firebase.py:get_current_user", "insert ok", {"userId": row.get("id")}, "H5")
    except Exception as exc:
        _agent_log("firebase.py:get_current_user", "insert failed", {"error": str(exc)[:300]}, "H5")
        retry = sb.table("users").select("*").eq("firebase_uid", firebase_uid).limit(1).execute()
        if retry.data:
            row = retry.data[0]
            role = (row.get("role") or "citizen").strip()
            return AuthUser(
                id=row["id"],
                firebase_uid=firebase_uid,
                email=row.get("email") or email,
                full_name=row.get("full_name") or name,
                role=role,
                registration_completed=bool(row.get("registration_completed_at")),
            )
        raise
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
    try:
        return await get_current_user(creds)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            return None
        raise
