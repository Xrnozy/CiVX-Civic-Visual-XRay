import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from app.agents.ai_detection import AIDetectionAgent
from app.agents.incident_intelligence import IncidentIntelligenceAgent
from app.agents.lgu_triage import LGUTriageAgent
from app.config import settings
from app.db import get_supabase
from app.utils.geocoding import resolve_barangay


class ReportIntakeAgent:
    def __init__(self):
        self.ai = AIDetectionAgent()
        self.intel = IncidentIntelligenceAgent()
        self.triage = LGUTriageAgent()

    def process(
        self,
        user_id: str,
        photo_payloads: list[dict[str, Any]],
        latitude: float,
        longitude: float,
        description: str | None = None,
        issue_type: str | None = None,
        barangay: str | None = None,
        photo_url: str | None = None,
        photo_urls: list[str] | None = None,
    ) -> dict[str, Any]:
        if not photo_payloads and not photo_url and not photo_urls:
            raise ValueError("Photo is required")
        if latitude is None or longitude is None:
            raise ValueError("GPS location is required")

        local_paths: list[str] = []
        uploaded_photo_urls: list[str] = []
        detection = None

        if photo_urls:
            uploaded_photo_urls = [url for url in photo_urls if url]

        for index, payload in enumerate(photo_payloads):
            photo_bytes = payload.get("bytes") or b""
            filename = payload.get("filename") or f"photo_{index + 1}.jpg"
            if not photo_bytes:
                continue

            suffix = Path(str(filename)).suffix or ".jpg"
            local_path = os.path.join(tempfile.gettempdir(), f"civx_{uuid.uuid4().hex}{suffix}")
            with open(local_path, "wb") as f:
                f.write(photo_bytes)
            local_paths.append(local_path)

            if index == 0:
                detection = self.ai.detect_image(local_path)

            uploaded_photo_urls.append(self._upload_photo(local_path, user_id, str(filename)))

        if uploaded_photo_urls and not photo_url:
            photo_url = uploaded_photo_urls[0]
        if photo_url and not uploaded_photo_urls:
            uploaded_photo_urls = [photo_url]
        if photo_url and uploaded_photo_urls and uploaded_photo_urls[0] != photo_url:
            uploaded_photo_urls = [photo_url, *[url for url in uploaded_photo_urls if url != photo_url]]
        if photo_url and photo_url not in uploaded_photo_urls:
            uploaded_photo_urls.insert(0, photo_url)

        final_issue = issue_type or (detection.issue_type if detection else "garbage_pile")
        ai_conf = detection.confidence if detection else 0.3
        severity = detection.severity_score if detection else 1.5
        bbox = detection.bounding_box if detection else None

        resolved_barangay = resolve_barangay(
            barangay=barangay,
            latitude=latitude,
            longitude=longitude,
        )
        address_text = None if resolved_barangay == "Unknown" else resolved_barangay

        sb = get_supabase()
        report_row = sb.table("reports").insert({
            "reporter_user_id": user_id,
            "issue_type": final_issue,
            "description": description,
            "latitude": latitude,
            "longitude": longitude,
            "address_text": address_text,
            "photo_url": photo_url or "",
            "photo_urls": uploaded_photo_urls,
            "ai_suggested_type": detection.issue_type if detection else final_issue,
            "ai_confidence": ai_conf,
            "ai_bounding_box": bbox,
            "ai_severity_score": severity,
            "status": "pending",
        }).execute().data[0]

        rec = self.intel.recommend(latitude, longitude, final_issue, ai_conf)
        if rec.action == "merge" and rec.incident_id:
            self.intel.merge_report(rec.incident_id, report_row["id"], severity)
            incident_id = rec.incident_id
            merged = True
        else:
            inc = self.intel.create_incident(
                final_issue,
                latitude,
                longitude,
                severity,
                "citizen",
                barangay=address_text,
            )
            incident_id = inc["id"]
            sb.table("reports").update({"merged_incident_id": incident_id}).eq("id", report_row["id"]).execute()
            merged = False

        self.triage.apply_triage(incident_id)

        for local_path in local_paths:
            if os.path.exists(local_path):
                os.remove(local_path)

        return {
            "report": report_row,
            "incident_id": incident_id,
            "merged": merged,
            "duplicate_score": rec.duplicate_score,
            "ai": {
                "issue_type": detection.issue_type if detection else final_issue,
                "confidence": ai_conf,
                "severity": severity,
            },
        }

    def _upload_photo(self, local_path: str, user_id: str, filename: str | None = None) -> str:
        sb = get_supabase()
        bucket = settings.supabase_report_photos_bucket
        suffix = Path(filename).suffix if filename else ".jpg"
        key = f"{user_id}/{uuid.uuid4().hex}{suffix or '.jpg'}"
        with open(local_path, "rb") as f:
            sb.storage.from_(bucket).upload(key, f.read(), {"content-type": "image/jpeg"})
        return sb.storage.from_(bucket).get_public_url(key)
