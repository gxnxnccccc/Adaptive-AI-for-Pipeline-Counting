import uuid

from app.config import settings
from tests.conftest import files, png_stack


def test_three_files_two_valid_one_text(client, repo):
    png = png_stack()
    r = client.post(
        "/api/counts",
        files=files(
            ("a.png", png, "image/png"),
            ("notes.txt", b"hello", "text/plain"),
            ("b.png", png, "image/png"),
        ),
    )
    assert r.status_code == 200
    body = r.json()
    uuid.UUID(body["batch_id"])
    imgs = body["images"]
    assert [i["filename"] for i in imgs] == ["a.png", "notes.txt", "b.png"]
    assert [i["image_id"] for i in imgs] == ["img_1", "img_2", "img_3"]
    assert imgs[0]["error"] is None and imgs[0]["count"] >= 10
    assert imgs[0]["count"] == len(imgs[0]["pipes"])
    assert imgs[0]["crop_box"] and imgs[0]["quality"]["brightness"] == "ok"
    assert imgs[0]["original_bytes"] == len(png)
    assert "stored_bytes" not in imgs[0]
    assert imgs[1]["error"] and imgs[1]["count"] is None
    assert imgs[1]["crop_box"] is None and imgs[1]["pipes"] == []
    assert imgs[2]["error"] is None


def test_too_many_files_rejected(client, monkeypatch):
    monkeypatch.setattr(settings, "max_files_per_request", 2)
    png = png_stack()
    r = client.post("/api/counts", files=files(*[(f"{i}.png", png, "image/png") for i in range(3)]))
    assert r.status_code == 413


def test_oversize_file_errors_only_that_image(client, monkeypatch):
    monkeypatch.setattr(settings, "max_file_bytes", 1000)
    r = client.post(
        "/api/counts",
        files=files(("big.png", png_stack(), "image/png"), ("small.txt", b"x", "text/plain")),
    )
    assert r.status_code == 200
    imgs = r.json()["images"]
    assert "too large" in imgs[0]["error"]
    assert imgs[0]["original_bytes"] > 1000
    assert imgs[1]["error"]


def test_no_files_is_422(client):
    assert client.post("/api/counts").status_code == 422
