"""Map YOLO/COCO classes to CiVX civic issue types."""

COCO_TO_CIVX: dict[str, str] = {
    "bottle": "garbage_pile",
    "cup": "scattered_trash",
    "bowl": "scattered_trash",
    "banana": "garbage_pile",
    "apple": "garbage_pile",
    "sandwich": "garbage_pile",
    "orange": "garbage_pile",
    "broccoli": "garbage_pile",
    "carrot": "garbage_pile",
    "hot dog": "garbage_pile",
    "pizza": "garbage_pile",
    "donut": "garbage_pile",
    "cake": "garbage_pile",
    "suitcase": "road_obstruction",
    "backpack": "road_obstruction",
    "handbag": "road_obstruction",
    "chair": "road_obstruction",
    "couch": "road_obstruction",
    "potted plant": "road_obstruction",
    "bed": "road_obstruction",
    "dining table": "road_obstruction",
    "tv": "road_obstruction",
    "laptop": "road_obstruction",
    "cell phone": "road_obstruction",
    "book": "scattered_trash",
    "clock": "broken_streetlight",
    "vase": "scattered_trash",
    "scissors": "scattered_trash",
    "teddy bear": "scattered_trash",
    "hair drier": "scattered_trash",
    "toothbrush": "scattered_trash",
    "umbrella": "road_obstruction",
    "sports ball": "road_obstruction",
    "skateboard": "road_obstruction",
    "surfboard": "road_obstruction",
    "tennis racket": "road_obstruction",
    "baseball bat": "road_obstruction",
    "baseball glove": "road_obstruction",
    "skis": "road_obstruction",
    "snowboard": "road_obstruction",
    "kite": "road_obstruction",
    "frisbee": "scattered_trash",
    "tie": "scattered_trash",
    "person": "unsafe_public_area",
    "car": "road_obstruction",
    "truck": "road_obstruction",
    "bus": "road_obstruction",
    "motorcycle": "road_obstruction",
    "bicycle": "road_obstruction",
    "boat": "illegal_dumping",
    "train": "road_obstruction",
    "fire hydrant": "open_manhole",
    "stop sign": "damaged_traffic_sign",
    "parking meter": "damaged_traffic_sign",
    "bench": "road_obstruction",
    "bird": "unsafe_public_area",
    "cat": "unsafe_public_area",
    "dog": "unsafe_public_area",
    "horse": "unsafe_public_area",
    "sheep": "unsafe_public_area",
    "cow": "unsafe_public_area",
    "elephant": "unsafe_public_area",
    "bear": "unsafe_public_area",
    "zebra": "unsafe_public_area",
    "giraffe": "unsafe_public_area",
}

# Keyword-based fallback for demo when no COCO match
KEYWORD_MAP: dict[str, str] = {
    "garbage": "garbage_pile",
    "trash": "scattered_trash",
    "pothole": "pothole",
    "hole": "pothole",
    "flood": "flooding",
    "water": "flooding",
    "canal": "dirty_canal",
    "drain": "clogged_drainage",
    "crack": "road_crack",
    "road": "broken_road",
    "dump": "illegal_dumping",
}

ISSUE_SEVERITY_WEIGHT: dict[str, float] = {
    "open_manhole": 1.0,
    "unsafe_public_area": 0.95,
    "flooding": 0.9,
    "illegal_dumping": 0.85,
    "pothole": 0.8,
    "broken_road": 0.8,
    "road_obstruction": 0.75,
    "clogged_drainage": 0.7,
    "garbage_pile": 0.65,
    "scattered_trash": 0.5,
    "dirty_canal": 0.55,
}


def map_class_to_issue(yolo_class: str) -> str:
    key = yolo_class.lower().strip()
    if key in COCO_TO_CIVX:
        return COCO_TO_CIVX[key]
    for kw, issue in KEYWORD_MAP.items():
        if kw in key:
            return issue
    return "garbage_pile"


def compute_severity(issue_type: str, confidence: float) -> float:
    base = ISSUE_SEVERITY_WEIGHT.get(issue_type, 0.5)
    return round(min(10.0, base * 10 * confidence), 2)
