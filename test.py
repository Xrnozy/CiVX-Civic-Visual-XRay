"""YOLO detection CLI for local testing."""
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "ai-worker"))

from detector import YOLODetector


def main():
    parser = argparse.ArgumentParser(description="CiVX YOLO detection test")
    parser.add_argument("image", help="Path to image file")
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--conf", type=float, default=0.35)
    args = parser.parse_args()

    detector = YOLODetector(model_path=args.model, confidence=args.conf)
    result = detector.detect_image(args.image)
    if result:
        print(f"Issue: {result.issue_type}")
        print(f"Confidence: {result.confidence:.2f}")
        print(f"Severity: {result.severity_score}")
        print(f"BBox: {result.bounding_box}")
        print(f"Raw class: {result.raw_class}")
    else:
        print("No detection")


if __name__ == "__main__":
    main()
