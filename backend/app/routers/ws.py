import asyncio
import json
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import get_supabase
from app.utils.audit import sanitize_incident_lgu

router = APIRouter(tags=["websocket"])
connections: Set[WebSocket] = set()

ACTIVE_QUEUE_STATUSES = ["detected", "pending_review", "verified", "assigned", "ongoing"]


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    try:
        while True:
            sb = get_supabase()
            rows = (
                sb.table("incidents")
                .select("*")
                .in_("status", ACTIVE_QUEUE_STATUSES)
                .order("triage_priority", desc=True)
                .limit(50)
                .execute()
                .data
                or []
            )
            queue = [sanitize_incident_lgu(r) for r in rows]
            await websocket.send_text(json.dumps({"type": "queue_update", "data": queue}))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        connections.remove(websocket)


async def broadcast(event: dict):
    dead = []
    for ws in connections:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.discard(ws)
