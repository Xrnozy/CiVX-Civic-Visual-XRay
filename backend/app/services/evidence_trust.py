"""Evidence authenticity and trust scoring for passive uploads."""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.services import passive_jobs


@dataclass
class TrustResult:
    trust_score: float
    trust_level: str  # trusted | semi_trusted | untrusted
    suspicion_flags: list[str] = field(default_factory=list)


CAPTURE_MODES_AUTO = frozenset({"passive_camera", "in_app_camera"})
CAPTURE_MODES_BLOCKED = frozenset({"gallery_upload", "screenshot", "unknown_source"})

HIGH_RISK_CATEGORIES = frozenset({
    "open_manhole",
    "fallen_tree",
    "road_obstruction",
    "flooding",
    "damaged_traffic_sign",
    "unsafe_public_area",
})


def _clamp(score: float) -> float:
    return max(0.0, min(1.0, score))


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def hash_nonce(nonce: str) -> str:
    return hashlib.sha256(nonce.encode()).hexdigest()


def evaluate_upload_trust(
    *,
    capture_mode: str,
    session_id: str | None = None,
    nonce: str | None = None,
    sha256: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    gps_accuracy: float | None = None,
    device_id: str | None = None,
    client_timestamp: datetime | None = None,
    skip_session_check: bool = False,
) -> TrustResult:
    score = 1.0
    flags: list[str] = []

    if capture_mode in CAPTURE_MODES_BLOCKED:
        score -= 0.50
        flags.append("gallery_upload" if capture_mode == "gallery_upload" else capture_mode)

    if not skip_session_check and session_id and nonce:
        session = passive_jobs.get_capture_session(session_id)
        if not session:
            score -= 0.40
            flags.append("invalid_session")
        else:
            expires = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if expires < datetime.now(timezone.utc):
                score -= 0.40
                flags.append("expired_session")
            elif session.get("nonce_hash") != hash_nonce(nonce):
                score -= 0.40
                flags.append("nonce_mismatch")
    elif not skip_session_check and not session_id:
        score -= 0.15
        flags.append("missing_session")

    if lat is None or lng is None:
        score -= 0.25
        flags.append("missing_gps")
    elif gps_accuracy is not None and gps_accuracy > 100:
        score -= 0.10
        flags.append("inaccurate_gps")

    if client_timestamp:
        age_hours = (datetime.now(timezone.utc) - client_timestamp.replace(tzinfo=timezone.utc)).total_seconds() / 3600
        if age_hours > 24:
            score -= 0.20
            flags.append("old_timestamp")

    if sha256 and passive_jobs.hash_exists(sha256):
        score -= 0.50
        flags.append("duplicate_hash")

    if device_id and lat is not None and lng is not None:
        last = passive_jobs.get_last_device_position(device_id)
        if last:
            dist = _haversine_m(last[0], last[1], lat, lng)
            if dist > 5000:
                score -= 0.40
                flags.append("impossible_travel_speed")

    score = _clamp(score)
    if score >= settings.trust_threshold_trusted:
        level = "trusted"
    elif score >= settings.trust_threshold_semi:
        level = "semi_trusted"
    else:
        level = "untrusted"

    return TrustResult(trust_score=score, trust_level=level, suspicion_flags=flags)


def frame_perceptual_hash(image_path: str) -> str:
    import imagehash
    from PIL import Image

    with Image.open(image_path) as img:
        return str(imagehash.phash(img))


def is_perceptual_duplicate(hash_a: str, hash_b: str, max_distance: int | None = None) -> bool:
    if not hash_a or not hash_b:
        return False
    limit = max_distance if max_distance is not None else settings.frame_hash_max_distance
    import imagehash

    return imagehash.hex_to_hash(hash_a) - imagehash.hex_to_hash(hash_b) <= limit
