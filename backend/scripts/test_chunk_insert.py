"""One-off: verify video_chunks insert column names against live Supabase."""
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_supabase
from app.services import demo_sessions

LOG = Path(__file__).resolve().parents[2] / "debug-8b92e3.log"


def log(msg: str, data: dict) -> None:
    payload = {
        "sessionId": "8b92e3",
        "runId": "direct-test",
        "location": "test_chunk_insert.py",
        "message": msg,
        "data": data,
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
    }
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")
    print(json.dumps(payload))


def main() -> None:
    sb = get_supabase()
    demo = demo_sessions.create_session(label="chunk-insert-test")
    token = demo["token"]
    user_row = sb.table("users").select("id").limit(1).execute().data
    if not user_row:
        raise SystemExit("no users")
    user_id = user_row[0]["id"]
    route = (
        sb.table("passive_route_sessions")
        .insert({"user_id": user_id, "mode": "passive", "device_id": f"demo:{token}"})
        .execute()
        .data[0]
    )
    session_id = route["id"]
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "route_session_id": session_id,
        "storage_url": "",
        "chunk_index": 0,
        "start_time": now,
        "end_time": now,
        "gps_trace_json": [],
        "processing_status": "pending",
    }
    log("attempting insert", {"session_id": session_id, "keys": list(payload.keys())})
    try:
        row = sb.table("video_chunks").insert(payload).execute().data[0]
        log("insert ok", {"chunk_id": row["id"]})
        sb.table("video_chunks").delete().eq("id", row["id"]).execute()
        sb.table("passive_route_sessions").delete().eq("id", session_id).execute()
        print("SUCCESS")
    except Exception as exc:
        log("insert failed", {"error": str(exc)})
        print("FAILED:", exc)
        raise


if __name__ == "__main__":
    main()
