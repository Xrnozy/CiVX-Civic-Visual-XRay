from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.auth.firebase import AuthUser, require_roles
from app.db import execute_logged, get_supabase
from app.utils.audit import normalize_submitter_type
from app.utils.geocoding import resolve_address_fields, resolve_barangay, reverse_geocode_address
from app.utils.storage import resolve_photo_url
from app.services.passive_evidence_reports import resolve_evidence_photo_url

router = APIRouter(prefix="/api/maps", tags=["maps"])
LGU = ("lgu_admin", "lgu_staff", "field_worker")

HIDDEN_INCIDENT_STATUSES = frozenset({"resolved", "archived"})


def _parse_dt(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _cleanup_event_map_visible(event: dict) -> bool:
    if event.get("checkout_qr_code_token"):
        return False
    if event.get("completed_at"):
        return False
    scheduled_end = event.get("scheduled_end")
    if scheduled_end and _parse_dt(scheduled_end) <= datetime.now(timezone.utc):
        return False
    return True

@router.get("/barangay")
def barangay_from_coordinates(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """Reverse-geocode coordinates to a barangay label for cleanup/report forms."""
    label = resolve_barangay(latitude=latitude, longitude=longitude)
    return {"barangay": None if label == "Unknown" else label}


@router.get("/address")
def address_from_coordinates(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """Reverse-geocode coordinates to barangay, street, city, and province."""
    resolved = reverse_geocode_address(latitude, longitude)
    return resolved.to_api_dict()


@router.get("/markers")
def map_markers(issue_type: str | None = None, status: str | None = None, lgu: bool = False):
    sb = get_supabase()
    q = sb.table("incidents").select("id,primary_issue_type,latitude,longitude,status,severity_score,report_count,barangay,source,created_at,ai_summary")
    if issue_type:
        q = q.eq("primary_issue_type", issue_type)
    if status:
        q = q.eq("status", status)
    elif not lgu:
        q = q.in_("status", ["verified", "assigned", "ongoing"])
    incidents = execute_logged("incidents", q.limit(500), "H3").data or []

    incidents = [
        incident
        for incident in incidents
        if incident.get("latitude") is not None
        and incident.get("longitude") is not None
        and incident.get("primary_issue_type")
        and incident.get("status") not in HIDDEN_INCIDENT_STATUSES
    ]

    preview_by_incident_id: dict[str, dict] = {}
    incident_ids = [incident["id"] for incident in incidents if incident.get("id")]
    if incident_ids:
        linked_reports = (
            execute_logged(
                "reports_by_incident",
                sb.table("reports")
                .select("merged_incident_id,photo_url,photo_urls,description,ai_suggested_type,ai_confidence,created_at")
                .in_("merged_incident_id", incident_ids)
                .order("created_at", desc=True),
                "H3",
            )
            .data
            or []
        )
        for report in linked_reports:
            incident_id = report.get("merged_incident_id")
            if not incident_id or incident_id in preview_by_incident_id:
                continue
            all_urls = report.get("photo_urls")
            first_gallery_url = all_urls[0] if isinstance(all_urls, list) and all_urls else None
            preview_by_incident_id[incident_id] = {
                "preview_photo_url": resolve_photo_url(first_gallery_url or report.get("photo_url")),
                "preview_description": report.get("description"),
                "preview_ai_suggested_type": report.get("ai_suggested_type"),
                "preview_ai_confidence": report.get("ai_confidence"),
                "preview_created_at": report.get("created_at"),
            }

        missing_preview_ids = [iid for iid in incident_ids if iid not in preview_by_incident_id]
        if missing_preview_ids:
            passive_evidence = (
                execute_logged(
                    "passive_evidence",
                    sb.table("passive_evidence")
                    .select("id,incident_id,evidence_url,frame_path,ai_label,ai_confidence,created_at")
                    .in_("incident_id", missing_preview_ids)
                    .order("created_at", desc=True),
                    "H3",
                )
                .data
                or []
            )
            for ev in passive_evidence:
                incident_id = ev.get("incident_id")
                if not incident_id or incident_id in preview_by_incident_id:
                    continue
                photo_url = resolve_evidence_photo_url(
                    ev["id"],
                    ev.get("evidence_url"),
                    ev.get("frame_path"),
                )
                if not photo_url:
                    continue
                preview_by_incident_id[incident_id] = {
                    "preview_photo_url": resolve_photo_url(photo_url),
                    "preview_description": f"Passive evidence ({ev.get('ai_label', 'detection')})",
                    "preview_ai_suggested_type": ev.get("ai_label"),
                    "preview_ai_confidence": ev.get("ai_confidence"),
                    "preview_created_at": ev.get("created_at"),
                }

    for incident in incidents:
        incident["submitter_type"] = normalize_submitter_type(incident.get("source"))
        incident.update(preview_by_incident_id.get(incident.get("id"), {}))

    events = [
        event
        for event in (
            execute_logged(
                "cleanup_events",
                sb.table("cleanup_events")
                .select(
                    "id,title,latitude,longitude,approval_status,scheduled_start,scheduled_end,"
                    "barangay,banner_url,checkout_qr_code_token,completed_at"
                )
                .eq("approval_status", "approved"),
                "H3",
            )
            .data
            or []
        )
        if _cleanup_event_map_visible(event)
    ]
    for event in events:
        event["preview_photo_url"] = resolve_photo_url(event.get("banner_url"))

    ecoquest_tasks = [
        task
        for task in (
            execute_logged(
                "ecoquest_tasks",
                sb.table("ecoquest_tasks")
                .select("id,title,latitude,longitude,barangay,task_type,status,reward_type")
                .eq("status", "open"),
                "H3",
            )
            .data
            or []
        )
        if task.get("latitude") is not None and task.get("longitude") is not None
    ]

    return {
        "incidents": incidents,
        "cleanup_events": events,
        "ecoquest_tasks": ecoquest_tasks,
    }


@router.get("/heatmap")
def heatmap(user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    data = sb.table("incidents").select("latitude,longitude,severity_score,primary_issue_type").not_.in_("status", ["archived"]).execute().data or []
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r["longitude"], r["latitude"]]},
        "properties": {"weight": r.get("severity_score") or 1, "type": r["primary_issue_type"]},
    } for r in data]
    return {"type": "FeatureCollection", "features": features}
