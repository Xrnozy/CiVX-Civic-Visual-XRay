from app.db import get_supabase


class CleanupCoordinationAgent:
    def match_event_to_incident(self, event_id: str, radius_m: float = 50) -> dict | None:
        sb = get_supabase()
        event = sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
        if event.get("issue_or_incident_id"):
            return sb.table("incidents").select("*").eq("id", event["issue_or_incident_id"]).single().execute().data
        nearby = sb.rpc("nearby_incidents", {
            "lat": event["latitude"],
            "lng": event["longitude"],
            "radius_m": radius_m,
            "p_issue_type": None,
            "active_only": True,
        }).execute().data
        if nearby:
            inc_id = nearby[0]["id"]
            sb.table("cleanup_events").update({"issue_or_incident_id": inc_id}).eq("id", event_id).execute()
            return nearby[0]
        return None

    def build_approval_package(self, event_id: str) -> dict:
        sb = get_supabase()
        event = sb.table("cleanup_events").select("*").eq("id", event_id).single().execute().data
        regs = sb.table("volunteer_registrations").select("*").eq("event_id", event_id).execute().data or []
        attendance = sb.table("attendance_records").select("*").eq("event_id", event_id).execute().data or []
        return {
            "event": event,
            "volunteer_count": len(regs),
            "attendance_summary": {
                "registered": len(regs),
                "checked_in": sum(1 for a in attendance if a.get("check_in_time")),
                "verified": sum(1 for a in attendance if a.get("lgu_status") == "verified"),
            },
        }

    def completion_recommendation(self, event_id: str) -> dict:
        pkg = self.build_approval_package(event_id)
        event = pkg["event"]
        has_proof = bool(event.get("before_photo_url") and event.get("after_photo_url"))
        verified = pkg["attendance_summary"]["verified"] > 0
        return {
            "recommend_complete": has_proof and verified,
            "has_before_after": has_proof,
            "verified_attendance": verified,
        }
