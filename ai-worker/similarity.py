"""Perceptual hash image similarity (CLIP stub stand-in)."""

from abc import ABC, abstractmethod
from typing import Protocol

import imagehash
from PIL import Image


class ImageSimilarityProvider(Protocol):
    def similarity(self, image_a_path: str, image_b_path: str) -> float:
        ...


class PerceptualHashSimilarity:
    def similarity(self, image_a_path: str, image_b_path: str) -> float:
        try:
            h1 = imagehash.phash(Image.open(image_a_path))
            h2 = imagehash.phash(Image.open(image_b_path))
            diff = h1 - h2
            return max(0.0, 1.0 - diff / 64.0)
        except Exception:
            return 0.0


class CLIPSimilarityStub(ImageSimilarityProvider):
    """Stub for future CLIP embedding similarity."""

    def __init__(self, fallback: ImageSimilarityProvider | None = None):
        self.fallback = fallback or PerceptualHashSimilarity()

    def similarity(self, image_a_path: str, image_b_path: str) -> float:
        return self.fallback.similarity(image_a_path, image_b_path)
