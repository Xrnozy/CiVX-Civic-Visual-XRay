import asyncio
from functools import partial

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.agents.analyzer import AnalyzerAgent, parse_gps_trace
from app.auth.firebase import AuthUser, get_current_user
from app.models.locateanything_worker import (
    analyzer_status_payload,
    locateanything_ready,
    reset_locateanything_state,
    warmup_locateanything,
)
from app.models.schemas import AnalyzerImageResponse, AnalyzerVideoResponse

router = APIRouter(prefix="/api/analyzer", tags=["analyzer"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "application/octet-stream"}
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024


@router.get("/status")
def analyzer_status():
    """Public readiness — loaded=false until weights are downloaded and on GPU."""
    return analyzer_status_payload()


@router.post("/warmup")
def analyzer_warmup():
    """Start background download/load of LocateAnything weights (public)."""
    return warmup_locateanything(blocking=False)


@router.post("/reset")
def analyzer_reset():
    """Clear stale load errors without restarting the server."""
    return reset_locateanything_state()


@router.post("/image", response_model=AnalyzerImageResponse)
async def analyze_image(
    image: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    issue_type: str | None = Form(None),
    user: AuthUser = Depends(get_current_user),
):
    if image.content_type and image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, or WebP.")

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Image file is empty.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image exceeds 15 MB limit.")

    if (latitude is None) ^ (longitude is None):
        raise HTTPException(status_code=400, detail="Provide both latitude and longitude for duplicate preview.")

    ready, error = locateanything_ready()
    if not ready:
        raise HTTPException(
            status_code=503,
            detail=error or "LocateAnything is not available. Install torch and transformers.",
        )

    agent = AnalyzerAgent()
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(
            None,
            partial(
                agent.analyze_image,
                content,
                image.filename,
                latitude,
                longitude,
                issue_type,
            ),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {exc}") from exc


@router.get("/queue/status")
def analyzer_queue_status():
    """GPU job queue — all analyzer + passive inference serializes here."""
    from app.services.chunk_queue import get_chunk_queue
    from app.services.gpu_queue import status as gpu_status

    return {
        "gpu": gpu_status(),
        "passive_chunks": get_chunk_queue().status(),
    }


@router.post("/video", response_model=AnalyzerVideoResponse)
async def analyze_video(
    video: UploadFile = File(...),
    gps_trace_json: str = Form("[]"),
    user: AuthUser = Depends(get_current_user),
):
    if video.content_type and video.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported video type. Use MP4.")

    content = await video.read()
    if not content:
        raise HTTPException(status_code=400, detail="Video file is empty.")
    if len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=400, detail="Video exceeds 50 MB limit.")

    ready, error = locateanything_ready()
    if not ready:
        raise HTTPException(
            status_code=503,
            detail=error or "LocateAnything is not available. Install torch and transformers.",
        )

    agent = AnalyzerAgent()
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(
            None,
            partial(agent.analyze_video, content, video.filename, parse_gps_trace(gps_trace_json)),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {exc}") from exc
