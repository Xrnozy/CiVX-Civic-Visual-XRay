import math
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.db import get_supabase
from app.utils.supabase_schema import insert_row


@dataclass
class MergeRecommendation:
    action: str  # "merge" | "create"
    incident_id: str | None
    duplicate_score: float
    reason: str


class IncidentIntelligenceAgent:
  def __init__(self, similarity_provider=None):
    self.similarity_provider = similarity_provider

  def _gps_score(self, distance_m: float, max_radius: float) -> float:
    if distance_m >= max_radius:
      return 0.0
    return 1.0 - (distance_m / max_radius)

  def _time_decay(self, hours_since: float) -> float:
    return max(0.0, 1.0 - hours_since / 168)  # decay over 1 week

  def score_duplicate(
    self,
    distance_m: float,
    issue_match: bool,
    hours_since: float,
    ai_confidence: float,
    image_similarity: float = 0.0,
  ) -> float:
    return (
      0.40 * self._gps_score(distance_m, settings.duplicate_radius_m)
      + 0.25 * (1.0 if issue_match else 0.0)
      + 0.15 * self._time_decay(hours_since)
      + 0.20 * ai_confidence
      + 0.0 * image_similarity  # reserved for CLIP; weight 0 in MVP scoring
    )

  def find_nearby_incidents(
    self, lat: float, lng: float, issue_type: str, radius_m: float | None = None
  ) -> list[dict[str, Any]]:
    sb = get_supabase()
    radius = radius_m or settings.duplicate_radius_m
    result = sb.rpc(
      "nearby_incidents",
      {"lat": lat, "lng": lng, "radius_m": radius, "p_issue_type": issue_type, "active_only": True},
    ).execute()
    return result.data or []

  def recommend(
    self,
    lat: float,
    lng: float,
    issue_type: str,
    ai_confidence: float = 0.5,
    hours_since: float = 0.0,
  ) -> MergeRecommendation:
    nearby = self.find_nearby_incidents(lat, lng, issue_type)
    best_score = 0.0
    best_incident = None

    for inc in nearby:
      dist = self._haversine_m(lat, lng, inc["latitude"], inc["longitude"])
      score = self.score_duplicate(dist, True, hours_since, ai_confidence)
      if score > best_score:
        best_score = score
        best_incident = inc

    if best_incident and best_score >= settings.duplicate_merge_threshold:
      return MergeRecommendation(
        action="merge",
        incident_id=best_incident["id"],
        duplicate_score=best_score,
        reason=f"Matched incident within {settings.duplicate_radius_m}m (score={best_score:.2f})",
      )
    return MergeRecommendation(
      action="create",
      incident_id=None,
      duplicate_score=best_score,
      reason="No matching active incident found",
    )

  @staticmethod
  def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))

  def merge_report(self, incident_id: str, report_id: str, severity: float) -> dict:
    sb = get_supabase()
    inc = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
    new_count = (inc.get("report_count") or 1) + 1
    new_severity = max(float(inc.get("severity_score") or 0), severity)
    sb.table("incidents").update({
      "report_count": new_count,
      "severity_score": new_severity,
    }).eq("id", incident_id).execute()
    sb.table("reports").update({
      "status": "merged",
      "merged_incident_id": incident_id,
    }).eq("id", report_id).execute()
    return {"incident_id": incident_id, "report_count": new_count}

  def create_incident(
    self,
    issue_type: str,
    lat: float,
    lng: float,
    severity: float,
    source: str = "citizen",
    barangay: str | None = None,
    street: str | None = None,
    city: str | None = None,
    province: str | None = None,
  ) -> dict:
    sb = get_supabase()
    result = insert_row(sb, "incidents", {
      "primary_issue_type": issue_type,
      "severity_score": severity,
      "latitude": lat,
      "longitude": lng,
      "barangay": barangay,
      "street": street,
      "city": city,
      "province": province,
      "status": "pending_review",
      "report_count": 1,
      "source": source,
    })
    return result
