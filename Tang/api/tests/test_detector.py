import io

import pytest
from PIL import Image

from app.detector import Detector, MockDetector
from app.schemas import Detection, Pipe


def make_image(w=640, h=480, color=(120, 90, 60), fmt="JPEG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format=fmt)
    return buf.getvalue()


def inside(box, w, h):
    x, y, bw, bh = box
    return bw > 0 and bh > 0 and x >= 0 and y >= 0 and x + bw <= w and y + bh <= h


def test_same_bytes_same_seed_is_identical():
    data = make_image()
    a = MockDetector(seed=1).detect(data)
    b = MockDetector(seed=1).detect(data)
    assert a == b


def test_different_seed_differs():
    data = make_image()
    assert MockDetector(seed=1).detect(data) != MockDetector(seed=2).detect(data)


def test_different_image_bytes_differ():
    a = MockDetector(seed=1).detect(make_image(color=(1, 2, 3)))
    b = MockDetector(seed=1).detect(make_image(color=(200, 100, 50)))
    assert a != b


def test_all_boxes_inside_image():
    w, h = 640, 480
    result = MockDetector(seed=1).detect(make_image(w, h))
    assert result.pipes
    for p in result.pipes:
        assert inside(p.box, w, h)
        assert 0.0 <= p.confidence <= 1.0


def test_confidence_range_with_some_low():
    result = MockDetector(seed=1).detect(make_image(1200, 900))
    confs = [p.confidence for p in result.pipes]
    assert min(confs) >= 0.55 and max(confs) <= 0.99


def test_crop_box_contains_every_pipe_and_is_inside():
    w, h = 640, 480
    result = MockDetector(seed=3).detect(make_image(w, h))
    cx, cy, cw, ch = result.crop_box
    assert inside(result.crop_box, w, h)
    for p in result.pipes:
        x, y, bw, bh = p.box
        assert x >= cx and y >= cy and x + bw <= cx + cw and y + bh <= cy + ch


def test_count_equals_len_pipes_and_at_least_one():
    result = MockDetector(seed=1).detect(make_image())
    assert result.count == len(result.pipes) >= 1


def test_tiny_image_does_not_crash():
    result = MockDetector(seed=1).detect(make_image(10, 10))
    assert result.count == len(result.pipes)
    for p in result.pipes:
        assert inside(p.box, 10, 10)
    assert inside(result.crop_box, 10, 10)


def test_png_and_exif_free_formats_work():
    assert MockDetector(seed=1).detect(make_image(fmt="PNG")).count >= 1


def test_not_an_image_raises_value_error():
    with pytest.raises(ValueError):
        MockDetector(seed=1).detect(b"not an image")


def test_result_has_only_contract_fields():
    result = MockDetector(seed=1).detect(make_image())
    assert set(result.model_dump()) == {"count", "crop_box", "pipes"}
    assert set(result.model_dump()["pipes"][0]) == {"box", "confidence"}


def test_fake_detector_satisfies_protocol():
    class FakeDetector:
        def detect(self, image_bytes: bytes) -> Detection:
            return Detection(
                count=1, crop_box=(0, 0, 10, 10),
                pipes=[Pipe(box=(1, 1, 5, 5), confidence=0.9)],
            )

    d: Detector = FakeDetector()
    assert d.detect(b"x").count == 1


# ---- tester additions (edge cases) ----
import random as _random


def _check_all(result, w, h):
    assert result.count == len(result.pipes) >= 1
    assert inside(result.crop_box, w, h)
    cx, cy, cw, ch = result.crop_box
    for p in result.pipes:
        assert inside(p.box, w, h)
        x, y, bw, bh = p.box
        assert x >= cx and y >= cy and x + bw <= cx + cw and y + bh <= cy + ch
        assert 0.55 <= p.confidence <= 0.99


def test_many_random_sizes_and_formats():
    rng = _random.Random(42)
    sizes = [(1, 1), (1, 50), (50, 1), (2, 2), (3, 7), (10, 10)]
    sizes += [(rng.randint(1, 300), rng.randint(1, 300)) for _ in range(60)]
    sizes += [(4000, 3000)]
    for i, (w, h) in enumerate(sizes):
        fmt = "PNG" if i % 2 else "JPEG"
        _check_all(MockDetector(seed=i).detect(make_image(w, h, fmt=fmt)), w, h)


def test_empty_bytes_raises_value_error():
    with pytest.raises(ValueError):
        MockDetector(seed=1).detect(b"")


@pytest.mark.parametrize("data", [b"\x00" * 100, b"%PDF-1.4 hello", b"GIF", "text".encode() * 500])
def test_garbage_raises_value_error(data):
    with pytest.raises(ValueError):
        MockDetector(seed=1).detect(data)


def test_mock_seed_env_changes_output(monkeypatch):
    data = make_image()
    monkeypatch.setenv("MOCK_SEED", "0")
    a = MockDetector().detect(data)
    assert a == MockDetector().detect(data)
    monkeypatch.setenv("MOCK_SEED", "7")
    assert MockDetector().detect(data) != a


def test_explicit_seed_overrides_env(monkeypatch):
    data = make_image()
    monkeypatch.setenv("MOCK_SEED", "9")
    assert MockDetector(seed=1).detect(data) == MockDetector(seed=1).detect(data)


def test_no_pipe_size_field_anywhere():
    dump = MockDetector(seed=1).detect(make_image()).model_dump_json().lower()
    for bad in ("size", "diameter", "inch", "mm"):
        assert bad not in dump
