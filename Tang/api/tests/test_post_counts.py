import io
from functools import partial

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main, repo
from app.detector import MockDetector
from tests.test_repo import FakeClient

IMAGE_KEYS = {"image_id", "count", "crop_box", "pipes", "quality", "stored_bytes", "original_bytes"}


def png(color=(200, 10, 10), size=(120, 90)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture
def env(tmp_path):
    fake = FakeClient()
    saver = partial(repo.save_batch, client=fake, data_dir=tmp_path)
    main.app.dependency_overrides[main.get_detector] = lambda: MockDetector(seed=0)
    main.app.dependency_overrides[main.get_saver] = lambda: saver
    yield TestClient(main.app), fake, tmp_path
    main.app.dependency_overrides.clear()


def files(*blobs, name="p.png", ctype="image/png"):
    return [("images", (name, b, ctype)) for b in blobs]


def saved_files(tmp_path):
    return [p for p in tmp_path.rglob("*") if p.is_file()]


def test_contract_shape(env):
    client, fake, _ = env
    r = client.post("/api/counts", files=files(png()))
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"batch_id", "images"}
    img = body["images"][0]
    assert set(img) == IMAGE_KEYS
    assert set(img["pipes"][0]) == {"box", "confidence"}
    assert img["quality"] == {"brightness": "ok", "blur": "ok"}
    assert img["count"] == len(img["pipes"]) > 0
    assert len(img["crop_box"]) == 4
    assert img["original_bytes"] == len(png()) > 0
    assert [c[0] for c in fake.calls] == ["batches", "images"]


def test_five_images_keep_order(env):
    client, fake, _ = env
    blobs = [png(color=(i * 40, 0, 0), size=(100 + i * 10, 80)) for i in range(5)]
    r = client.post("/api/counts", files=files(*blobs))
    assert r.status_code == 200
    imgs = r.json()["images"]
    assert len(imgs) == 5
    assert [i["original_bytes"] for i in imgs] == [len(b) for b in blobs]
    rows = fake.calls[1][1]
    assert [row["id"] for row in rows] == [i["image_id"] for i in imgs]


def test_same_image_twice_same_count(env):
    client, _, _ = env
    b = png()
    imgs = client.post("/api/counts", files=files(b, b)).json()["images"]
    assert imgs[0]["count"] == imgs[1]["count"]
    assert imgs[0]["image_id"] != imgs[1]["image_id"]


def test_zero_images_422(env):
    client, fake, _ = env
    assert client.post("/api/counts").status_code == 422
    assert fake.calls == []


def test_too_many_images_413(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(*[png()] * 11))
    assert r.status_code == 413
    assert fake.calls == [] and saved_files(tmp) == []


def test_ten_images_ok(env):
    client, _, _ = env
    assert client.post("/api/counts", files=files(*[png()] * 10)).status_code == 200


def test_oversize_413(env, monkeypatch):
    client, fake, tmp = env
    monkeypatch.setattr(main, "MAX_IMAGE_BYTES", 1000)
    big = png() + b"\0" * 2000
    r = client.post("/api/counts", files=files(png(size=(4, 4)), big))
    assert r.status_code == 413
    assert fake.calls == [] and saved_files(tmp) == []


def test_non_image_415_nothing_saved(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(png()) + files(b"hello not an image", name="a.png"))
    assert r.status_code == 415
    detail = r.json()["detail"]
    assert "2" in detail
    assert fake.calls == [] and saved_files(tmp) == []


def test_truncated_image_415(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(png(size=(300, 300))[:80]))
    assert r.status_code == 415
    assert fake.calls == [] and saved_files(tmp) == []


def test_decompression_bomb_415(env, monkeypatch):
    client, fake, tmp = env
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    r = client.post("/api/counts", files=files(png(size=(100, 100))))
    assert r.status_code == 415
    assert fake.calls == []


def test_save_failure_500_no_leak(env):
    client, fake, _ = env
    fake.fail_on = "images"
    r = client.post("/api/counts", files=files(png()))
    assert r.status_code == 500
    assert "boom" not in r.text
