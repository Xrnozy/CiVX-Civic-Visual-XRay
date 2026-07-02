"""HTTP smoke test for demo passive chunk upload."""
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
LOG = Path(__file__).resolve().parents[2] / "debug-8b92e3.log"
TOKEN = f"test-{uuid.uuid4().hex[:8]}"
MIN_WEBM = (
    b"\x1a\x45\xdf\xa3"  # EBML header stub (not valid video, enough for upload path)
    + b"\x00" * 128
)


def log(msg: str, data: dict) -> None:
    payload = {
        "sessionId": "8b92e3",
        "runId": "http-test",
        "location": "test_chunk_http.py",
        "message": msg,
        "data": data,
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
    }
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")
    print(json.dumps(payload))


def main() -> None:
    headers = {"X-Demo-Session": TOKEN}
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        health = client.get("/health")
        log("health", {"status": health.status_code, "body": health.text[:120]})
        session = client.post("/api/demo/passive/sessions", headers=headers, data={"mode": "passive"})
        log("start session", {"status": session.status_code, "body": session.text[:200]})
        session.raise_for_status()
        sid = session.json()["id"]
        now = datetime.now(timezone.utc).isoformat()
        files = {"video": ("chunk-0.webm", MIN_WEBM, "video/webm")}
        data = {
            "chunk_index": "0",
            "start_time": now,
            "end_time": now,
            "gps_trace_json": "[]",
        }
        chunk = client.post(
            f"/api/demo/passive/sessions/{sid}/chunks",
            headers=headers,
            data=data,
            files=files,
        )
        log("upload chunk", {"status": chunk.status_code, "body": chunk.text[:300]})
        if chunk.status_code >= 400:
            raise SystemExit(f"chunk upload failed: {chunk.status_code} {chunk.text}")
        print("SUCCESS", chunk.json())


if __name__ == "__main__":
    main()
