"""Detector adapter. Routes only call Detector.detect(); they never know the box format.

OPEN-1 (ML team): box format is ASSUMED [x, y, w, h] in pixels of the uploaded image.
OPEN-8 (ML team): crop_box is COMPUTED here (pipes bounding box + padding, clamped);
the real model may provide it. Both are still unconfirmed, change only this file
and docs/api-contract.md when the ML team answers.

MockDetector is deterministic: seeded by sha256(image bytes) + a seed (MOCK_SEED env).
"""
import hashlib
import io
import os
import random
from typing import Protocol

from PIL import Image, ImageOps, UnidentifiedImageError

from app.schemas import Box, Detection, Pipe


class Detector(Protocol):
    def detect(self, image_bytes: bytes) -> Detection: ...


class MockDetector:
    def __init__(self, seed: int | None = None):
        self.seed = int(os.getenv("MOCK_SEED", "0")) if seed is None else seed

    def detect(self, image_bytes: bytes) -> Detection:
        try:
            img = Image.open(io.BytesIO(image_bytes))
            img = ImageOps.exif_transpose(img)
            width, height = img.size
        except (UnidentifiedImageError, OSError) as e:
            raise ValueError("not a readable image") from e

        digest = hashlib.sha256(image_bytes).digest()
        rng = random.Random(int.from_bytes(digest[:8], "big") ^ self.seed)

        # Jittered grid covering the central ~80% of the image.
        cols = rng.randint(4, 9)
        rows = rng.randint(3, 7)
        mx, my = width * 0.1, height * 0.1
        cell_w = (width - 2 * mx) / cols
        cell_h = (height - 2 * my) / rows

        pipes: list[Pipe] = []
        for r in range(rows):
            for c in range(cols):
                d = min(cell_w, cell_h) * rng.uniform(0.7, 0.95)
                x = mx + c * cell_w + rng.uniform(0, max(cell_w - d, 0))
                y = my + r * cell_h + rng.uniform(0, max(cell_h - d, 0))
                box = _clamp(x, y, d, d, width, height)
                # mostly high confidence, ~10% low ones for the review highlight
                conf = rng.uniform(0.55, 0.7) if rng.random() < 0.1 else rng.uniform(0.8, 0.99)
                pipes.append(Pipe(box=box, confidence=round(conf, 2)))

        return Detection(count=len(pipes), crop_box=_crop_box(pipes, width, height), pipes=pipes)


def _clamp(x: float, y: float, w: float, h: float, width: int, height: int) -> Box:
    """Integer box with w,h >= 1, fully inside the image."""
    x0 = min(max(int(x), 0), width - 1)
    y0 = min(max(int(y), 0), height - 1)
    x1 = min(max(int(x + w + 0.999), x0 + 1), width)
    y1 = min(max(int(y + h + 0.999), y0 + 1), height)
    return (x0, y0, x1 - x0, y1 - y0)


def _crop_box(pipes: list[Pipe], width: int, height: int) -> Box:
    x0 = min(p.box[0] for p in pipes)
    y0 = min(p.box[1] for p in pipes)
    x1 = max(p.box[0] + p.box[2] for p in pipes)
    y1 = max(p.box[1] + p.box[3] for p in pipes)
    pad_x, pad_y = int((x1 - x0) * 0.03), int((y1 - y0) * 0.03)
    x0, y0 = max(x0 - pad_x, 0), max(y0 - pad_y, 0)
    x1, y1 = min(x1 + pad_x, width), min(y1 + pad_y, height)
    return (x0, y0, x1 - x0, y1 - y0)
