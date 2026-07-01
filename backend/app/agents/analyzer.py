import io
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import cv2
from PIL import Image

from app.agents.incident_intelligence import IncidentIntelligenceAgent
from app.config import settings
from app.models.civic_issues import (
    CIVIC_DETECT_LABELS,
    PASSIVE_VIDEO_GROUND_PHRASE,
    compute_severity,
    infer_issue_type_from_answer,
    phrase_for_issue,
)
from app.models.locateanything_worker import LocateAnythingWorker, get_locateanything_worker
from app.models.schemas import (
    AnalyzerBoundingBox,
    AnalyzerDetection,
    AnalyzerDuplicateHint,
    AnalyzerImageResponse,
    AnalyzerVideoResponse,
)


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict[str, Any]) -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": "8b92e3",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        log_path = Path(__file__).resolve().parents[3] / ".cursor" / "debug-8b92e3.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


class AnalyzerAgent:
    """Stateless civic image/video analyzer using NVIDIA LocateAnything (no DB writes)."""

    def __init__(self):
        self.intel = IncidentIntelligenceAgent()

    def _worker(self) -> LocateAnythingWorker:
        return get_locateanything_worker()

    def _predict_kwargs(self) -> dict[str, Any]:
        return {
            "generation_mode": settings.locateanything_generation_mode,
            "max_new_tokens": settings.locateanything_max_new_tokens,
            "verbose": False,
        }

    def _video_predict_kwargs(self) -> dict[str, Any]:
        return {
            "generation_mode": settings.locateanything_video_generation_mode,
            "max_new_tokens": settings.locateanything_video_max_new_tokens,
            "verbose": False,
        }

    def _filter_boxes(self, boxes: list[dict[str, float]], width: int, height: int) -> list[dict[str, float]]:
        return LocateAnythingWorker.filter_boxes(
            boxes,
            width,
            height,
            min_area_ratio=settings.locateanything_min_box_area_ratio,
            max_sky_center_ratio=settings.locateanything_max_sky_center_ratio,
            max_boxes=settings.locateanything_max_boxes_per_frame,
        )

    def _has_boxes(self, image: Image.Image, result: dict[str, Any]) -> bool:
        answer = str(result.get("answer", ""))
        width, height = image.size
        raw = LocateAnythingWorker.parse_boxes(answer, width, height)
        return bool(self._filter_boxes(raw, width, height))

    def _run_grounding(
        self,
        worker: LocateAnythingWorker,
        image: Image.Image,
        issue_type: str | None,
    ) -> dict[str, Any]:
        """Run grounding with retries — long multi-issue prompts yield <box>None</box>."""
        kwargs = self._predict_kwargs()
        last_result: dict[str, Any] = {"answer": ""}
        passes: list[str] = []
        t0 = time.perf_counter()

        if issue_type:
            phrase = phrase_for_issue(issue_type)
            for name, run in (
                ("ground_multi", lambda: worker.ground_multi(image, phrase, **kwargs)),
                ("ground_single", lambda: worker.ground_single(image, phrase, **kwargs)),
            ):
                passes.append(name)
                last_result = run()
                if self._has_boxes(image, last_result):
                    _debug_log(
                        "H2",
                        "analyzer.py:_run_grounding",
                        "grounding_done",
                        {
                            "passes": passes,
                            "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                            "box_count": len(LocateAnythingWorker.parse_boxes(str(last_result.get("answer", "")), *image.size)),
                            "answer_preview": str(last_result.get("answer", ""))[:200],
                            "issue_type": issue_type,
                        },
                    )
                    return last_result
            _debug_log(
                "H2",
                "analyzer.py:_run_grounding",
                "grounding_done_no_boxes",
                {"passes": passes, "elapsed_ms": round((time.perf_counter() - t0) * 1000), "issue_type": issue_type},
            )
            return last_result

        last_result = worker.detect(image, CIVIC_DETECT_LABELS, **kwargs)
        passes.append("detect")
        if self._has_boxes(image, last_result):
            answer = str(last_result.get("answer", ""))
            boxes = LocateAnythingWorker.parse_boxes(answer, *image.size)
            _debug_log(
                "H1",
                "analyzer.py:_run_grounding",
                "detect_hit",
                {
                    "passes": passes,
                    "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                    "box_count": len(boxes),
                    "inferred_issue": infer_issue_type_from_answer(answer, None),
                    "answer_preview": answer[:300],
                },
            )
            return last_result

        issue = infer_issue_type_from_answer(str(last_result.get("answer", "")), None)
        phrase = phrase_for_issue(issue)
        for name, run in (
            ("ground_multi_retry", lambda: worker.ground_multi(image, phrase, **kwargs)),
            ("ground_single_retry", lambda: worker.ground_single(image, phrase, **kwargs)),
        ):
            passes.append(name)
            last_result = run()
            if self._has_boxes(image, last_result):
                answer = str(last_result.get("answer", ""))
                boxes = LocateAnythingWorker.parse_boxes(answer, *image.size)
                _debug_log(
                    "H1",
                    "analyzer.py:_run_grounding",
                    "retry_hit",
                    {
                        "passes": passes,
                        "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                        "box_count": len(boxes),
                        "inferred_issue": issue,
                        "answer_preview": answer[:300],
                    },
                )
                return last_result
        _debug_log(
            "H2",
            "analyzer.py:_run_grounding",
            "grounding_exhausted",
            {"passes": passes, "elapsed_ms": round((time.perf_counter() - t0) * 1000), "inferred_issue": issue},
        )
        return last_result

    def _run_grounding_video(
        self,
        worker: LocateAnythingWorker,
        image: Image.Image,
    ) -> dict[str, Any]:
        """Passive video path: one fast ground_single pass per frame (spec: 10s chunks)."""
        kwargs = self._video_predict_kwargs()
        t0 = time.perf_counter()
        result = worker.ground_single(image, PASSIVE_VIDEO_GROUND_PHRASE, **kwargs)
        width, height = image.size
        raw = LocateAnythingWorker.parse_boxes(str(result.get("answer", "")), width, height)
        filtered = self._filter_boxes(raw, width, height)
        _debug_log(
            "H2",
            "analyzer.py:_run_grounding_video",
            "passive_frame",
            {
                "passes": ["ground_single"],
                "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                "raw_box_count": len(raw),
                "filtered_box_count": len(filtered),
                "generation_mode": kwargs["generation_mode"],
                "max_new_tokens": kwargs["max_new_tokens"],
            },
        )
        return result

    def analyze_image(
        self,
        image_bytes: bytes,
        filename: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        issue_type: str | None = None,
    ) -> AnalyzerImageResponse:
        image = self._prepare_image(image_bytes)
        worker = self._worker()

        result = self._run_grounding(worker, image, issue_type)
        detection = self._result_to_detection(image, result, preferred_issue=issue_type)
        width, height = image.size
        detection = detection.model_copy(update={"image_width": width, "image_height": height})

        hint = None
        if latitude is not None and longitude is not None:
            rec = self.intel.recommend(
                latitude,
                longitude,
                detection.issue_type,
                detection.confidence,
            )
            hint = AnalyzerDuplicateHint(
                action=rec.action,
                duplicate_score=rec.duplicate_score,
                incident_id=rec.incident_id,
                reason=rec.reason,
            )
        return AnalyzerImageResponse(detection=detection, duplicate_hint=hint, image_width=width, image_height=height)

    def analyze_video(
        self,
        video_bytes: bytes,
        filename: str | None = None,
        gps_trace: list[dict[str, Any]] | None = None,
    ) -> AnalyzerVideoResponse:
        local_path = self._write_temp(video_bytes, filename, default_suffix=".mp4")
        try:
            frame_pairs = self._extract_frames(
                local_path,
                fps=settings.locateanything_video_sample_fps,
                max_frames=settings.locateanything_video_max_frames,
            )
            # #region agent log
            _debug_log(
                "H8",
                "analyzer.py:analyze_video",
                "frames_extracted",
                {
                    "frame_count": len(frame_pairs),
                    "timestamps": [round(ts, 2) for _, ts in frame_pairs],
                    "generation_mode": settings.locateanything_video_generation_mode,
                    "max_new_tokens": settings.locateanything_video_max_new_tokens,
                    "sample_fps": settings.locateanything_video_sample_fps,
                },
            )
            # #endregion
            worker = self._worker()
            trace = gps_trace or []
            detections: list[AnalyzerDetection] = []
            video_t0 = time.perf_counter()

            for frame_path, ts in frame_pairs:
                frame_t0 = time.perf_counter()
                image = self._prepare_image(open(frame_path, "rb").read())
                result = self._run_grounding_video(worker, image)
                det = self._result_to_detection(image, result, video_mode=True)
                width, height = image.size
                det = det.model_copy(update={"image_width": width, "image_height": height})
                if trace:
                    lat, lng = self._match_gps(trace, ts)
                    det = det.model_copy(update={"matched_latitude": lat, "matched_longitude": lng})
                det = det.model_copy(update={"frame_timestamp": ts})
                # #region agent log
                _debug_log(
                    "H3",
                    "analyzer.py:analyze_video",
                    "frame_detection",
                    {
                        "frame_ts": round(ts, 2),
                        "frame_elapsed_ms": round((time.perf_counter() - frame_t0) * 1000),
                        "issue_type": det.issue_type,
                        "confidence": det.confidence,
                        "box_count": len(det.bounding_boxes),
                        "kept": det.confidence >= settings.locateanything_min_confidence,
                        "min_confidence": settings.locateanything_min_confidence,
                        "primary_box": {
                            "x1": det.bounding_box.x1,
                            "y1": det.bounding_box.y1,
                            "x2": det.bounding_box.x2,
                            "y2": det.bounding_box.y2,
                        },
                    },
                )
                # #endregion
                if det.confidence >= settings.locateanything_min_confidence:
                    detections.append(det)
                if os.path.exists(frame_path):
                    os.remove(frame_path)

            # #region agent log
            _debug_log(
                "H6",
                "analyzer.py:analyze_video",
                "video_complete",
                {
                    "total_elapsed_ms": round((time.perf_counter() - video_t0) * 1000),
                    "frames_analyzed": len(frame_pairs),
                    "detections_kept": len(detections),
                    "total_boxes": sum(len(d.bounding_boxes) for d in detections),
                },
            )
            # #endregion
            return AnalyzerVideoResponse(detections=detections, frames_analyzed=len(frame_pairs))
        finally:
            self._cleanup(local_path)

    @staticmethod
    def _prepare_image(image_bytes: bytes, max_side: int = 1280) -> Image.Image:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = image.size
        if max(w, h) > max_side:
            scale = max_side / max(w, h)
            image = image.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        return image

    def _result_to_detection(
        self,
        image: Image.Image,
        result: dict[str, Any],
        preferred_issue: str | None = None,
        video_mode: bool = False,
    ) -> AnalyzerDetection:
        answer = str(result.get("answer", ""))
        width, height = image.size
        raw_boxes = LocateAnythingWorker.parse_boxes(answer, width, height)
        boxes = self._filter_boxes(raw_boxes, width, height)
        issue = infer_issue_type_from_answer(answer, preferred_issue)
        if boxes:
            image_area = width * height
            largest = max(boxes, key=lambda b: (b["x2"] - b["x1"]) * (b["y2"] - b["y1"]))
            area_ratio = ((largest["x2"] - largest["x1"]) * (largest["y2"] - largest["y1"])) / image_area
            confidence = round(min(0.92, 0.72 + area_ratio * 8), 2)
        else:
            confidence = 0.2 if video_mode else 0.35
        bbox = boxes[0] if boxes else {"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0}
        all_boxes = [
            AnalyzerBoundingBox(
                x1=float(b["x1"]),
                y1=float(b["y1"]),
                x2=float(b["x2"]),
                y2=float(b["y2"]),
            )
            for b in boxes
        ]

        return AnalyzerDetection(
            issue_type=issue,
            confidence=confidence,
            severity_score=compute_severity(issue, confidence),
            bounding_box=AnalyzerBoundingBox(
                x1=float(bbox["x1"]),
                y1=float(bbox["y1"]),
                x2=float(bbox["x2"]),
                y2=float(bbox["y2"]),
            ),
            bounding_boxes=all_boxes,
            raw_class=phrase_for_issue(issue),
            model_answer=answer[:2000] if answer else None,
        )

    @staticmethod
    def _extract_frames(
        video_path: str,
        fps: float = 0.33,
        max_frames: int = 4,
    ) -> list[tuple[str, float]]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30
        interval = max(1, int(video_fps / max(fps, 0.1)))
        frames: list[tuple[str, float]] = []
        frame_num = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_num % interval == 0:
                ts = frame_num / video_fps
                path = os.path.join(tempfile.gettempdir(), f"civx_la_frame_{uuid.uuid4().hex}.jpg")
                cv2.imwrite(path, frame)
                frames.append((path, ts))
            frame_num += 1
        cap.release()

        if len(frames) <= max_frames:
            return frames
        step = len(frames) / max_frames
        return [frames[int(i * step)] for i in range(max_frames)]

    @staticmethod
    def _match_gps(trace: list[dict[str, Any]], timestamp: float) -> tuple[float, float]:
        if not trace:
            return 14.5995, 120.9842
        best = trace[0]
        best_diff = abs(trace[0].get("t", 0) - timestamp)
        for pt in trace:
            diff = abs(pt.get("t", 0) - timestamp)
            if diff < best_diff:
                best_diff = diff
                best = pt
        return float(best.get("lat", 14.5995)), float(best.get("lng", 120.9842))

    @staticmethod
    def _write_temp(data: bytes, filename: str | None, default_suffix: str) -> str:
        suffix = Path(filename).suffix if filename else default_suffix
        path = os.path.join(tempfile.gettempdir(), f"civx_analyze_{uuid.uuid4().hex}{suffix}")
        with open(path, "wb") as f:
            f.write(data)
        return path

    @staticmethod
    def _cleanup(path: str) -> None:
        if path and os.path.exists(path):
            os.remove(path)


def parse_gps_trace(gps_trace_json: str) -> list[dict[str, Any]]:
    if not gps_trace_json or gps_trace_json.strip() in ("", "[]"):
        return []
    try:
        parsed = json.loads(gps_trace_json)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []
