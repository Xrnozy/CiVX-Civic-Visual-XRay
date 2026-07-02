"""LocateAnything worker — see locateanything_description.md."""

from __future__ import annotations

import logging
import re
import threading
from typing import Any

logger = logging.getLogger(__name__)

_worker: LocateAnythingWorker | None = None
_load_error: str | None = None
_loading = False
_resolved_device: str | None = None
_load_lock = threading.Lock()


def _ensure_accelerate_compat() -> None:
    """peft imports clear_device_cache; older accelerate versions lack it."""
    try:
        from accelerate.utils.memory import clear_device_cache  # noqa: F401
    except ImportError:
        import accelerate.utils.memory as memory_mod

        if hasattr(memory_mod, "clear_device_cache"):
            return

        def clear_device_cache() -> None:
            try:
                import torch

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass

        memory_mod.clear_device_cache = clear_device_cache


def _import_hf_auto_classes():
    """Import HF auto classes; surface version/python in errors."""
    import sys

    import transformers

    try:
        from transformers.models.auto.modeling_auto import AutoModel
        from transformers.models.auto.processing_auto import AutoProcessor
        from transformers.models.auto.tokenization_auto import AutoTokenizer
    except ImportError:
        from transformers import AutoModel, AutoProcessor, AutoTokenizer

    return AutoModel, AutoProcessor, AutoTokenizer, transformers.__version__


class LocateAnythingWorker:
    """Stateful worker that loads the model once and serves perception queries."""

    def __init__(self, model_path: str, device: str = "cuda", dtype=None):
        import torch
        from PIL import Image  # noqa: F401

        AutoModel, AutoProcessor, AutoTokenizer, _ = _import_hf_auto_classes()

        if dtype is None:
            dtype = torch.bfloat16 if device.startswith("cuda") else torch.float32

        self.device = device
        self.dtype = dtype

        logger.info("LocateAnything: loading tokenizer from %s", model_path)
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

        logger.info("LocateAnything: loading processor")
        self.processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)

        logger.info("LocateAnything: loading model weights onto %s (this may take several minutes)", device)
        self.model = AutoModel.from_pretrained(
            model_path,
            dtype=dtype,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        ).to(device).eval()
        logger.info("LocateAnything: model ready on %s", device)

    def predict(
        self,
        image,
        question: str,
        generation_mode: str = "hybrid",
        max_new_tokens: int = 2048,
        temperature: float = 0.7,
        verbose: bool = False,
    ) -> dict[str, Any]:
        import torch

        with torch.no_grad():
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {"type": "text", "text": question},
                    ],
                }
            ]

            text = self.processor.py_apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            images, videos = self.processor.process_vision_info(messages)
            inputs = self.processor(
                text=[text], images=images, videos=videos, return_tensors="pt"
            ).to(self.device)

            pixel_values = inputs["pixel_values"].to(self.dtype)
            input_ids = inputs["input_ids"]
            image_grid_hws = inputs.get("image_grid_hws", None)

            logger.info("LocateAnything: running inference on %s", self.device)
            response = self.model.generate(
                pixel_values=pixel_values,
                input_ids=input_ids,
                attention_mask=inputs["attention_mask"],
                image_grid_hws=image_grid_hws,
                tokenizer=self.tokenizer,
                max_new_tokens=max_new_tokens,
                use_cache=True,
                generation_mode=generation_mode,
                temperature=temperature,
                do_sample=True,
                top_p=0.9,
                repetition_penalty=1.1,
                verbose=verbose,
            )

            result: dict[str, Any] = {"answer": response[0] if isinstance(response, tuple) else response}
            if isinstance(response, tuple) and len(response) >= 3:
                result["history"] = response[1]
                result["stats"] = response[2]
            return result

    def detect(self, image, categories: list[str], **kwargs) -> dict[str, Any]:
        cats = "</c>".join(categories)
        prompt = f"Locate all the instances that matches the following description: {cats}."
        return self.predict(image, prompt, **kwargs)

    def ground_single(self, image, phrase: str, **kwargs) -> dict[str, Any]:
        prompt = f"Locate a single instance that matches the following description: {phrase}."
        return self.predict(image, prompt, **kwargs)

    def ground_multi(self, image, phrase: str, **kwargs) -> dict[str, Any]:
        prompt = f"Locate all the instances that match the following description: {phrase}."
        return self.predict(image, prompt, **kwargs)

    @staticmethod
    def parse_boxes(answer: str, image_width: int, image_height: int) -> list[dict[str, float]]:
        boxes = []
        for m in re.finditer(r"<box><(\d+)><(\d+)><(\d+)><(\d+)></box>", answer):
            x1, y1, x2, y2 = [int(g) for g in m.groups()]
            boxes.append({
                "x1": x1 / 1000 * image_width,
                "y1": y1 / 1000 * image_height,
                "x2": x2 / 1000 * image_width,
                "y2": y2 / 1000 * image_height,
            })
        return boxes

    @staticmethod
    def filter_boxes(
        boxes: list[dict[str, float]],
        image_width: int,
        image_height: int,
        *,
        min_area_ratio: float = 0.003,
        max_sky_center_ratio: float = 0.40,
        max_boxes: int = 2,
    ) -> list[dict[str, float]]:
        """Drop sky/tiny hallucinated boxes; keep largest ground-level regions."""
        if not boxes or image_width <= 0 or image_height <= 0:
            return []

        image_area = image_width * image_height
        kept: list[dict[str, float]] = []
        for box in boxes:
            w = box["x2"] - box["x1"]
            h = box["y2"] - box["y1"]
            if w <= 1 or h <= 1:
                continue
            area_ratio = (w * h) / image_area
            if area_ratio < min_area_ratio:
                continue
            center_y = (box["y1"] + box["y2"]) / 2
            if center_y < image_height * max_sky_center_ratio:
                continue
            kept.append(box)

        kept.sort(key=lambda b: (b["x2"] - b["x1"]) * (b["y2"] - b["y1"]), reverse=True)
        return kept[:max_boxes]

    @staticmethod
    def parse_labeled_regions(answer: str, image_width: int, image_height: int) -> list[dict[str, Any]]:
        """Pair <ref> labels with following <box> tokens (multi-category detect output)."""
        regions: list[dict[str, Any]] = []
        current_label: str | None = None
        parts = re.split(r"(<ref>.*?</ref>)", answer, flags=re.IGNORECASE | re.DOTALL)
        for part in parts:
            ref_match = re.match(r"<ref>(.*?)</ref>", part, flags=re.IGNORECASE | re.DOTALL)
            if ref_match:
                current_label = ref_match.group(1).strip()
                continue
            for m in re.finditer(r"<box><(\d+)><(\d+)><(\d+)><(\d+)></box>", part):
                x1, y1, x2, y2 = [int(g) for g in m.groups()]
                regions.append({
                    "label": current_label,
                    "x1": x1 / 1000 * image_width,
                    "y1": y1 / 1000 * image_height,
                    "x2": x2 / 1000 * image_width,
                    "y2": y2 / 1000 * image_height,
                })

        if regions:
            return regions

        for box in LocateAnythingWorker.parse_boxes(answer, image_width, image_height):
            regions.append({**box, "label": None})
        return regions

    @staticmethod
    def filter_labeled_regions(
        regions: list[dict[str, Any]],
        image_width: int,
        image_height: int,
        *,
        min_area_ratio: float = 0.003,
        max_sky_center_ratio: float = 0.40,
        max_boxes: int = 8,
    ) -> list[dict[str, Any]]:
        """Filter labeled regions using the same heuristics as filter_boxes."""
        if not regions or image_width <= 0 or image_height <= 0:
            return []

        kept: list[dict[str, Any]] = []
        for region in regions:
            box = {
                "x1": float(region["x1"]),
                "y1": float(region["y1"]),
                "x2": float(region["x2"]),
                "y2": float(region["y2"]),
            }
            filtered = LocateAnythingWorker.filter_boxes(
                [box],
                image_width,
                image_height,
                min_area_ratio=min_area_ratio,
                max_sky_center_ratio=max_sky_center_ratio,
                max_boxes=1,
            )
            if filtered:
                kept.append({**filtered[0], "label": region.get("label")})

        kept.sort(
            key=lambda r: (r["x2"] - r["x1"]) * (r["y2"] - r["y1"]),
            reverse=True,
        )
        return kept[:max_boxes]


