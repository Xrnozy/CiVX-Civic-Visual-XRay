"""NDJSON debug logging for passive pipeline latency investigation."""

from __future__ import annotations

import json
import time
from pathlib import Path

_DEBUG_LOG = Path(__file__).resolve().parents[3] / "debug-8b92e3.log"
_SESSION = "8b92e3"


def pipeline_debug_log(
    location: str,
    message: str,
    data: dict,
    hypothesis_id: str,
    *,
    run_id: str = "pipeline-latency",
) -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": _SESSION,
            "runId": run_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
            "hypothesisId": hypothesis_id,
        }
        with _DEBUG_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion
