import uuid
from fastapi import APIRouter, Depends, UploadFile, File

from app.auth.firebase import AuthUser, get_current_user
from app.db import get_supabase

router = APIRouter(prefix="/api/media", tags=["media"])


@router.post("/upload")
async def upload_media(
    bucket: str = "report-photos",
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    allowed = {"image/jpeg", "image/png", "image/webp", "video/mp4"}
    if file.content_type not in allowed:
        from fastapi import HTTPException
        raise HTTPException(400, "Invalid file type")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(400, "File too large")
    key = f"{user.id}/{uuid.uuid4().hex}"
    ext = "jpg" if "jpeg" in (file.content_type or "") else file.filename.split(".")[-1]
    key = f"{key}.{ext}"
    sb = get_supabase()
    sb.storage.from_(bucket).upload(key, content, {"content-type": file.content_type})
    url = sb.storage.from_(bucket).get_public_url(key)
    return {"url": url, "bucket": bucket, "key": key}