def resolve_device() -> str:
    from app.config import settings

    import torch

    device = settings.locateanything_device
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    return device


def analyzer_status_payload() -> dict[str, Any]:
    import sys

    import torch

    from app.config import settings

    ready, deps_error = locateanything_ready()
    device = resolve_device()
    transformers_version = None
    try:
        import transformers

        transformers_version = transformers.__version__
    except ImportError:
        pass

    return {
        "ready": ready,
        "loaded": _worker is not None,
        "loading": _loading,
        "engine": "locateanything",
        "model": settings.locateanything_model,
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "generation_mode": settings.locateanything_generation_mode,
        "min_confidence": settings.locateanything_min_confidence,
        "transformers_version": transformers_version,
        "python_executable": sys.executable,
        "last_load_error": _load_error,
        "error": deps_error or _load_error,
    }


def reset_locateanything_state() -> dict[str, str]:
    """Clear cached load errors and unloaded worker (e.g. after fixing pip packages)."""
    global _worker, _load_error, _loading, _resolved_device
    with _load_lock:
        _worker = None
        _load_error = None
        _loading = False
        _resolved_device = None
    return {"status": "reset", "message": "Analyzer state cleared. Click Load GPU model to retry."}


def warmup_locateanything(blocking: bool = False) -> dict[str, str]:
    """Download and load model weights. First run downloads ~8GB from Hugging Face."""
    global _loading, _load_error

    if _worker is not None:
        return {"status": "loaded", "message": "Model already loaded"}

    with _load_lock:
        if _loading:
            return {"status": "loading", "message": "Model load already in progress"}
        _loading = True
        _load_error = None

    def _run() -> None:
        global _loading, _load_error, _resolved_device
        try:
            worker = get_locateanything_worker()
            _resolved_device = worker.device
        except Exception as exc:
            _load_error = str(exc)
            logger.exception("LocateAnything warmup failed")
        finally:
            _loading = False

    if blocking:
        _run()
        if _load_error:
            return {"status": "error", "message": _load_error}
        return {"status": "loaded", "message": "Model loaded"}

    threading.Thread(target=_run, daemon=True, name="locateanything-warmup").start()
    return {
        "status": "loading",
        "message": "Downloading/loading model — watch backend logs and GPU usage. First run can take 5–15 minutes.",
    }


def get_locateanything_worker() -> LocateAnythingWorker:
    global _worker, _load_error, _resolved_device
    if _worker is not None:
        return _worker

    from app.config import settings

    try:
        import torch
    except ImportError as exc:
        _load_error = "PyTorch is not installed. pip install torch"
        raise RuntimeError(_load_error) from exc

    _ensure_accelerate_compat()

    device = resolve_device()
    _resolved_device = device

    if device == "cpu":
        logger.warning("LocateAnything: CUDA not available — inference will be very slow on CPU")

    try:
        _worker = LocateAnythingWorker(
            settings.locateanything_model,
            device=device,
        )
        _load_error = None
    except Exception as exc:
        _load_error = str(exc)
        raise RuntimeError(f"Failed to load LocateAnything: {exc}") from exc
    return _worker


_MIN_TRANSFORMERS_VERSION = (4, 57, 0)


def _parse_version(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for segment in version.split("."):
        digits = "".join(ch for ch in segment if ch.isdigit())
        if digits:
            parts.append(int(digits))
    return tuple(parts)


def locateanything_ready() -> tuple[bool, str | None]:
    """Check whether dependencies import (ignores stale prior load failures)."""
    if _worker is not None:
        return True, None
    try:
        import torch  # noqa: F401

        _, _, _, transformers_version = _import_hf_auto_classes()
        if _parse_version(transformers_version) < _MIN_TRANSFORMERS_VERSION:
            return (
                False,
                f"transformers {transformers_version} is too old for LocateAnything. "
                f"Upgrade with: pip install \"transformers>=4.57.0\" accelerate peft",
            )
    except Exception as exc:
        return False, str(exc)
    return True, None
