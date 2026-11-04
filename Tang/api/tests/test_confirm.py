import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from tests.conftest import files, png_stack

GOOD = {"do_number": "DX26030043", "actual_amount": 15, "notes": "two pipes hidden at the back"}


def _upload(client, operator_id=None):
    data = {"operator_id": operator_id} if operator_id is not None else None
    r = client.post(
        "/api/counts",
        data=data,
        files=files(("a.png", png_stack(), "image/png"), ("bad.txt", b"x", "text/plain")),
    )
    assert r.status_code == 200
    return r.json()


def test_upload_saves_draft_batch_images_and_pipes(client, repo):
    body = _upload(client, operator_id="OP-7")
    good = body["images"][0]
    row = repo.batches[body["batch_id"]]
    assert row["status"] == "draft" and row["operator_id"] == "OP-7"
    assert row["model_total"] == good["count"]
    imgs = sorted((i for i in repo.images if i["batch_id"] == body["batch_id"]), key=lambda i: i["position"])
    assert [i["filename"] for i in imgs] == ["a.png", "bad.txt"]
    assert imgs[0]["model_count"] == good["count"] and imgs[0]["error"] is None
    assert 0 < imgs[0]["mean_confidence"] <= 1 and imgs[0]["brightness"] == "ok"
    assert imgs[1]["model_count"] == 0 and imgs[1]["error"] and imgs[1]["mean_confidence"] is None
    pipes = [p for p in repo.pipes if p["image_id"] == imgs[0]["id"]]
    assert len(pipes) == good["count"]
    assert all(p["source"] == "model" and p["removed"] is False for p in pipes)


def test_operator_defaults_to_unknown(client, repo):
    assert repo.batches[_upload(client)["batch_id"]]["operator_id"] == "unknown"
    assert repo.batches[_upload(client, operator_id="  ")["batch_id"]]["operator_id"] == "unknown"


def test_confirm_draft(client, repo):
    body = _upload(client)
    model_total = body["images"][0]["count"]
    r = client.post(f"/api/counts/{body['batch_id']}/confirm", json={**GOOD, "do_number": "  DX26030043 "})
    assert r.status_code == 200
    rec = r.json()
    assert rec["batch_id"] == body["batch_id"] and rec["status"] == "confirmed"
    assert rec["do_number"] == "DX26030043" and rec["actual_amount"] == 15 and rec["notes"] == GOOD["notes"]
    assert rec["model_total"] == model_total and rec["variance"] == 15 - model_total
    assert rec["flagged"] == (15 != model_total) and rec["image_count"] == 2
    assert rec["confirmed_at"]
    assert repo.batches[body["batch_id"]]["status"] == "confirmed"


def test_confirm_unknown_batch_404(client):
    assert client.post(f"/api/counts/{uuid.uuid4()}/confirm", json=GOOD).status_code == 404
    assert client.post("/api/counts/not-a-uuid/confirm", json=GOOD).status_code == 404


def test_confirm_twice_409(client):
    bid = _upload(client)["batch_id"]
    assert client.post(f"/api/counts/{bid}/confirm", json=GOOD).status_code == 200
    assert client.post(f"/api/counts/{bid}/confirm", json=GOOD).status_code == 409


@pytest.mark.parametrize(
    "patch",
    [{"do_number": ""}, {"do_number": "   "}, {"notes": ""}, {"notes": " "}, {"actual_amount": -1}, {"do_number": None}],
)
def test_confirm_invalid_body_422(client, repo, patch):
    bid = _upload(client)["batch_id"]
    assert client.post(f"/api/counts/{bid}/confirm", json={**GOOD, **patch}).status_code == 422
    assert repo.batches[bid]["status"] == "draft"


def test_no_database_configured_503(monkeypatch):
    """No dependency override + placeholder key -> 503, never a crash."""
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "<sb_secret_..., server-only, never in web/>")
    client = TestClient(app)
    r = client.post("/api/counts", files=files(("a.png", png_stack(), "image/png")))
    assert r.status_code == 503 and "database not configured" in r.json()["detail"]
    r = client.post(f"/api/counts/{uuid.uuid4()}/confirm", json=GOOD)
    assert r.status_code == 503
    assert client.get("/health").status_code == 200


@pytest.mark.parametrize(
    ("url", "key", "ok"),
    [
        ("https://x.supabase.co", "", False),
        ("https://x.supabase.co", "<sb_secret_..., server-only>", False),
        ("https://x.supabase.co", "your-secret-key-goes-here-123", False),
        ("https://x.supabase.co", "sb_secret_", False),
        ("", "sb_secret_abcdefghijklmnopqrstuvwxyz", False),
        ("https://x.supabase.co", "sb_secret_abcdefghijklmnopqrstuvwxyz", True),
        ("https://x.supabase.co", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig", True),
    ],
)
def test_is_configured_rejects_placeholders(monkeypatch, url, key, ok):
    from app.repo import is_configured

    monkeypatch.setattr(settings, "supabase_url", url)
    monkeypatch.setattr(settings, "supabase_secret_key", key)
    assert is_configured() is ok


def test_confirm_image_ids_keeps_only_listed_and_recomputes_total(client, repo):
    two = client.post(
        "/api/counts",
        files=files(("a.png", png_stack(3), "image/png"), ("b.png", png_stack(4), "image/png")),
    ).json()
    c1, c2 = (i["count"] for i in two["images"])
    assert c1 != c2 and repo.batches[two["batch_id"]]["model_total"] == c1 + c2
    r = client.post(f"/api/counts/{two['batch_id']}/confirm", json={**GOOD, "image_ids": ["img_2"]})
    assert r.status_code == 200 and r.json()["model_total"] == c2
    assert r.json()["variance"] == 15 - c2
    flags = {i["position"]: i["excluded"] for i in repo.images if i["batch_id"] == two["batch_id"]}
    assert flags == {1: True, 2: False}


def test_confirm_without_image_ids_keeps_all(client, repo):
    body = _upload(client)
    client.post(f"/api/counts/{body['batch_id']}/confirm", json=GOOD)
    assert not any(i["excluded"] for i in repo.images)
    assert repo.batches[body["batch_id"]]["model_total"] == body["images"][0]["count"]


@pytest.mark.parametrize("ids", [[], ["img_9"], ["img_1", "nope"], ["img_0"], ["img_"], ["IMG_1"]])
def test_confirm_bad_image_ids_422(client, repo, ids):
    bid = _upload(client)["batch_id"]
    assert client.post(f"/api/counts/{bid}/confirm", json={**GOOD, "image_ids": ids}).status_code == 422
    assert repo.batches[bid]["status"] == "draft"
