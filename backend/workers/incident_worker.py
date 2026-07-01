"""Incident creation worker: incident_candidates → incidents + evidence."""

from __future__ import annotations

import logging
import os
import sys

from workers import _bootstrap  # noqa: F401
from workers._common import match_gps, process_message

from app.agents.incident_intelligence import IncidentIntelligenceAgent
from app.agents.lgu_triage import LGUTriageAgent
from app.config import settings
from app.db import get_supabase
from app.models.civic_issues import PASSIVE_SKIP_INCIDENT_SLUGS, compute_severity
from app.services import passive_jobs, pipeline_storage
from app.services.evidence_trust import CAPTURE_MODES_BLOCKED, frame_perceptual_hash
from app.services.redis_queue import (
    STREAM_CANDIDATES,
    STREAM_REVIEW,
    ensure_consumer_groups,
    enqueue,
    read_group,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("incident_worker")
CONSUMER = f"incident-{os.getpid()}"


def _send_to_review(job: dict, payload: dict, reason: str) -> None:
    job_id = payload["job_id"]
    passive_jobs.update_clip_job(job_id, status="needs_review", error_message=reason)
    enqueue(STREAM_REVIEW, {
        **payload,
        "verification_status": "needs_review",
        "review_reason": reason,
    })


def _create_or_merge(payload: dict) -> None:
    job_id = payload["job_id"]
    issue_type = payload["issue_type"]
    if issue_type in PASSIVE_SKIP_INCIDENT_SLUGS:
        passive_jobs.update_clip_job(job_id, status="discarded")
        return

    job = passive_jobs.get_clip_job(job_id) or {}
    capture_mode = payload.get("capture_mode") or job.get("capture_mode", "passive_camera")
    if capture_mode in CAPTURE_MODES_BLOCKED:
        _send_to_review(job, payload, "blocked_capture_mode")
        return

    trace = payload.get("gps_trace_json") or job.get("gps_trace_json") or []
    ts = float(payload.get("frame_timestamp") or 0)
    lat, lng = match_gps(trace, ts, job.get("lat"), job.get("lng"))
    confidence = float(payload.get("confidence") or 0.5)
    trust = float(payload.get("trust_score") or job.get("trust_score") or 1.0)
    verification = payload.get("verification_status", "auto_confirmed")
    source = payload.get("source", "yolo")

    if verification in ("needs_review", "locate_unsure", "pending_locate", "rejected") or trust < settings.trust_threshold_semi:
        _send_to_review(job, payload, verification)
        return

    if verification == "auto_confirmed" and trust < settings.trust_threshold_trusted:
        _send_to_review(job, payload, "semi_trusted_auto_block")
        return

    if "duplicate_hash" in (job.get("suspicion_flags") or []):
        _send_to_review(job, payload, "duplicate_hash")
        return

    intel = IncidentIntelligenceAgent()
    triage = LGUTriageAgent()
    severity = float(payload.get("severity_score") or compute_severity(issue_type, confidence))

    rec = intel.recommend(lat, lng, issue_type, confidence)
    sb = get_supabase()

    if rec.action == "merge" and rec.incident_id:
        incident_id = rec.incident_id
        inc = sb.table("incidents").select("report_count,severity_score").eq("id", incident_id).single().execute().data
        sb.table("incidents").update({
            "report_count": (inc.get("report_count") or 1) + 1,
            "severity_score": max(float(inc.get("severity_score") or 0), severity),
        }).eq("id", incident_id).execute()
    else:
        inc = intel.create_incident(issue_type, lat, lng, severity, "passive")
        incident_id = inc["id"]

    frame_path = payload.get("frame_path")
    evidence_local = None
    evidence_url = None
    phash = None
    if frame_path and os.path.isfile(frame_path):
        from pathlib import Path
        frame_index = int(payload.get("frame_index") or 0)
        evidence_local = pipeline_storage.copy_to_evidence(Path(frame_path), job_id, frame_index)
        phash = frame_perceptual_hash(evidence_local)
        evidence_url = pipeline_storage.upload_evidence_to_supabase(
            evidence_local,
            f"passive/{job_id}_{frame_index}.jpg",
        )

    passive_jobs.insert_evidence(passive_jobs.build_evidence_row(
        job,
        {**payload, "issue_type": issue_type, "confidence": confidence, "trust_score": trust, "verification_status": verification},
        frame_path=evidence_local or frame_path,
        evidence_url=evidence_url,
        perceptual_hash=phash,
        lat=lat,
        lng=lng,
        incident_id=incident_id,
    ))

    bbox = payload.get("bounding_box") or {}
    det_row = {
        "detected_issue_type": issue_type,
        "confidence": confidence,
        "severity_score": severity,
        "bounding_box_json": bbox,
        "frame_timestamp": ts,
        "matched_latitude": lat,
        "matched_longitude": lng,
        "incident_id": incident_id,
        "job_id": job_id,
        "verification_status": verification,
        "trust_score": trust,
        "source": source,
    }
    if job.get("video_chunk_id"):
        det_row["video_chunk_id"] = job["video_chunk_id"]
    sb.table("detection_results").insert(det_row).execute()

    triage.apply_triage(incident_id)
    passive_jobs.update_clip_job(job_id, status="report_created")

    if job.get("video_chunk_id"):
        sb.table("video_chunks").update({"processing_status": "completed"}).eq("id", job["video_chunk_id"]).execute()


def _handle(payload: dict) -> None:
    passive_jobs.update_clip_job(payload["job_id"], status="candidate_created")
    _create_or_merge(payload)


def main() -> None:
    ensure_consumer_groups()
    logger.info("Incident worker started (%s)", CONSUMER)
    while True:
        messages = read_group(STREAM_CANDIDATES, CONSUMER, count=1, block_ms=5000)
        for msg_id, payload in messages:
            process_message(STREAM_CANDIDATES, msg_id, payload, _handle)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
