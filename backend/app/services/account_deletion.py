"""Cascade-delete a CiVX user account and all owned/participation data."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from firebase_admin import auth as firebase_auth

from app.auth.firebase import init_firebase
from app.config import settings
from app.db import get_supabase
from app.utils.storage import delete_storage_folder, delete_storage_object, delete_storage_objects


def _collect_photo_urls(*values: str | None, photo_urls: list | None = None) -> list[str]:
    urls: list[str] = []
    for value in values:
        if value:
            urls.append(value)
    if photo_urls:
        for item in photo_urls:
            if isinstance(item, str) and item:
                urls.append(item)
    return urls


def _delete_event_bundle(sb, event: dict, summary: dict[str, int]) -> None:
    event_id = event["id"]
    photos = (
        sb.table("event_photos")
        .select("image_url")
        .eq("event_id", event_id)
        .execute()
        .data
        or []
    )
    delete_storage_objects([photo.get("image_url") for photo in photos])
    delete_storage_objects(
        _collect_photo_urls(
            event.get("before_photo_url"),
            event.get("after_photo_url"),
            event.get("banner_url"),
        )
    )
    sb.table("cleanup_events").delete().eq("id", event_id).execute()
    summary["cleanup_events"] += 1


def _delete_orphan_incidents(sb, incident_ids: set[str], summary: dict[str, int]) -> None:
    for incident_id in incident_ids:
        if not incident_id:
            continue
        remaining = (
            sb.table("reports")
            .select("id")
            .eq("merged_incident_id", incident_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if remaining:
            count = (
                sb.table("reports")
                .select("id", count="exact")
                .eq("merged_incident_id", incident_id)
                .execute()
            )
            report_count = getattr(count, "count", None)
            if report_count is None:
                report_count = len(
                    sb.table("reports")
                    .select("id")
                    .eq("merged_incident_id", incident_id)
                    .execute()
                    .data
                    or []
                )
            sb.table("incidents").update({"report_count": report_count}).eq("id", incident_id).execute()
            continue

        sb.table("cleanup_events").update({"issue_or_incident_id": None}).eq(
            "issue_or_incident_id", incident_id
        ).execute()
        sb.table("detection_results").delete().eq("incident_id", incident_id).execute()
        sb.table("road_anomaly_events").update({"incident_id": None}).eq(
            "incident_id", incident_id
        ).execute()
        sb.table("incidents").delete().eq("id", incident_id).execute()
        summary["incidents"] += 1


def _delete_passive_sessions(sb, user_id: str, summary: dict[str, int]) -> None:
    sessions = (
        sb.table("passive_route_sessions")
        .select("id")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    for session in sessions:
        chunks = (
            sb.table("video_chunks")
            .select("storage_url")
            .eq("route_session_id", session["id"])
            .execute()
            .data
            or []
        )
        delete_storage_objects([chunk.get("storage_url") for chunk in chunks])
        delete_storage_folder("video-chunks", session["id"])
        summary["passive_route_sessions"] += 1
    if sessions:
        sb.table("passive_route_sessions").delete().eq("user_id", user_id).execute()


def delete_user_account(user_id: str, *, actor_id: str | None = None) -> dict[str, Any]:
    sb = get_supabase()
    target = sb.table("users").select("*").eq("id", user_id).maybe_single().execute().data
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if actor_id and actor_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account from the LGU console")

    if target.get("role") == "lgu_admin":
        admin_count = (
            sb.table("users")
            .select("id", count="exact")
            .eq("role", "lgu_admin")
            .execute()
        )
        total_admins = getattr(admin_count, "count", None)
        if total_admins is None:
            total_admins = len(
                sb.table("users").select("id").eq("role", "lgu_admin").execute().data or []
            )
        if total_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last LGU admin account")

    summary = {
        "reports": 0,
        "incidents": 0,
        "cleanup_events": 0,
        "volunteer_registrations": 0,
        "attendance_records": 0,
        "ecoquest_submissions": 0,
        "event_photos": 0,
        "passive_route_sessions": 0,
        "passive_clip_jobs": 0,
        "dispatch_assignments": 0,
        "registration_invites": 0,
    }
    storage_urls: list[str] = _collect_photo_urls(
        target.get("profile_photo_url"),
        target.get("organization_logo_url"),
    )

    organized_events = (
        sb.table("cleanup_events")
        .select("id,before_photo_url,after_photo_url,banner_url")
        .eq("organizer_user_id", user_id)
        .execute()
        .data
        or []
    )
    for event in organized_events:
        _delete_event_bundle(sb, event, summary)

    uploaded_photos = (
        sb.table("event_photos")
        .select("id,image_url")
        .eq("uploaded_by", user_id)
        .execute()
        .data
        or []
    )
    for photo in uploaded_photos:
        delete_storage_object(photo.get("image_url"))
        sb.table("event_photos").delete().eq("id", photo["id"]).execute()
        summary["event_photos"] += 1

    volunteer_rows = (
        sb.table("volunteer_registrations")
        .delete()
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    summary["volunteer_registrations"] = len(volunteer_rows)

    attendance_rows = (
        sb.table("attendance_records")
        .select("selfie_url")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    storage_urls.extend(row.get("selfie_url") for row in attendance_rows if row.get("selfie_url"))
    deleted_attendance = (
        sb.table("attendance_records")
        .delete()
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    summary["attendance_records"] = len(deleted_attendance)

    ecoquest_rows = (
        sb.table("ecoquest_submissions")
        .select("before_photo_url,after_photo_url")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    for row in ecoquest_rows:
        storage_urls.extend(
            _collect_photo_urls(row.get("before_photo_url"), row.get("after_photo_url"))
        )
    deleted_ecoquest = (
        sb.table("ecoquest_submissions")
        .delete()
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    summary["ecoquest_submissions"] = len(deleted_ecoquest)

    dispatch_assignments = (
        sb.table("dispatch_assignments")
        .select("id,before_photo_url,after_photo_url")
        .or_(f"assigned_by_user_id.eq.{user_id},checker_user_id.eq.{user_id}")
        .execute()
        .data
        or []
    )
    for assignment in dispatch_assignments:
        storage_urls.extend(
            _collect_photo_urls(
                assignment.get("before_photo_url"),
                assignment.get("after_photo_url"),
            )
        )
    sb.table("dispatch_assignments").update({"checker_user_id": None}).eq(
        "checker_user_id", user_id
    ).execute()
    deleted_dispatch = (
        sb.table("dispatch_assignments")
        .delete()
        .eq("assigned_by_user_id", user_id)
        .execute()
        .data
        or []
    )
    summary["dispatch_assignments"] = len(deleted_dispatch)

    dispatch_logs = (
        sb.table("dispatch_activity_log")
        .select("photo_url")
        .eq("actor_user_id", user_id)
        .execute()
        .data
        or []
    )
    storage_urls.extend(row.get("photo_url") for row in dispatch_logs if row.get("photo_url"))
    sb.table("dispatch_activity_log").delete().eq("actor_user_id", user_id).execute()

    sb.table("department_assignments").delete().eq("assigned_by_user_id", user_id).execute()
    sb.table("department_assignments").update({"assigned_to_user_id": None}).eq(
        "assigned_to_user_id", user_id
    ).execute()
    sb.table("ai_corrections").delete().eq("corrected_by_user_id", user_id).execute()

    deleted_jobs = (
        sb.table("passive_clip_jobs")
        .delete()
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    summary["passive_clip_jobs"] = len(deleted_jobs)
    sb.table("passive_capture_sessions").delete().eq("user_id", user_id).execute()
    _delete_passive_sessions(sb, user_id, summary)

    reports = (
        sb.table("reports")
        .select("id,merged_incident_id,photo_url,photo_urls")
        .eq("reporter_user_id", user_id)
        .execute()
        .data
        or []
    )
    incident_ids = {report.get("merged_incident_id") for report in reports if report.get("merged_incident_id")}
    for report in reports:
        storage_urls.extend(_collect_photo_urls(report.get("photo_url"), photo_urls=report.get("photo_urls")))
        sb.table("detection_results").delete().eq("report_id", report["id"]).execute()
    if reports:
        sb.table("reports").delete().eq("reporter_user_id", user_id).execute()
        summary["reports"] = len(reports)
    _delete_orphan_incidents(sb, incident_ids, summary)

    sb.table("registration_invites").update({"used_by": None}).eq("used_by", user_id).execute()
    deleted_invites = (
        sb.table("registration_invites")
        .delete()
        .eq("created_by", user_id)
        .execute()
        .data
        or []
    )
    summary["registration_invites"] = len(deleted_invites)

    sb.table("audit_logs").update({"user_id": None}).eq("user_id", user_id).execute()
    sb.table("users").update({"invite_id": None}).eq("id", user_id).execute()

    delete_storage_objects(storage_urls)
    delete_storage_folder(settings.supabase_report_photos_bucket, user_id)

    firebase_uid = target.get("firebase_uid")
    sb.table("users").delete().eq("id", user_id).execute()

    if firebase_uid:
        try:
            init_firebase()
            firebase_auth.delete_user(firebase_uid)
        except Exception:
            pass

    return {
        "deleted_user_id": user_id,
        "email": target.get("email"),
        "full_name": target.get("full_name"),
        "summary": summary,
    }
