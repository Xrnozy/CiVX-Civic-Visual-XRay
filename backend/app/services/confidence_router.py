"""Route YOLO/LocateAnything detections based on confidence, trust, and queue mode."""

from __future__ import annotations

from typing import Literal

from app.config import settings
from app.services.evidence_trust import HIGH_RISK_CATEGORIES
from app.services.queue_mode import QueueMode

RouteAction = Literal["auto_candidate", "locate_verify", "review", "discard", "urgent_unverified"]

LOCATE_PRIORITY_CATEGORIES = frozenset({
    "dirty_canal",
    "clogged_drainage",
    "illegal_dumping",
    "broken_streetlight",
    "unsafe_public_area",
    "garbage_pile",
    "scattered_trash",
    "overflowing_trash_bin",
    "pothole",
    "road_crack",
})

VERIFICATION_BY_ACTION: dict[str, str] = {
    "auto_candidate": "auto_confirmed",
    "urgent_unverified": "urgent_unverified",
    "locate_verify": "pending_locate",
    "review": "needs_review",
    "discard": "rejected",
}


def verification_status_for_action(action: RouteAction) -> str:
    return VERIFICATION_BY_ACTION.get(action, "needs_review")


def medium_confidence_band(mode: QueueMode) -> tuple[float, float]:
    if mode == "busy":
        return 0.60, 0.90
    return settings.yolo_confidence_medium, settings.yolo_confidence_high


def _locate_allowed(issue_type: str, mode: QueueMode) -> bool:
    is_priority = issue_type in LOCATE_PRIORITY_CATEGORIES or issue_type in HIGH_RISK_CATEGORIES
    if mode == "normal":
        return True
    if mode == "busy":
        return is_priority
    # overloaded: locate only for priority categories (rare path; high-conf auto preferred)
    return is_priority


def route_detection(
    *,
    issue_type: str,
    confidence: float,
    trust_score: float,
    frames_with_issue: int,
    mode: QueueMode,
) -> RouteAction:
    high = settings.yolo_confidence_high
    med_low, med_high = medium_confidence_band(mode)
    is_high_risk = issue_type in HIGH_RISK_CATEGORIES

    if confidence >= high:
        if frames_with_issue >= 2 and trust_score >= settings.trust_threshold_trusted:
            return "auto_candidate"
        if trust_score >= settings.trust_threshold_semi:
            return "urgent_unverified" if is_high_risk else "review"
        return "review"

    if med_low <= confidence < med_high:
        if not _locate_allowed(issue_type, mode):
            return "review" if trust_score >= settings.trust_threshold_semi else "discard"
        if mode == "overloaded":
            return "review" if trust_score >= settings.trust_threshold_semi else "discard"
        if trust_score >= settings.trust_threshold_trusted:
            return "locate_verify"
        if trust_score >= settings.trust_threshold_semi:
            return "review"
        return "discard"

    if confidence < med_low:
        if is_high_risk and trust_score >= settings.trust_threshold_semi:
            return "review"
        return "discard"

    return "discard"
