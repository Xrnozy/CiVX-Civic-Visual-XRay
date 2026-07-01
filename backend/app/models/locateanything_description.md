# LocateAnything integration (CiVX analyzer)

Reference: [nvidia/LocateAnything-3B](https://huggingface.co/nvidia/LocateAnything-3B)

LocateAnything is a vision-language model for visual grounding. It accepts an **image + natural-language prompt** and returns structured coordinate tokens (`<box><x1><y1><x2><y2></box>`) normalized to `[0, 1000]`.

## Inference settings

- `max_new_tokens`: up to 8192 (default 2048 in worker)
- `generation_mode`: `"hybrid"` (recommended), `"fast"`, or `"slow"`

## Worker API (used by `locateanything_worker.py`)

| Task | Method | Prompt template |
|------|--------|-----------------|
| Object detection | `detect(img, categories)` | `Locate all the instances that matches the following description: {cats}.` |
| Phrase grounding (multi) | `ground_multi(img, phrase)` | `Locate all the instances that match the following description: {phrase}.` |
| Phrase grounding (single) | `ground_single(img, phrase)` | `Locate a single instance that matches the following description: {phrase}.` |

Categories in `detect()` are joined with `</c>` (e.g. `person</c>car`).

## Parsing output

```python
boxes = LocateAnythingWorker.parse_boxes(answer, image_width, image_height)
# Each box: {x1, y1, x2, y2} in pixel coordinates
```

## CiVX usage

The analyzer maps civic issue slugs (e.g. `garbage_pile`, `pothole`) to natural-language phrases via `civic_issues.py`, runs grounding/detection, then returns `AnalyzerDetection` payloads for the API.

Install (in addition to backend requirements):

```bash
pip install transformers==4.57.1 accelerate>=1.2.0 peft>=0.14.0 torch torchvision
```

If you see `cannot import name 'clear_device_cache' from accelerate.utils.memory`, upgrade accelerate:

```bash
pip install -U "accelerate>=1.2.0" peft
```

Then restart the backend (`uvicorn`).

Set `LOCATEANYTHING_MODEL=nvidia/LocateAnything-3B` and optionally `LOCATEANYTHING_DEVICE=cuda`.
