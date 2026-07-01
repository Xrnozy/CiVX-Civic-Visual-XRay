from app.agents.ai_detection import AIDetectionAgent
from app.agents.incident_intelligence import IncidentIntelligenceAgent
from app.agents.lgu_triage import LGUTriageAgent
from app.db import get_supabase


class DriverSignalAgent:
    BUMP_THRESHOLD = 2.5

    def __init__(self):
        self.ai = AIDetectionAgent()
        self.intel = IncidentIntelligenceAgent()
        self.triage = LGUTriageAgent()

    def process_sensor_event(
        self,
        route_session_id: str,
        latitude: float,
        longitude: float,
        magnitude: float,
        event_type: str,
        timestamp: str,
        video_chunk_id: str | None = None,
    ) -> dict:
        sb = get_supabase()
        event = sb.table("road_anomaly_events").insert({
            "route_session_id": route_session_id,
            "video_chunk_id": video_chunk_id,
            "event_type": event_type,
            "magnitude": magnitude,
            "latitude": latitude,
            "longitude": longitude,
            "event_timestamp": timestamp,
        }).execute().data[0]

        issue_type = "pothole" if event_type in ("bump", "drop") else "uneven_road"
        if magnitude >= self.BUMP_THRESHOLD:
            rec = self.intel.recommend(latitude, longitude, issue_type, 0.6)
            if rec.action == "merge" and rec.incident_id:
                incident_id = rec.incident_id
            else:
                inc = self.intel.create_incident(issue_type, latitude, longitude, 6.0, "driver")
                incident_id = inc["id"]
            sb.table("road_anomaly_events").update({
                "ai_confirmed": True,
                "incident_id": incident_id,
            }).eq("id", event["id"]).execute()
            self.triage.apply_triage(incident_id)
            return {"event": event, "incident_id": incident_id, "confirmed": True}
        return {"event": event, "confirmed": False}
