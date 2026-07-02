import json
import threading
import time
from pathlib import Path

from supabase import Client, create_client

from app.config import settings

_client: Client | None = None
_active_supabase_calls = 0
_active_executes = 0
_active_supabase_lock = threading.Lock()
_DEBUG_LOG = Path(__file__).resolve().parents[2] / "debug-427024.log"


def _agent_log(location: str, message: str, data: dict, hypothesis_id: str, run_id: str = "pre-fix") -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": "427024",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


def _client_http2_enabled(client: Client) -> bool | None:
    try:
        session = client.postgrest.session
        return bool(getattr(session, "http2", None))
    except Exception:
        return None


def execute_logged(step: str, query, hypothesis_id: str = "H3"):
    global _active_executes
    thread_id = threading.get_ident()
    with _active_supabase_lock:
        _active_executes += 1
        concurrent_executes = _active_executes
    client = get_supabase()
    # #region agent log
    _agent_log(
        "db.py:execute_logged",
        "before_execute",
        {
            "step": step,
            "thread_id": thread_id,
            "client_id": id(client),
            "http2": _client_http2_enabled(client),
            "active_calls": _active_supabase_calls,
            "concurrent_executes": concurrent_executes,
        },
        hypothesis_id,
    )
    # #endregion
    try:
        result = query.execute()
        # #region agent log
        _agent_log(
            "db.py:execute_logged",
            "after_execute",
            {"step": step, "thread_id": thread_id, "ok": True},
            hypothesis_id,
        )
        # #endregion
        return result
    except Exception as exc:
        # #region agent log
        _agent_log(
            "db.py:execute_logged",
            "execute_failed",
            {
                "step": step,
                "thread_id": thread_id,
                "error_type": type(exc).__name__,
                "error": str(exc)[:200],
                "client_id": id(client),
                "http2": _client_http2_enabled(client),
                "active_calls": _active_supabase_calls,
                "concurrent_executes": concurrent_executes,
            },
            "H1,H2,H4,H5",
        )
        # #endregion
        raise
    finally:
        with _active_supabase_lock:
            _active_executes -= 1


def get_supabase() -> Client:
    global _client, _active_supabase_calls
    thread_id = threading.get_ident()
    with _active_supabase_lock:
        _active_supabase_calls += 1
        active_calls = _active_supabase_calls
    created = False
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            with _active_supabase_lock:
                _active_supabase_calls -= 1
            raise RuntimeError("Supabase credentials not configured")
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
        created = True
    # #region agent log
    _agent_log(
        "db.py:get_supabase",
        "client_access",
        {
            "thread_id": thread_id,
            "client_id": id(_client),
            "created": created,
            "http2": _client_http2_enabled(_client),
            "active_calls": active_calls,
        },
        "H1,H2,H5",
    )
    # #endregion
    try:
        return _client
    finally:
        with _active_supabase_lock:
            _active_supabase_calls -= 1
