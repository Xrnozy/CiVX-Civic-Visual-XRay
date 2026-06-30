"""Read-only analytics aggregations for the LGU dashboard."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import mean

from app.db import get_supabase
from app.utils.geocoding import resolve_barangay

ACTIVE_INCIDENT_STATUSES = ("detected", "pending_review", "verified", "assigned", "ongoing")
RESOLVED_STATUSES = ("resolved", "archived")
INCIDENT_STATUS_ORDER = (
    "detected",
    "pending_review",
    "verified",
    "assigned",
    "ongoing",
    "resolved",
    "archived",
)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _hours_between(start: str | None, end: str | None) -> float | None:
    s = _parse_ts(start)
    e = _parse_ts(end)
    if not s or not e or e < s:
        return None
    return (e - s).total_seconds() / 3600.0


def _week_key(created_at: str | None) -> str | None:
    dt = _parse_ts(created_at)
    if not dt:
        return None
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"


def _fetch_incidents(fields: str, *, active_only: bool = False) -> list[dict]:
    sb = get_supabase()
    q = sb.table("incidents").select(fields)
    if active_only:
        q = q.in_("status", list(ACTIVE_INCIDENT_STATUSES))
    return q.limit(5000).execute().data or []


def _fetch_reports() -> list[dict]:
    sb = get_supabase()
    return (
        sb.table("reports")
        .select("id,issue_type,address_text,merged_incident_id,created_at")
        .limit(10000)
        .execute()
        .data
        or []
    )


def _incident_map(incidents: list[dict]) -> dict[str, dict]:
    return {row["id"]: row for row in incidents}


def _department_map() -> dict[str, dict]:
    sb = get_supabase()
    rows = sb.table("departments").select("id,name,code").execute().data or []
    return {row["id"]: row for row in rows}


def build_summary() -> dict:
    sb = get_supabase()
    reports = _fetch_reports()
    incidents = _fetch_incidents(
        "id,status,barangay,primary_issue_type,created_at,verified_at,resolved_at,latitude,longitude"
    )

    by_barangay: dict[str, int] = defaultdict(int)
    by_status: dict[str, int] = defaultdict(int)
    lifecycle_hours: list[float] = []

    for inc in incidents:
        b = resolve_barangay(
            barangay=inc.get("barangay"),
            latitude=inc.get("latitude"),
            longitude=inc.get("longitude"),
        )
        by_barangay[b] += 1
        by_status[inc.get("status", "unknown")] += 1
        verify_h = _hours_between(inc.get("created_at"), inc.get("verified_at"))
        resolve_h = _hours_between(inc.get("verified_at"), inc.get("resolved_at"))
        if verify_h is not None and resolve_h is not None:
            lifecycle_hours.append(verify_h + resolve_h)
        elif verify_h is not None:
            lifecycle_hours.append(verify_h)

    top_barangays = sorted(by_barangay.items(), key=lambda x: x[1], reverse=True)[:3]
    now_iso = datetime.now(timezone.utc).isoformat()
    cleanups = (
        sb.table("cleanup_events")
        .select("*", count="exact", head=True)
        .eq("approval_status", "approved")
        .gte("scheduled_end", now_iso)
        .execute()
    )

    return {
        "total_reports": len(reports),
        "total_incidents": len(incidents),
        "total_resolved": sum(1 for i in incidents if i.get("status") in RESOLVED_STATUSES),
        "resolved_count": by_status.get("resolved", 0),
        "avg_response_time_hours": round(mean(lifecycle_hours), 2) if lifecycle_hours else None,
        "top_barangays": [{"barangay": b, "count": c} for b, c in top_barangays],
        "active_cleanup_events": cleanups.count or 0,
        "by_barangay": dict(by_barangay),
        "by_status": dict(by_status),
    }


def build_by_barangay(
    *,
    barangay: str | None = None,
    issue_type: str | None = None,
    status: str | None = None,
) -> dict:
    reports = _fetch_reports()
    incidents = _incident_map(
        _fetch_incidents(
            "id,status,barangay,primary_issue_type,latitude,longitude"
        )
    )

    items_counter: Counter[tuple[str, str, str]] = Counter()
    totals_by_barangay: Counter[str] = Counter()

    for report in reports:
        inc = incidents.get(report.get("merged_incident_id") or "")
        inc_status = inc.get("status", "pending_review") if inc else "pending_review"
        inc_issue = report.get("issue_type") or (inc.get("primary_issue_type") if inc else "unknown")
        b = resolve_barangay(
            barangay=inc.get("barangay") if inc else None,
            address_text=report.get("address_text"),
            latitude=inc.get("latitude") if inc else None,
            longitude=inc.get("longitude") if inc else None,
        )

        if barangay and b.lower() != barangay.lower():
            continue
        if issue_type and inc_issue != issue_type:
            continue
        if status and inc_status != status:
            continue

        key = (b, inc_issue, inc_status)
        items_counter[key] += 1
        totals_by_barangay[b] += 1

    items = [
        {"barangay": b, "issue_type": it, "status": st, "count": count}
        for (b, it, st), count in sorted(items_counter.items(), key=lambda x: (-x[1], x[0][0]))
    ]
    return {
        "items": items,
        "totals_by_barangay": dict(totals_by_barangay),
    }


def build_response_times(*, bucket: str = "none") -> dict:
    incidents = _fetch_incidents("created_at,verified_at,resolved_at")

    verify_hours: list[float] = []
    resolve_hours: list[float] = []
    lifecycle_hours: list[float] = []
    weekly: dict[str, dict[str, list[float]]] = defaultdict(
        lambda: {"verify": [], "resolve": [], "lifecycle": []}
    )

    for inc in incidents:
        v = _hours_between(inc.get("created_at"), inc.get("verified_at"))
        r = _hours_between(inc.get("verified_at"), inc.get("resolved_at"))
        t = _hours_between(inc.get("created_at"), inc.get("resolved_at"))
        week = _week_key(inc.get("created_at"))

        if v is not None:
            verify_hours.append(v)
            if week:
                weekly[week]["verify"].append(v)
        if r is not None:
            resolve_hours.append(r)
            if week:
                weekly[week]["resolve"].append(r)
        if t is not None:
            lifecycle_hours.append(t)
            if week:
                weekly[week]["lifecycle"].append(t)

    result = {
        "avg_time_to_verify_hours": round(mean(verify_hours), 2) if verify_hours else None,
        "avg_time_to_resolve_hours": round(mean(resolve_hours), 2) if resolve_hours else None,
        "avg_total_lifecycle_hours": round(mean(lifecycle_hours), 2) if lifecycle_hours else None,
        "sample_size": {
            "time_to_verify": len(verify_hours),
            "time_to_resolve": len(resolve_hours),
            "total_lifecycle": len(lifecycle_hours),
        },
    }

    if bucket == "weekly":
        series = []
        for week in sorted(weekly.keys()):
            buckets = weekly[week]
            series.append({
                "week": week,
                "avg_time_to_verify_hours": round(mean(buckets["verify"]), 2) if buckets["verify"] else None,
                "avg_time_to_resolve_hours": round(mean(buckets["resolve"]), 2) if buckets["resolve"] else None,
                "avg_total_lifecycle_hours": round(mean(buckets["lifecycle"]), 2) if buckets["lifecycle"] else None,
                "sample_size": len(buckets["lifecycle"]) or len(buckets["verify"]),
            })
        result["weekly"] = series

    return result


def build_resolved_history(
    *,
    page: int = 1,
    page_size: int = 20,
    barangay: str | None = None,
    issue_type: str | None = None,
    department_id: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    sort: str = "-resolved_at",
) -> dict:
    sb = get_supabase()
    rows = (
        sb.table("incidents")
        .select(
            "id,primary_issue_type,barangay,status,resolved_at,verified_at,created_at,"
            "assigned_department_id,report_count,severity_score,latitude,longitude"
        )
        .in_("status", list(RESOLVED_STATUSES))
        .order("resolved_at", desc=True)
        .limit(5000)
        .execute()
        .data
        or []
    )
    departments = _department_map()

    filtered: list[dict] = []
    for row in rows:
        b = resolve_barangay(
            barangay=row.get("barangay"),
            latitude=row.get("latitude"),
            longitude=row.get("longitude"),
        )
        if barangay and b.lower() != barangay.lower():
            continue
        if issue_type and row.get("primary_issue_type") != issue_type:
            continue
        if department_id and row.get("assigned_department_id") != department_id:
            continue
        resolved_at = row.get("resolved_at")
        if from_date and (not resolved_at or resolved_at < from_date):
            continue
        if to_date and (not resolved_at or resolved_at > to_date):
            continue

        dept = departments.get(row.get("assigned_department_id") or "")
        filtered.append({
            "id": row["id"],
            "primary_issue_type": row.get("primary_issue_type"),
            "barangay": b,
            "status": row.get("status"),
            "resolved_at": resolved_at,
            "verified_at": row.get("verified_at"),
            "created_at": row.get("created_at"),
            "report_count": row.get("report_count", 1),
            "severity_score": row.get("severity_score"),
            "department": (
                {"id": dept["id"], "name": dept["name"], "code": dept["code"]}
                if dept
                else None
            ),
        })

    reverse = sort.startswith("-")
    field = sort.lstrip("-")
    filtered.sort(key=lambda r: r.get(field) or "", reverse=reverse)

    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "items": filtered[start:end],
        "page": page,
        "page_size": page_size,
        "total": len(filtered),
        "total_pages": max(1, (len(filtered) + page_size - 1) // page_size),
    }


def build_density(
    *,
    mode: str = "barangay",
    issue_type: str | None = None,
    status: str | None = None,
) -> dict:
    incidents = _fetch_incidents(
        "id,barangay,latitude,longitude,primary_issue_type,status",
        active_only=True,
    )

    if status:
        incidents = [i for i in incidents if i.get("status") == status]

    if issue_type:
        incidents = [i for i in incidents if i.get("primary_issue_type") == issue_type]

    if mode == "grid":
        grid: dict[tuple[float, float], dict] = {}
        for inc in incidents:
            lat = round(float(inc.get("latitude") or 0), 3)
            lng = round(float(inc.get("longitude") or 0), 3)
            key = (lat, lng)
            cell = grid.setdefault(key, {"lat": lat, "lng": lng, "count": 0, "issue_types": Counter()})
            cell["count"] += 1
            cell["issue_types"][inc.get("primary_issue_type", "unknown")] += 1

        cells = []
        for cell in grid.values():
            dominant = cell["issue_types"].most_common(1)[0][0] if cell["issue_types"] else None
            cells.append({
                "lat": cell["lat"],
                "lng": cell["lng"],
                "count": cell["count"],
                "dominant_issue_type": dominant,
            })
        cells.sort(key=lambda c: c["count"], reverse=True)
        return {"mode": "grid", "cells": cells}

    barangay_groups: dict[str, dict] = {}
    for inc in incidents:
        b = resolve_barangay(
            barangay=inc.get("barangay"),
            latitude=inc.get("latitude"),
            longitude=inc.get("longitude"),
        )
        group = barangay_groups.setdefault(
            b,
            {"barangay": b, "count": 0, "lat_sum": 0.0, "lng_sum": 0.0, "points": 0},
        )
        group["count"] += 1
        group["lat_sum"] += float(inc.get("latitude") or 0)
        group["lng_sum"] += float(inc.get("longitude") or 0)
        group["points"] += 1

    cells = []
    for group in barangay_groups.values():
        pts = group["points"] or 1
        cells.append({
            "barangay": group["barangay"],
            "count": group["count"],
            "lat": round(group["lat_sum"] / pts, 6),
            "lng": round(group["lng_sum"] / pts, 6),
        })
    cells.sort(key=lambda c: c["count"], reverse=True)
    return {"mode": "barangay", "cells": cells}
