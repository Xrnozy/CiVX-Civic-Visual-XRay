import math

from app.config import settings
from app.db import get_supabase


class EcoQuestVerificationAgent:
    def verify_submission(self, submission_id: str) -> dict:
        sb = get_supabase()
        sub = sb.table("ecoquest_submissions").select("*, ecoquest_tasks(*)").eq("id", submission_id).single().execute().data
        task = sub.get("ecoquest_tasks") or {}
        required = task.get("required_proof") or {}
        reasons = []
        score = 0
        total = 0

        if required.get("before_photo"):
            total += 1
            if sub.get("before_photo_url"):
                score += 1
            else:
                reasons.append("Missing before photo")

        if required.get("after_photo"):
            total += 1
            if sub.get("after_photo_url"):
                score += 1
            else:
                reasons.append("Missing after photo")

        if required.get("gps"):
            total += 1
            if sub.get("latitude") and sub.get("longitude"):
                task_lat = task.get("latitude")
                task_lng = task.get("longitude")
                if task_lat and task_lng:
                    dist = self._haversine(sub["latitude"], sub["longitude"], task_lat, task_lng)
                    if dist <= settings.attendance_gps_radius_m:
                        score += 1
                    else:
                        reasons.append(f"GPS too far ({dist:.0f}m)")
                else:
                    score += 1
            else:
                reasons.append("Missing GPS check-in")

        ratio = score / total if total else 0
        if ratio >= 1.0:
            status = "approved"
            reward_eligible = True
        elif ratio >= 0.5:
            status = "manual_review"
            reward_eligible = False
        else:
            status = "rejected"
            reward_eligible = False

        sb.table("ecoquest_submissions").update({
            "verification_status": status,
            "verification_notes": "; ".join(reasons) if reasons else "All checks passed",
            "reward_eligible": reward_eligible,
        }).eq("id", submission_id).execute()

        return {
            "verification_status": status,
            "reward_eligible": reward_eligible,
            "reasons": reasons,
            "score_ratio": ratio,
        }

    @staticmethod
    def _haversine(lat1, lng1, lat2, lng2) -> float:
        r = 6371000
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lng2 - lng1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return 2 * r * math.asin(math.sqrt(a))
