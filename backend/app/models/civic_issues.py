"""CiVX civic issue slugs and natural-language prompts for LocateAnything."""

import re

CIVIC_ISSUE_PROMPTS: dict[str, str] = {
    "garbage_pile": "garbage pile or accumulated trash on the street",
    "scattered_trash": "scattered trash or litter",
    "overflowing_trash_bin": "overflowing trash bin or dumpster",
    "illegal_dumping": "illegal dumping or dumped waste",
    "pothole": "pothole in the road",
    "broken_road": "broken or damaged road surface",
    "road_crack": "crack in the road pavement",
    "uneven_road": "uneven road or sunken pavement",
    "flooding": "flooded street or standing flood water",
    "dirty_canal": "dirty canal or polluted waterway",
    "dirty_river": "dirty river or polluted river",
    "clogged_drainage": "clogged drainage or blocked drain",
    "broken_sidewalk": "broken sidewalk or damaged walkway",
    "broken_streetlight": "broken streetlight or damaged lamp post",
    "open_manhole": "open manhole or missing manhole cover",
    "fallen_tree": "fallen tree or tree blocking the road",
    "road_obstruction": "road obstruction or object blocking traffic",
    "damaged_traffic_sign": "damaged traffic sign or broken road sign",
    "unsafe_public_area": "unsafe public area hazard",
    "cleanup_event": "community cleanup event or organized cleanup activity",
}

# Labels for LocateAnything detect() — one pass screens all civic hazards in a frame.
CIVIC_DETECT_LABELS: list[str] = [
    "garbage pile",
    "scattered trash",
    "overflowing trash bin",
    "illegal dumping",
    "pothole",
    "broken road",
    "road crack",
    "uneven road",
    "flooded area",
    "dirty canal",
    "dirty river",
    "clogged drainage",
    "broken sidewalk",
    "broken streetlight",
    "open manhole",
    "fallen tree",
    "road obstruction",
    "damaged traffic sign",
    "unsafe public area",
]

# Passive 10s chunks: screen hazards only (cleanup_event is scheduled, not auto-detected).
PASSIVE_VIDEO_DETECT_LABELS: list[str] = list(CIVIC_DETECT_LABELS)

# Kept for reference; do not pass this long list to ground_multi — model returns <box>None</box>.
CIVIC_SCENE_PROMPT = (
    "garbage piles, scattered litter, potholes, flooded areas, broken sidewalks, "
    "damaged streetlights, open manholes, fallen trees, or road obstructions"
)

# Map loose model/ref text to issue slugs (longer phrases first).
_REF_ALIASES: list[tuple[str, str]] = [
    ("overflowing trash bin", "overflowing_trash_bin"),
    ("illegal dumping", "illegal_dumping"),
    ("scattered trash", "scattered_trash"),
    ("scattered litter", "scattered_trash"),
    ("garbage pile", "garbage_pile"),
    ("garbage piles", "garbage_pile"),
    ("accumulated trash", "garbage_pile"),
    ("open manhole", "open_manhole"),
    ("missing manhole cover", "open_manhole"),
    ("broken streetlight", "broken_streetlight"),
    ("damaged streetlight", "broken_streetlight"),
    ("broken sidewalk", "broken_sidewalk"),
    ("road obstruction", "road_obstruction"),
    ("fallen tree", "fallen_tree"),
    ("fallen trees", "fallen_tree"),
    ("clogged drainage", "clogged_drainage"),
    ("dirty canal", "dirty_canal"),
    ("dirty river", "dirty_river"),
    ("flooded area", "flooding"),
    ("flooded areas", "flooding"),
    ("standing flood", "flooding"),
    ("uneven road", "uneven_road"),
    ("sunken pavement", "uneven_road"),
    ("road crack", "road_crack"),
    ("broken road", "broken_road"),
    ("damaged traffic sign", "damaged_traffic_sign"),
    ("unsafe public area", "unsafe_public_area"),
    ("cleanup event", "cleanup_event"),
    ("pothole", "pothole"),
    ("potholes", "pothole"),
]

ISSUE_SEVERITY_WEIGHT: dict[str, float] = {
    "open_manhole": 1.0,
    "unsafe_public_area": 0.95,
    "flooding": 0.9,
    "illegal_dumping": 0.85,
    "pothole": 0.8,
    "broken_road": 0.8,
    "uneven_road": 0.75,
    "road_obstruction": 0.75,
    "clogged_drainage": 0.7,
    "garbage_pile": 0.65,
    "dirty_river": 0.55,
    "dirty_canal": 0.55,
    "scattered_trash": 0.5,
    "cleanup_event": 0.3,
}

# Slugs the passive queue should not auto-create incidents for.
PASSIVE_SKIP_INCIDENT_SLUGS: frozenset[str] = frozenset({"cleanup_event"})


def phrase_for_issue(issue_type: str) -> str:
    return CIVIC_ISSUE_PROMPTS.get(issue_type, issue_type.replace("_", " "))


def compute_severity(issue_type: str, confidence: float) -> float:
    base = ISSUE_SEVERITY_WEIGHT.get(issue_type, 0.5)
    return round(min(10.0, base * 10 * confidence), 2)


def infer_issue_type_from_answer(answer: str, preferred: str | None = None) -> str:
    if preferred and preferred in CIVIC_ISSUE_PROMPTS:
        return preferred

    refs = re.findall(r"<ref>(.*?)</ref>", answer, flags=re.IGNORECASE | re.DOTALL)
    text = " ".join(refs) if refs else answer
    lower = text.lower()

    for alias, slug in _REF_ALIASES:
        if alias in lower:
            return slug

    for slug, phrase in CIVIC_ISSUE_PROMPTS.items():
        if slug.replace("_", " ") in lower or phrase.split(" or ")[0] in lower:
            return slug
    for slug in CIVIC_ISSUE_PROMPTS:
        if slug.replace("_", " ") in lower:
            return slug
    return preferred or "garbage_pile"
