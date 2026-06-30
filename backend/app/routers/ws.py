import asyncio
import json
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import get_supabase

router = APIRouter(tags=["websocket"])
connections: Set[WebSocket] = set()


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    try:
        while True:
            sb = get_supabase()
            queue = sb.table("incidents").select("id,primary_issue_type,status,triage_priority,severity_score,created_at").in_("status", ["pending_review", "detected", "verified"]).order("triage_priority", desc=True).limit(20).execute().data
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
