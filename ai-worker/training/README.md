# YOLO Fine-Tuning Pipeline (Future)

1. Export LGU corrections via `export_corrections.py`
2. Build YOLO dataset in COCO format with civic issue labels
3. Fine-tune `yolov8n.pt` on collected images
4. Deploy new weights to `YOLO_MODEL` env var

See `export_corrections.py` for the first step.
