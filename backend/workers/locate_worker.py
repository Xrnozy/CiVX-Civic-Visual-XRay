"""GPU LocateAnything verification worker for medium-confidence YOLO hits."""

from __future__ import annotations

import logging
import os
import sys

from PIL import Image

from workers import _bootstrap  # noqa: F401
from workers._common import process_message

from app.config import settings
from app.models.civic_issues import CIVIC_DETECT_LABELS, infer_issue_type_from_answer, phrase_for_issue
from app.models.locateanything_worker import LocateAnythingWorker, get_locateanything_worker
from app.services import passive_jobs
from app.services.gpu_lock import gpu_lock
from app.services.gpu_queue import run_gpu_job
from app.services.redis_queue import (
    STREAM_CANDIDATES,
    STREAM_LOCATE,
    STREAM_REVIEW,
    ensure_consumer_groups,
    enqueue,
    read_group,
)
from app.services.worker_registry import WorkerHeartbeat

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("locate_worker")
CONSUMER = f"locate-{os.getpid()}"


def _warmup_model(hb: WorkerHeartbeat) -> None:
    worker = get_locateanything_worker()
    device = getattr(worker, "device", settings.locateanything_device)
    hb.set_model(loaded=True, name=settings.locateanything_model, device=str(device))
    logger.info("LocateAnything ready on %s", device)


def _region_issue_slug(region: dict) -> str:
    label = region.get("label")
    if not label:
        return ""
    return infer_issue_type_from_answer(f"<ref>{label}</ref>", None)


def _filter_kwargs() -> dict:
    return {
        "min_area_ratio": settings.locateanything_min_box_area_ratio,
        "max_sky_center_ratio": settings.locateanything_max_sky_center_ratio,
        "max_boxes": settings.locateanything_max_boxes_per_frame,
    }


def _run_multi_issue_detect(worker: LocateAnythingWorker, image: Image.Image, kwargs: dict) -> tuple[str, list[dict]]:
    width, height = image.size
    result = worker.detect(image, CIVIC_DETECT_LABELS, **kwargs)
    answer = str(result.get("answer", ""))
    labeled = LocateAnythingWorker.parse_labeled_regions(answer, width, height)
    filtered = LocateAnythingWorker.filter_labeled_regions(labeled, width, height, **_filter_kwargs())
    return answer, filtered


def _run_phrase_grounding(
    worker: LocateAnythingWorker,
    image: Image.Image,
    phrase: str,
    kwargs: dict,
) -> tuple[str, list[dict]]:
    width, height = image.size
    for run in (
        lambda: worker.ground_multi(image, phrase, **kwargs),
        lambda: worker.ground_single(image, phrase, **kwargs),
    ):
        result = run()
        answer = str(result.get("answer", ""))
        labeled = LocateAnythingWorker.parse_labeled_regions(answer, width, height)
        if not labeled:
            boxes = LocateAnythingWorker.parse_boxes(answer, width, height)
            labeled = [{**box, "label": phrase} for box in boxes]
        filtered = LocateAnythingWorker.filter_labeled_regions(labeled, width, height, **_filter_kwargs())
        if filtered:
            return answer, filtered
    return answer, []


def _primary_box_for_issue(regions: list[dict], issue_type: str) -> dict | None:
    for region in regions:
        if _region_issue_slug(region) == issue_type:
            return {k: region[k] for k in ("x1", "y1", "x2", "y2")}
    if regions:
        return {k: regions[0][k] for k in ("x1", "y1", "x2", "y2")}
    return None


def _verify_frame(frame_path: str, issue_type: str) -> tuple[bool, float, dict]:
    def _run():
        worker = get_locateanything_worker()
        image = Image.open(frame_path).convert("RGB")
        kwargs = {
            "generation_mode": settings.locateanything_generation_mode,
            "max_new_tokens": settings.locateanything_max_new_tokens,
            "verbose": False,
        }

        answer, regions = _run_multi_issue_detect(worker, image, kwargs)
        if not regions:
            phrase = phrase_for_issue(issue_type)
            answer, regions = _run_phrase_grounding(worker, image, phrase, kwargs)

        confirmed = any(_region_issue_slug(region) == issue_type for region in regions)
        if not confirmed and regions:
            confirmed = True

        conf = 0.85 if confirmed else 0.4
        primary = _primary_box_for_issue(regions, issue_type)
        return confirmed, conf, {
            "answer": answer,
            "boxes": [{k: r[k] for k in ("x1", "y1", "x2", "y2")} for r in regions],
            "regions": regions,
            "primary_box": primary,
            "detected_issues": list(dict.fromkeys(_region_issue_slug(r) for r in regions if _region_issue_slug(r))),
        }

    with gpu_lock(f"locate:{issue_type}"):
        return run_gpu_job(_run, label=f"locate:{issue_type}")


def _handle(payload: dict) -> None:
    job_id = payload["job_id"]
    passive_jobs.update_clip_job(job_id, status="locate_verifying")
    frame_path = payload["frame_path"]
    issue_type = payload["issue_type"]

    confirmed, conf, raw = _verify_frame(frame_path, issue_type)
    primary_box = raw.get("primary_box")
    payload = {
        **payload,
        "confidence": conf,
        "raw_ai_result": raw,
    }
    if isinstance(primary_box, dict):
        payload["bounding_box"] = primary_box

    if confirmed:
        enqueue(STREAM_CANDIDATES, {
            **payload,
            "verification_status": "ai_verified",
            "source": "locate_anything",
        })
    else:
        enqueue(STREAM_REVIEW, {
            **payload,
            "verification_status": "needs_review",
            "source": "locate_anything",
        })


def main() -> None:
    ensure_consumer_groups()
    hb = WorkerHeartbeat("locate")
    hb.start()
    try:
        _warmup_model(hb)
    except Exception as exc:
        logger.warning("LocateAnything warmup failed (will retry on first job): %s", exc)
        hb.set_model(loaded=False, name=settings.locateanything_model)

    logger.info("Locate worker started (%s)", CONSUMER)
    while True:
        messages = read_group(STREAM_LOCATE, CONSUMER, count=1, block_ms=5000)
        for msg_id, payload in messages:
            process_message(STREAM_LOCATE, msg_id, payload, _handle)
            hb.increment_jobs()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
