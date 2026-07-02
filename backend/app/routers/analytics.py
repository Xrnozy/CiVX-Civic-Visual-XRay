from fastapi import APIRouter, Depends, Query
import httpx

from app.auth.firebase import AuthUser, require_roles
from app.config import settings
from app.db import get_supabase
from app.services.analytics import (
    build_by_barangay,
    build_density,
    build_resolved_history,
    build_response_times,
    build_summary,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
LGU = ("lgu_admin", "lgu_staff")


@router.get("/summary")
def analytics_summary(user: AuthUser = Depends(require_roles(*LGU))):
    return build_summary()


@router.get("/by-barangay")
def analytics_by_barangay(
    barangay: str | None = None,
    issue_type: str | None = None,
    status: str | None = None,
    user: AuthUser = Depends(require_roles(*LGU)),
):
    return build_by_barangay(barangay=barangay, issue_type=issue_type, status=status)


@router.get("/response-times")
def analytics_response_times(
    bucket: str = Query("none", pattern="^(none|weekly)$"),
    user: AuthUser = Depends(require_roles(*LGU)),
):
    return build_response_times(bucket=bucket)


@router.get("/resolved-history")
def analytics_resolved_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    barangay: str | None = None,
    issue_type: str | None = None,
    department_id: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    sort: str = "-resolved_at",
    user: AuthUser = Depends(require_roles(*LGU)),
):
    return build_resolved_history(
        page=page,
        page_size=page_size,
        barangay=barangay,
        issue_type=issue_type,
        department_id=department_id,
        from_date=from_date,
        to_date=to_date,
        sort=sort,
    )


@router.get("/density")
def analytics_density(
    mode: str = Query("barangay", pattern="^(barangay|grid)$"),
    issue_type: str | None = None,
    status: str | None = None,
    user: AuthUser = Depends(require_roles(*LGU)),
):
    return build_density(mode=mode, issue_type=issue_type, status=status)


@router.get("/volunteers/top")
def top_volunteers(user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    records = sb.table("attendance_records").select("user_id,calculated_hours").eq("lgu_status", "verified").execute().data or []
    totals: dict[str, float] = {}
    for r in records:
        uid = r["user_id"]
        totals[uid] = totals.get(uid, 0) + float(r.get("calculated_hours") or 0)
    ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:10]
    return [{"user_id": uid, "hours": h} for uid, h in ranked]


@router.get("/community-impact")
def community_impact():
    if not settings.supabase_configured:
        return {"resolved_incidents": 0, "approved_cleanups": 0}

    try:
        sb = get_supabase()
        resolved = sb.table("incidents").select("*", count="exact", head=True).eq("status", "resolved").execute()
        active = sb.table("incidents").select("*", count="exact", head=True).in_("status", ["verified", "assigned", "ongoing"]).execute()
        cleanups = sb.table("cleanup_events").select("*", count="exact", head=True).eq("approval_status", "approved").execute()
        return {
            "resolved_incidents": resolved.count or 0,
            "active_incidents": active.count or 0,
            "approved_cleanups": cleanups.count or 0,
        }
    except Exception:
        return {"resolved_incidents": 0, "approved_cleanups": 0}


@router.post("/incidents/{incident_id}/summary")
async def ai_summary(incident_id: str, user: AuthUser = Depends(require_roles(*LGU))):
    sb = get_supabase()
    inc = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
    prompt = f"Summarize this civic incident for LGU review: type={inc['primary_issue_type']}, reports={inc.get('report_count')}, severity={inc.get('severity_score')}, barangay={inc.get('barangay')}. Keep it under 3 sentences."
    summary = f"[AI Draft] {inc['primary_issue_type']} incident with {inc.get('report_count',1)} report(s), severity {inc.get('severity_score',0)} in {inc.get('barangay','unknown area')}."
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
            )
            if resp.status_code == 200:
                summary = "[AI Draft] " + resp.json().get("response", summary)
    except Exception:
        pass
    sb.table("incidents").update({"ai_summary": summary}).eq("id", incident_id).execute()
    return {"ai_summary": summary}
