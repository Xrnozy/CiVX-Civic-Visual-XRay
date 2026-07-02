from fastapi import APIRouter, Depends, Query

from app.auth.firebase import AuthUser, require_roles
from app.db import get_supabase
from app.utils.audit import normalize_submitter_type
from app.utils.geocoding import resolve_barangay
from app.utils.storage import resolve_photo_url

router = APIRouter(prefix="/api/maps", tags=["maps"])
LGU = ("lgu_admin", "lgu_staff", "field_worker")


@router.get("/barangay")
def barangay_from_coordinates(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """Reverse-geocode coordinates to a barangay label for cleanup/report forms."""
    label = resolve_barangay(latitude=latitude, longitude=longitude)
    return {"barangay": None if label == "Unknown" else label}


@router.get("/markers")
def map_markers(issue_type: str | None = None, status: str | None = None, lgu: bool = False):
    sb = get_supabase()
    q = sb.table("incidents").select("id,primary_issue_type,latitude,longitude,status,severity_score,report_count,barangay,source,created_at,ai_summary")
    if issue_type:
        q = q.eq("primary_issue_type", issue_type)
    if status:
        q = q.eq("status", status)
    elif not lgu:
        q = q.in_("status", ["verified", "assigned", "ongoing", "resolved"])
    incidents = q.limit(500).execute().data or []

    incidents = [
        incident
        for incident in incidents
        if incident.get("latitude") is not None
        and incident.get("longitude") is not None
        and incident.get("primary_issue_type")
    ]

    preview_by_incident_id: dict[str, dict] = {}
    incident_ids = [incident["id"] for incident in incidents if incident.get("id")]
    if incident_ids:
        linked_reports = (
            sb.table("reports")
            .select("merged_incident_id,photo_url,photo_urls,description,ai_suggested_type,ai_confidence,created_at")
            .in_("merged_incident_id", incident_ids)
            .order("created_at", desc=True)
            .execute()
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

    for incident in incidents:
        incident["submitter_type"] = normalize_submitter_type(incident.get("source"))
        incident.update(preview_by_incident_id.get(incident.get("id"), {}))

    events = (
        sb.table("cleanup_events")
        .select("id,title,latitude,longitude,approval_status,scheduled_start,barangay,banner_url")
        .eq("approval_status", "approved")
        .execute()
        .data
        or []
    )
    for event in events:
        event["preview_photo_url"] = resolve_photo_url(event.get("banner_url"))
    return {
        "incidents": incidents,
        "cleanup_events": events,
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
