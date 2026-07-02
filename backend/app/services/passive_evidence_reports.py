"""Bridge passive pipeline evidence into incident reports + photo URLs."""

from __future__ import annotations

import logging
import os
from typing import Any

from app.db import get_supabase
from app.utils.geocoding import resolve_address_fields
from app.utils.storage import resolve_photo_url
from app.utils.supabase_schema import insert_row

logger = logging.getLogger(__name__)


def _single_bbox_from_dict(data: dict[str, Any]) -> dict[str, float] | None:
    x1 = float(data.get("x1", 0))
    y1 = float(data.get("y1", 0))
    x2 = float(data.get("x2", 0))
    y2 = float(data.get("y2", 0))
    if x2 > x1 and y2 > y1:
        return {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
    return None


def _regions_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw = payload.get("raw_ai_result") or {}
    if isinstance(raw, dict):
        regions = raw.get("regions")
        if isinstance(regions, list) and regions:
            out: list[dict[str, Any]] = []
            for region in regions:
                if not isinstance(region, dict):
                    continue
                box = _single_bbox_from_dict(region)
                if box:
                    out.append({**box, "label": region.get("label")})
            if out:
                return out
        boxes = raw.get("boxes")
        if isinstance(boxes, list) and boxes:
            out = []
            for box in boxes:
                if isinstance(box, dict):
                    parsed = _single_bbox_from_dict(box)
                    if parsed:
                        out.append(parsed)
            if out:
                return out

    bbox = payload.get("bounding_box")
    if isinstance(bbox, dict):
        regions_field = bbox.get("regions")
        if isinstance(regions_field, list) and regions_field:
            out = []
            for region in regions_field:
                if isinstance(region, dict):
                    parsed = _single_bbox_from_dict(region)
                    if parsed:
                        out.append({**parsed, "label": region.get("label")})
            if out:
                return out
        parsed = _single_bbox_from_dict(bbox)
        if parsed:
            label = bbox.get("label")
            return [{**parsed, **({"label": label} if label else {})}]

    return []


def _bbox_from_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    regions = _regions_from_payload(payload)
    if not regions:
        return None
    if len(regions) == 1:
        region = regions[0]
        out: dict[str, Any] = {k: region[k] for k in ("x1", "y1", "x2", "y2")}
        if region.get("label"):
            out["label"] = region["label"]
        return out
    return {
        "regions": [
            {
                **{k: float(region[k]) for k in ("x1", "y1", "x2", "y2")},
                **({"label": region["label"]} if region.get("label") else {}),
            }
            for region in regions
        ]
    }


def resolve_evidence_photo_url(evidence_id: str, evidence_url: str | None, frame_path: str | None) -> str | None:
    signed = resolve_photo_url(evidence_url)
    if signed:
        return signed
    if frame_path and os.path.isfile(frame_path):
        return f"/api/passive/evidence/{evidence_id}/image"
    return None


def create_passive_report(
    *,
    incident_id: str,
    job: dict[str, Any],
    payload: dict[str, Any],
    photo_url: str | None,
    lat: float,
    lng: float,
    severity: float,
    evidence_id: str | None = None,
) -> dict[str, Any] | None:
    """Insert a reports row so map/LGU UIs show passive evidence photos."""
    user_id = job.get("user_id")
    if not user_id:
        logger.warning("Skipping passive report row — job %s has no user_id", job.get("job_id"))
        return None
    if not photo_url:
        return None

    issue_type = payload.get("issue_type") or "garbage_pile"
    confidence = float(payload.get("confidence") or 0.5)
    bbox = _bbox_from_payload(payload)
    resolved = resolve_address_fields(latitude=lat, longitude=lng)

    sb = get_supabase()
    report = insert_row(sb, "reports", {
        "reporter_user_id": user_id,
        "issue_type": issue_type,
        "description": f"Passive detection ({payload.get('source', 'pipeline')})",
        "latitude": lat,
        "longitude": lng,
        "address_text": resolved.barangay,
        "street": resolved.street,
        "city": resolved.city,
        "province": resolved.province,
        "photo_url": photo_url,
        "photo_urls": [photo_url],
        "ai_suggested_type": issue_type,
        "ai_confidence": confidence,
        "ai_bounding_box": bbox,
        "ai_severity_score": severity,
        "status": "merged",
        "merged_incident_id": incident_id,
    })

    if evidence_id:
        try:
            sb.table("passive_evidence").update({"report_id": report["id"]}).eq("id", evidence_id).execute()
        except Exception as exc:
            logger.warning("Could not link passive_evidence %s to report: %s", evidence_id, exc)

    return report


def list_passive_reports_for_incident(incident_id: str, incident: dict[str, Any]) -> list[dict[str, Any]]:
    """Return passive_evidence rows formatted like incident reports (for API merge)."""
    sb = get_supabase()
    evidence_rows = (
        sb.table("passive_evidence")
        .select("id,job_id,frame_path,evidence_url,ai_label,ai_confidence,trust_score,source,verification_status,raw_ai_result,created_at,report_id")
        .eq("incident_id", incident_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    if not evidence_rows:
        return []

    job_ids = list({row["job_id"] for row in evidence_rows if row.get("job_id")})
    detections_by_job: dict[str, dict] = {}
    if job_ids:
        detections = (
            sb.table("detection_results")
            .select("job_id,bounding_box_json,confidence,severity_score")
            .eq("incident_id", incident_id)
            .in_("job_id", job_ids)
            .execute()
            .data
            or []
        )
        for det in detections:
            jid = det.get("job_id")
            if jid and jid not in detections_by_job:
                detections_by_job[jid] = det

    out: list[dict[str, Any]] = []

    for ev in evidence_rows:
        if ev.get("report_id"):
            continue

        photo_url = resolve_evidence_photo_url(ev["id"], ev.get("evidence_url"), ev.get("frame_path"))
        if not photo_url:
            continue

        det = detections_by_job.get(ev.get("job_id") or "")
        bbox = None
        if det and det.get("bounding_box_json"):
            bbox = det["bounding_box_json"]
        elif ev.get("raw_ai_result"):
            bbox = _bbox_from_payload({"raw_ai_result": ev["raw_ai_result"]})

        out.append({
            "id": f"passive-{ev['id']}",
            "issue_type": ev.get("ai_label") or incident.get("primary_issue_type"),
            "description": f"Passive evidence ({ev.get('source', 'pipeline')})",
            "photo_url": photo_url,
            "photo_urls": [photo_url],
            "ai_suggested_type": ev.get("ai_label"),
            "ai_confidence": ev.get("ai_confidence"),
            "ai_bounding_box": bbox,
            "ai_severity_score": det.get("severity_score") if det else None,
            "status": "merged",
            "created_at": ev.get("created_at"),
            "source": incident.get("source") or "passive",
            "submitter_type": "citizen",
            "incident_status": incident.get("status"),
            "passive_evidence_id": ev["id"],
        })

    return out
