from fastapi import APIRouter, Depends

from app.auth.firebase import AuthUser, get_current_user, require_roles
from app.db import get_supabase
from app.utils.audit import sanitize_incident_public

router = APIRouter(prefix="/api/maps", tags=["maps"])
LGU = ("lgu_admin", "lgu_staff", "field_worker")


@router.get("/markers")
def map_markers(issue_type: str | None = None, status: str | None = None, lgu: bool = False):
    sb = get_supabase()
    q = sb.table("incidents").select("id,primary_issue_type,latitude,longitude,status,severity_score,report_count,barangay")
    if issue_type:
        q = q.eq("primary_issue_type", issue_type)
    if status:
        q = q.eq("status", status)
    elif not lgu:
        q = q.in_("status", ["verified", "assigned", "ongoing", "resolved"])
    incidents = q.limit(500).execute().data or []
    events = sb.table("cleanup_events").select("id,title,latitude,longitude,approval_status,scheduled_start").eq("approval_status", "approved").execute().data or []
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
