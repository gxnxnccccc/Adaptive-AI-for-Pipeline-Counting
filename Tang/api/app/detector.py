"""Detector adapter: the ONLY place model output enters the API.

detect(image_bytes) -> {count, crop_box, pipes[{box, confidence}], quality}
Mock implementation: OpenCV HoughCircles converted to boxes. When the ML team
picks the real method, replace the body of detect() and keep the return shape.
"""

import zlib

import cv2
import numpy as np

# TODO(contract): box format - pixels or normalized 0-1? [x,y,w,h] or [x1,y1,x2,y2]? (mock: pixels, [x,y,w,h])
# TODO(contract): confidence - 0-1? which threshold counts as a pipe? (mock: 0-1, all returned)
# TODO(contract): circles vs boxes - Hough gives (cx,cy,r), YOLO gives boxes (mock: circle -> square box)
# TODO(contract): crop_box - does the model give it, or compute from pipe boxes? (mock: union of pipe boxes)

MAX_SIDE = 1280  # Hough runs on a copy whose longest side is <= this (speed)
DARK_MEAN = 50
BRIGHT_MEAN = 205


def _decode(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise ValueError("empty image data")
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cannot decode image: not a valid image file")
    return img


def _brightness(gray: np.ndarray) -> str:
    mean = float(gray.mean())
    if mean < DARK_MEAN:
        return "dark"
    if mean > BRIGHT_MEAN:
        return "bright"
    return "ok"


def _confidence(gray: np.ndarray, cx: int, cy: int, r: int) -> float:
    """Mock confidence: edge contrast (inside vs ring outside) scaled by a
    deterministic per-position factor so values vary and a few are low."""
    h, w = gray.shape
    yy, xx = np.ogrid[:h, :w]
    d2 = (xx - cx) ** 2 + (yy - cy) ** 2
    inside = gray[d2 <= (0.8 * r) ** 2]
    ring = gray[(d2 >= (1.15 * r) ** 2) & (d2 <= (1.4 * r) ** 2)]
    if inside.size == 0 or ring.size == 0:
        return 0.3
    contrast = min(abs(float(inside.mean()) - float(ring.mean())) / 80.0, 1.0)
    jitter = 0.35 + 0.65 * ((zlib.crc32(f"{cx},{cy}".encode()) % 1000) / 1000.0)
    return round(max(0.05, min(0.99, contrast * jitter + 0.05)), 2)


def detect(image_bytes: bytes) -> dict:
    img = _decode(image_bytes)
    oh, ow = img.shape[:2]
    scale = min(1.0, MAX_SIDE / max(oh, ow))
    if scale < 1.0:
        img = cv2.resize(img, (round(ow * scale), round(oh * scale)), interpolation=cv2.INTER_AREA)
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    quality = {"brightness": _brightness(gray)}

    blur = cv2.medianBlur(gray, 5)
    min_r = max(5, min(h, w) // 60)
    max_r = max(min_r + 1, min(h, w) // 4)
    circles = cv2.HoughCircles(
        blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min_r * 1.6,
        param1=100,
        param2=30,
        minRadius=min_r,
        maxRadius=max_r,
    )

    found = np.round(circles[0]).astype(int) if circles is not None else np.empty((0, 3), int)
    if len(found):
        # Pipes in one photo are similar in size and do not overlap: drop circles
        # far from the typical radius, then suppress overlaps (Hough returns
        # strongest first, so the first one kept wins).
        # Hough lists strongest first and spurious big circles are weak, so the
        # typical radius comes from the strongest few only.
        med = float(np.median(found[:20, 2]))
        found = found[(found[:, 2] >= 0.75 * med) & (found[:, 2] <= 1.3 * med)]
        kept = []
        for c in found:
            if all(np.hypot(c[0] - k[0], c[1] - k[1]) >= 1.2 * med for k in kept):
                kept.append(c)
        found = np.array(kept, int).reshape(-1, 3)

    pipes = []
    if len(found):
        for cx, cy, r in found:
            conf = _confidence(gray, int(cx), int(cy), int(r))
            # back to ORIGINAL pixel coordinates
            x0, y0 = max(round((cx - r) / scale), 0), max(round((cy - r) / scale), 0)
            x1, y1 = min(round((cx + r) / scale), ow), min(round((cy + r) / scale), oh)
            if x1 <= x0 or y1 <= y0:
                continue
            pipes.append(
                {
                    "box": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
                    "confidence": conf,
                }
            )

    crop_box = None
    if pipes:
        x0 = min(p["box"][0] for p in pipes)
        y0 = min(p["box"][1] for p in pipes)
        x1 = max(p["box"][0] + p["box"][2] for p in pipes)
        y1 = max(p["box"][1] + p["box"][3] for p in pipes)
        crop_box = [x0, y0, x1 - x0, y1 - y0]

    return {"count": len(pipes), "crop_box": crop_box, "pipes": pipes, "quality": quality}
