import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.auth.firebase import AuthUser, get_current_user
from app.config import settings
from app.db import get_supabase
from app.services import attendance as att
from app.services.attendance import EVENT_PHOTO_UPLOAD_BLOCKED_ROLES
from app.utils.storage import parse_supabase_storage_url

router = APIRouter(prefix="/api/cleanup-events", tags=["event-photos"])


class EventPhotoVisibilityUpdate(BaseModel):
    hidden: bool = True


def update_photo_visibility(event_id: str, photo_id: str, hidden: bool, user: AuthUser):
    event = att.get_event(event_id)
    if not att.can_moderate_event_photos(user, event):
        raise HTTPException(403, "Not authorized to moderate event photos")

    sb = get_supabase()
    existing = (
        sb.table("event_photos")
        .select("id,event_id")
        .eq("id", photo_id)
        .eq("event_id", event_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not existing:
        existing = (
            sb.table("event_photos")
            .select("id,event_id")
            .eq("id", photo_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if existing and existing[0].get("event_id") != event_id:
            raise HTTPException(404, "Photo not found for this event")
    if not existing:
        raise HTTPException(404, "Photo not found")

    row = (
        sb.table("event_photos")
        .update({"hidden": hidden})
        .eq("id", photo_id)
        .execute()
        .data[0]
    )
    return row


@router.get("/{event_id}/photos")
def list_event_photos(event_id: str, user: AuthUser = Depends(get_current_user)):
    event = att.get_event(event_id)
    can_moderate = att.can_moderate_event_photos(user, event)
    can_unhide = can_moderate
    sb = get_supabase()
    rows = (
        sb.table("event_photos")
        .select("id,event_id,uploaded_by,image_url,hidden,created_at")
        .eq("event_id", event_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    if not can_moderate:
        rows = [row for row in rows if not row.get("hidden")]
    return {
        "photos": rows,
        "can_upload": att.can_upload_event_photo(event_id, user),
        "can_moderate": can_moderate,
        "can_unhide": can_unhide,
    }


@router.post("/{event_id}/photos")
async def upload_event_photo(
    event_id: str,
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    event = att.get_event(event_id)
    if user.role in EVENT_PHOTO_UPLOAD_BLOCKED_ROLES:
        raise HTTPException(403, "LGU accounts cannot upload event photos")
    if event.get("approval_status") != "approved":
        raise HTTPException(
            403,
            "Photos can be uploaded only after the event is approved",
        )
    if not att.can_upload_event_photo(event_id, user):
        raise HTTPException(
            403,
            "Not authorized to upload photos for this event",
        )

    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Invalid file type")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10 MB)")

    ext = "jpg"
    if file.content_type == "image/png":
        ext = "png"
    elif file.content_type == "image/webp":
        ext = "webp"
    elif file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    bucket = settings.supabase_event_photos_bucket
    key = f"{event_id}/{user.id}/{uuid.uuid4().hex}.{ext}"
    sb = get_supabase()
    sb.storage.from_(bucket).upload(key, content, {"content-type": file.content_type})
    image_url = sb.storage.from_(bucket).get_public_url(key)

    row = (
        sb.table("event_photos")
        .insert(
            {
                "event_id": event_id,
                "uploaded_by": user.id,
                "image_url": image_url,
                "hidden": False,
            }
        )
        .execute()
        .data[0]
    )
    return row


@router.patch("/{event_id}/photos/{photo_id}")
def hide_event_photo(
    event_id: str,
    photo_id: str,
    body: EventPhotoVisibilityUpdate = EventPhotoVisibilityUpdate(),
    hidden: bool | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
):
    next_hidden = body.hidden if hidden is None else hidden
    return update_photo_visibility(event_id, photo_id, next_hidden, user)


@router.delete("/{event_id}/photos/{photo_id}")
def delete_event_photo(
    event_id: str,
    photo_id: str,
    user: AuthUser = Depends(get_current_user),
):
    event = att.get_event(event_id)
    if not att.can_moderate_event_photos(user, event):
        raise HTTPException(403, "Not authorized to moderate event photos")

    sb = get_supabase()
    existing = (
        sb.table("event_photos")
        .select("id,image_url")
        .eq("id", photo_id)
        .eq("event_id", event_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not existing:
        raise HTTPException(404, "Photo not found")

    photo = existing[0]
    parsed = parse_supabase_storage_url(photo.get("image_url"))
    if parsed:
        bucket, path = parsed
        try:
            sb.storage.from_(bucket).remove([path])
        except Exception:
            pass

    sb.table("event_photos").delete().eq("id", photo_id).execute()
    return {"deleted": True, "id": photo_id}
