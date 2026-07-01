import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "shared"))
from constants import ISSUE_URGENCY

from app.db import get_supabase


class LGUTriageAgent:
    def prioritize(self, incident: dict) -> dict:
        issue_type = incident.get("primary_issue_type", "garbage_pile")
        severity = float(incident.get("severity_score") or 0)
        report_count = int(incident.get("report_count") or 1)
        urgency = ISSUE_URGENCY.get(issue_type, 5)
        priority = int(min(100, urgency * 5 + severity + report_count * 2))
        department = self.suggest_department(issue_type)
        return {
            "triage_priority": priority,
            "suggested_department_id": department.get("id") if department else None,
            "review_notes": f"Priority {priority}: {issue_type} with {report_count} report(s)",
            "suggested_next_action": "verify" if priority >= 50 else "manual_review",
        }

    def suggest_department(self, issue_type: str) -> dict | None:
        sb = get_supabase()
        depts = sb.table("departments").select("*").execute().data or []
        for dept in depts:
            types = dept.get("issue_types") or []
            if issue_type in types:
                return dept
        return depts[0] if depts else None

    def apply_triage(self, incident_id: str) -> dict:
        sb = get_supabase()
        inc = sb.table("incidents").select("*").eq("id", incident_id).single().execute().data
        triage = self.prioritize(inc)
        updates = {
            "triage_priority": triage["triage_priority"],
            "suggested_department_id": triage["suggested_department_id"],
        }
        sb.table("incidents").update(updates).eq("id", incident_id).execute()
        return triage
