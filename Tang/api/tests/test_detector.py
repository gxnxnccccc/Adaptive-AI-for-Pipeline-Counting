import time

import cv2
import numpy as np
import pytest

from app.detector import detect


def _png(img) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def _stack(rows=5, cols=6, r=30, bg=60, fg=200):
    """Hex-ish stack of filled circles on a dark background."""
    h, w = rows * 2 * r + 80, cols * 2 * r + 80
    img = np.full((h, w, 3), bg, np.uint8)
    for i in range(rows):
        for j in range(cols):
            cx = 40 + r + j * 2 * r
            cy = 40 + r + i * 2 * r
            cv2.circle(img, (cx, cy), r - 2, (fg, fg, fg), -1)
    return img, rows * cols


def test_counts_drawn_circles_within_one():
    img, n = _stack()
    res = detect(_png(img))
    assert abs(res["count"] - n) <= 1
    assert res["count"] == len(res["pipes"])


def test_pipe_shape_and_crop_box():
    img, _ = _stack()
    res = detect(_png(img))
    h, w = img.shape[:2]
    for p in res["pipes"]:
        x, y, bw, bh = p["box"]
        assert bw > 0 and bh > 0
        assert 0 <= p["confidence"] <= 1
    cx, cy, cw, ch = res["crop_box"]
    assert 0 <= cx and 0 <= cy and cx + cw <= w and cy + ch <= h
    for p in res["pipes"]:
        x, y, bw, bh = p["box"]
        assert cx <= x and cy <= y and x + bw <= cx + cw and y + bh <= cy + ch


def test_confidence_varies_with_some_low():
    img, _ = _stack()
    confs = [p["confidence"] for p in detect(_png(img))["pipes"]]
    assert len(set(confs)) > 1
    assert any(c < 0.5 for c in confs)


def test_blank_image():
    res = detect(_png(np.full((300, 300, 3), 128, np.uint8)))
    assert res["count"] == 0
    assert res["pipes"] == []
    assert res["crop_box"] is None


def test_undecodable_bytes():
    with pytest.raises(ValueError):
        detect(b"not an image")
    with pytest.raises(ValueError):
        detect(b"")


def test_dark_quality_flag():
    img, _ = _stack(bg=5, fg=25)
    assert detect(_png(img))["quality"]["brightness"] == "dark"
    img2, _ = _stack()
    assert detect(_png(img2))["quality"]["brightness"] == "ok"


def test_large_image_fast_and_original_coordinates():
    """~4000x3000 photo, 10x10 dense stack of r=140 pipes (like the small stacks, scaled up)."""
    rows = cols = 10
    r, h, w = 140, 3000, 4000
    img = np.full((h, w, 3), 60, np.uint8)
    for i in range(rows):
        for j in range(cols):
            cv2.circle(img, (600 + r + j * 2 * r, 100 + r + i * 2 * r), r - 4, (200, 200, 200), -1)
    data = _png(img)
    t0 = time.perf_counter()
    res = detect(data)
    assert time.perf_counter() - t0 < 2.0
    assert abs(res["count"] - rows * cols) <= 10
    for p in res["pipes"]:
        x, y, bw, bh = p["box"]
        assert x >= 0 and y >= 0 and x + bw <= w and y + bh <= h
        assert 200 <= bw <= 360  # ~2*136 in ORIGINAL pixels, not downscaled (~87)
    cx, cy, cw, ch = res["crop_box"]
    assert abs(cx - 600) < 80 and abs(cy - 100) < 80
    assert cw > 2400 and ch > 2400
