"""Issue-type to department routing for field checker dispatch."""

from app.db import get_supabase

DISPATCH_CATEGORY_LABELS = {
    "SWM": "Sanitation field checker",
    "DPWH": "Road inspection checker",
    "DRAIN": "Drainage / site inspection checker",
    "SAFETY": "Public safety field verifier",
}

ISSUE_TYPE_TO_DEPT_CODE: dict[str, str] = {
    "garbage_pile": "SWM",
    "scattered_trash": "SWM",
    "overflowing_trash_bin": "SWM",
    "illegal_dumping": "SWM",
    "pothole": "DPWH",
    "broken_road": "DPWH",
    "road_crack": "DPWH",
    "uneven_road": "DPWH",
    "broken_sidewalk": "DPWH",
    "open_manhole": "DPWH",
    "flooding": "DRAIN",
    "clogged_drainage": "DRAIN",
    "dirty_canal": "DRAIN",
    "dirty_river": "DRAIN",
    "road_obstruction": "SAFETY",
    "unsafe_public_area": "SAFETY",
    "fallen_tree": "SAFETY",
    "damaged_traffic_sign": "SAFETY",
    "broken_streetlight": "SAFETY",
}

_dept_cache: dict[str, dict] | None = None


def _load_departments() -> dict[str, dict]:
    global _dept_cache
    if _dept_cache is not None:
        return _dept_cache
    sb = get_supabase()
    rows = sb.table("departments").select("id, code, name, issue_types").execute().data or []
    _dept_cache = {r["code"]: r for r in rows}
    return _dept_cache


def recommend_department(issue_type: str | None) -> dict:
    """Return recommended department id, code, name, and demo-safe label."""
    depts = _load_departments()
    code = ISSUE_TYPE_TO_DEPT_CODE.get(issue_type or "", "SAFETY")
    dept = depts.get(code) or next(iter(depts.values()), {})
    return {
        "department_id": dept.get("id"),
        "department_code": dept.get("code", code),
        "department_name": dept.get("name", "Public Safety"),
        "dispatch_label": DISPATCH_CATEGORY_LABELS.get(dept.get("code", code), "Field verifier"),
    }


def incident_status_for_dispatch(dispatch_status: str) -> str:
    if dispatch_status == "resolved":
        return "resolved"
    if dispatch_status in ("on_the_way", "checking_site", "verified", "needs_action"):
        return "ongoing"
    return "assigned"
