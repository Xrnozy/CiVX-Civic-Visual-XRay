import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2

from label_map import compute_severity, map_class_to_issue


@dataclass
class DetectionResult:
    issue_type: str
    confidence: float
    bounding_box: dict[str, float]
    severity_score: float
    raw_class: str
    frame_timestamp: float | None = None


class YOLODetector:
    def __init__(self, model_path: str = "yolov8n.pt", confidence: float = 0.35):
        self.model_path = model_path
        self.confidence = confidence
        self._model = None

    def _get_model(self):
        if self._model is None:
            from ultralytics import YOLO
            self._model = YOLO(self.model_path)
        return self._model

    def detect_image(self, image_path: str) -> DetectionResult | None:
        model = self._get_model()
        results = model.predict(image_path, conf=self.confidence, verbose=False)
        if not results or not results[0].boxes:
            return None
        boxes = results[0].boxes
        best_idx = int(boxes.conf.argmax())
        conf = float(boxes.conf[best_idx])
        cls_id = int(boxes.cls[best_idx])
        raw_class = model.names[cls_id]
        xyxy = boxes.xyxy[best_idx].tolist()
        issue = map_class_to_issue(raw_class)
        return DetectionResult(
            issue_type=issue,
            confidence=conf,
            bounding_box={"x1": xyxy[0], "y1": xyxy[1], "x2": xyxy[2], "y2": xyxy[3]},
            severity_score=compute_severity(issue, conf),
            raw_class=raw_class,
        )

    def detect_batch(self, image_paths: list[str]) -> list[DetectionResult | None]:
        if not image_paths:
            return []
        model = self._get_model()
        use_half = False
        try:
            import torch
            use_half = torch.cuda.is_available()
        except Exception:
            pass
        results = model.predict(
            image_paths,
            conf=self.confidence,
            verbose=False,
            batch=len(image_paths),
            half=use_half,
            imgsz=640,
        )
        out: list[DetectionResult | None] = []
        for res in results:
            if not res.boxes:
                out.append(None)
                continue
            boxes = res.boxes
            best_idx = int(boxes.conf.argmax())
            conf = float(boxes.conf[best_idx])
            cls_id = int(boxes.cls[best_idx])
            raw_class = model.names[cls_id]
            xyxy = boxes.xyxy[best_idx].tolist()
            issue = map_class_to_issue(raw_class)
            out.append(DetectionResult(
                issue_type=issue,
                confidence=conf,
                bounding_box={"x1": xyxy[0], "y1": xyxy[1], "x2": xyxy[2], "y2": xyxy[3]},
                severity_score=compute_severity(issue, conf),
                raw_class=raw_class,
            ))
        return out

    def extract_frames(self, video_path: str, fps: float = 1.0) -> list[tuple[str, float]]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30
        interval = max(1, int(video_fps / fps))
        frames: list[tuple[str, float]] = []
        tmp_dir = tempfile.mkdtemp(prefix="civx_frames_")
        idx = 0
        frame_num = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_num % interval == 0:
                ts = frame_num / video_fps
                path = os.path.join(tmp_dir, f"frame_{idx:04d}.jpg")
                cv2.imwrite(path, frame)
                frames.append((path, ts))
                idx += 1
            frame_num += 1
        cap.release()
        return frames

    def detect_video_chunk(
        self, video_path: str, gps_trace: list[dict[str, Any]] | None = None, fps: float = 1.0
    ) -> list[DetectionResult]:
        detections: list[DetectionResult] = []
        for frame_path, ts in self.extract_frames(video_path, fps=fps):
            det = self.detect_image(frame_path)
            if det and det.confidence >= self.confidence:
                det.frame_timestamp = ts
                detections.append(det)
        return detections


def extract_frames_ffmpeg(video_path: str, output_dir: str, fps: float = 1.0) -> list[str]:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    pattern = os.path.join(output_dir, "frame_%04d.jpg")
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps={fps}",
        pattern,
    ]
    subprocess.run(cmd, capture_output=True, check=False)
    return sorted(str(p) for p in Path(output_dir).glob("frame_*.jpg"))
