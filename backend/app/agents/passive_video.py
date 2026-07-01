import os
import tempfile
import uuid
from typing import Any

from app.agents.ai_detection import AIDetectionAgent
from app.agents.incident_intelligence import IncidentIntelligenceAgent
from app.agents.lgu_triage import LGUTriageAgent
from app.db import get_supabase


class PassiveVideoAgent:
    def __init__(self):
        self.ai = AIDetectionAgent()
        self.intel = IncidentIntelligenceAgent()
        self.triage = LGUTriageAgent()

    def process_chunk(self, chunk_id: str) -> dict[str, Any]:
        sb = get_supabase()
        chunk = sb.table("video_chunks").select("*").eq("id", chunk_id).single().execute().data
        sb.table("video_chunks").update({"processing_status": "processing"}).eq("id", chunk_id).execute()

        video_path = self._download_chunk(chunk["storage_url"])
        gps_trace = chunk.get("gps_trace_json") or []
        detections = self.ai.detect_video_chunk(video_path, gps_trace)

        results = []
        for det in detections:
            lat, lng = self._match_gps(gps_trace, det.frame_timestamp or 0)
            rec = self.intel.recommend(lat, lng, det.issue_type, det.confidence)
            if rec.action == "merge" and rec.incident_id:
                incident_id = rec.incident_id
                inc = sb.table("incidents").select("report_count,severity_score").eq("id", incident_id).single().execute().data
                sb.table("incidents").update({
                    "report_count": (inc.get("report_count") or 1) + 1,
                    "severity_score": max(float(inc.get("severity_score") or 0), det.severity_score),
                }).eq("id", incident_id).execute()
            else:
                inc = self.intel.create_incident(det.issue_type, lat, lng, det.severity_score, "passive")
                incident_id = inc["id"]

            det_row = sb.table("detection_results").insert({
                "video_chunk_id": chunk_id,
                "detected_issue_type": det.issue_type,
                "confidence": det.confidence,
                "severity_score": det.severity_score,
                "bounding_box_json": det.bounding_box,
                "frame_timestamp": det.frame_timestamp,
                "matched_latitude": lat,
                "matched_longitude": lng,
                "incident_id": incident_id,
            }).execute().data[0]
            self.triage.apply_triage(incident_id)
            results.append(det_row)

        sb.table("video_chunks").update({"processing_status": "completed"}).eq("id", chunk_id).execute()
        if os.path.exists(video_path):
            os.remove(video_path)
        return {"chunk_id": chunk_id, "detections": results}

    def _match_gps(self, trace: list, timestamp: float) -> tuple[float, float]:
        if not trace:
            return 14.5995, 120.9842
        best = trace[0]
        best_diff = abs(trace[0].get("t", 0) - timestamp)
        for pt in trace:
            diff = abs(pt.get("t", 0) - timestamp)
            if diff < best_diff:
                best_diff = diff
                best = pt
        return best.get("lat", 14.5995), best.get("lng", 120.9842)

    def _download_chunk(self, storage_url: str) -> str:
        import httpx
        path = os.path.join(tempfile.gettempdir(), f"civx_chunk_{uuid.uuid4().hex}.mp4")
        resp = httpx.get(storage_url, timeout=60)
        with open(path, "wb") as f:
            f.write(resp.content)
        return path
