"""Shared constants for CiVX."""

ISSUE_CATEGORIES = [
    "garbage_pile",
    "scattered_trash",
    "overflowing_trash_bin",
    "illegal_dumping",
    "pothole",
    "broken_road",
    "road_crack",
    "uneven_road",
    "flooding",
    "dirty_canal",
    "dirty_river",
    "clogged_drainage",
    "broken_sidewalk",
    "broken_streetlight",
    "open_manhole",
    "fallen_tree",
    "road_obstruction",
    "damaged_traffic_sign",
    "unsafe_public_area",
    "cleanup_event",
]

INCIDENT_STATUSES = [
    "detected",
    "pending_review",
    "verified",
    "assigned",
    "ongoing",
    "resolved",
    "archived",
]

USER_ROLES = [
    "citizen",
    "volunteer",
    "organizer",
    "lgu_admin",
    "lgu_staff",
    "field_worker",
    "driver",
    "street_sweeper",
]

LGU_ROLES = {"lgu_admin", "lgu_staff", "field_worker"}

ISSUE_URGENCY = {
    "open_manhole": 10,
    "unsafe_public_area": 9,
    "flooding": 9,
    "illegal_dumping": 7,
    "pothole": 7,
    "broken_road": 7,
    "garbage_pile": 6,
    "clogged_drainage": 6,
    "road_obstruction": 6,
    "fallen_tree": 5,
    "broken_streetlight": 5,
    "dirty_canal": 4,
    "scattered_trash": 3,
}

DEFAULT_MAP_CENTER = {"lat": 14.5995, "lng": 120.9842}  # Manila demo
