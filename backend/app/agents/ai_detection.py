import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "ai-worker"))

from detector import YOLODetector, DetectionResult
from app.config import settings

_detector: YOLODetector | None = None


def get_detector() -> YOLODetector:
    global _detector
    if _detector is None:
        _detector = YOLODetector(
            model_path=settings.yolo_model,
            confidence=settings.yolo_confidence,
        )
    return _detector


class AIDetectionAgent:
    def detect_image(self, image_path: str) -> DetectionResult:
        return get_detector().detect_image(image_path)

    def detect_video_chunk(self, video_path: str, gps_trace: list | None = None) -> list[DetectionResult]:
        return get_detector().detect_video_chunk(video_path, gps_trace)
