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


# ---- per-box corrections (training data): pipe index = position in images[i].pipes[] ----


def _upload_two(client):
    body = client.post(
        "/api/counts",
        files=files(("a.png", png_stack(3), "image/png"), ("b.png", png_stack(4), "image/png")),
    ).json()
    assert all(i["count"] >= 3 for i in body["images"])
    return body


def _image_row(repo, batch_id, position):
    return next(i for i in repo.images if i["batch_id"] == batch_id and i["position"] == position)


def _pipes(repo, image_row, source="model"):
    rows = [p for p in repo.pipes if p["image_id"] == image_row["id"] and p["source"] == source]
    return sorted(rows, key=lambda p: p["position"]) if source == "model" else rows


def _confirm(client, bid, **extra):
    return client.post(f"/api/counts/{bid}/confirm", json={**GOOD, **extra})


def test_upload_stores_pipe_position_in_response_order(client, repo):
    body = _upload_two(client)
    for n, img in enumerate(body["images"], start=1):
        stored = _pipes(repo, _image_row(repo, body["batch_id"], n))
        assert [p["position"] for p in stored] == list(range(len(img["pipes"])))
        assert [p["box"] for p in stored] == [p["box"] for p in img["pipes"]]


def test_corrections_removed_marks_pipes_removed(client, repo):
    body = _upload_two(client)
    bid = body["batch_id"]
    r = _confirm(client, bid, corrections=[{"image_id": "img_1", "removed": [0, 2]}])
    assert r.status_code == 200
    flags = [p["removed"] for p in _pipes(repo, _image_row(repo, bid, 1))]
    assert flags[0] and flags[2] and not any(flags[1:2] + flags[3:])
    assert not any(p["removed"] for p in _pipes(repo, _image_row(repo, bid, 2)))
    # operator's number and model_total are not touched by corrections
    rec = r.json()
    assert rec["actual_amount"] == GOOD["actual_amount"]
    assert rec["model_total"] == sum(i["count"] for i in body["images"])


def test_corrections_added_inserts_user_added_pipes(client, repo):
    body = _upload_two(client)
    bid = body["batch_id"]
    boxes = [[10, 20, 30, 30], [100.5, 50, 28.5, 29]]
    r = _confirm(client, bid, corrections=[{"image_id": "img_2", "added": boxes}])
    assert r.status_code == 200
    added = _pipes(repo, _image_row(repo, bid, 2), source="user_added")
    assert [p["box"] for p in added] == boxes
    assert all(p["confidence"] is None and p["removed"] is False and p["position"] is None for p in added)
    assert len(_pipes(repo, _image_row(repo, bid, 2))) == body["images"][1]["count"]  # model pipes untouched
    assert r.json()["model_total"] == sum(i["count"] for i in body["images"])


def test_corrections_mixed_across_images(client, repo):
    body = _upload_two(client)
    bid = body["batch_id"]
    last = body["images"][1]["count"] - 1
    r = _confirm(
        client,
        bid,
        corrections=[
            {"image_id": "img_1", "added": [[1, 1, 5, 5]], "removed": [1]},
            {"image_id": "img_2", "removed": [0, last]},
        ],
    )
    assert r.status_code == 200
    img1, img2 = _image_row(repo, bid, 1), _image_row(repo, bid, 2)
    assert [p["position"] for p in _pipes(repo, img1) if p["removed"]] == [1]
    assert [p["box"] for p in _pipes(repo, img1, "user_added")] == [[1, 1, 5, 5]]
    assert [p["position"] for p in _pipes(repo, img2) if p["removed"]] == [0, last]
    assert _pipes(repo, img2, "user_added") == []


def test_corrections_omitted_or_empty_changes_no_pipes(client, repo):
    for extra in ({}, {"corrections": []}, {"corrections": [{"image_id": "img_1"}]}):
        body = _upload_two(client)
        assert _confirm(client, body["batch_id"], **extra).status_code == 200
    assert not any(p["removed"] for p in repo.pipes)
    assert all(p["source"] == "model" for p in repo.pipes)


@pytest.mark.parametrize(
    "extra",
    [
        {"corrections": [{"image_id": "img_9", "removed": [0]}]},  # unknown image
        {"corrections": [{"image_id": "nope", "added": [[1, 1, 5, 5]]}]},  # not an img_<n> id
        {"image_ids": ["img_2"], "corrections": [{"image_id": "img_1", "removed": [0]}]},  # photo not kept
        {"corrections": [{"image_id": "img_1", "removed": [9999]}]},  # index out of range
        {"corrections": [{"image_id": "img_1", "removed": [-1]}]},
        {"corrections": [{"image_id": "img_1", "removed": [0, 0]}]},  # duplicate index
        {"corrections": [{"image_id": "img_1", "added": [[1, 1, 0, 5]]}]},  # w <= 0
        {"corrections": [{"image_id": "img_1", "added": [[1, 1, 5, -2]]}]},  # h <= 0
        {"corrections": [{"image_id": "img_1", "added": [[1, 1, 5]]}]},  # not 4 numbers
        {"corrections": [{"image_id": "img_1", "added": [[1, 1, 5, 5, 5]]}]},
        {"corrections": [{"image_id": "img_1", "added": [[1, "a", 5, 5]]}]},
        {"corrections": [{"image_id": "img_1", "removed": [0]}, {"image_id": "img_1", "removed": [1]}]},  # dup image
        {"corrections": [{"image_id": "img_1", "added": [[1, 1, 5, 5]] * 501}]},  # too many adds
    ],
)
def test_corrections_invalid_422_and_nothing_written(client, repo, extra):
    bid = _upload_two(client)["batch_id"]
    assert _confirm(client, bid, **extra).status_code == 422
    assert repo.batches[bid]["status"] == "draft"
    assert not any(p["removed"] for p in repo.pipes)
    assert all(p["source"] == "model" for p in repo.pipes)
    assert not any(i["excluded"] for i in repo.images)


def test_corrections_index_equal_to_count_is_out_of_range(client, repo):
    body = _upload_two(client)
    n = body["images"][0]["count"]
    r = _confirm(client, body["batch_id"], corrections=[{"image_id": "img_1", "removed": [n]}])
    assert r.status_code == 422 and repo.batches[body["batch_id"]]["status"] == "draft"


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity"])
def test_corrections_non_finite_box_422(client, repo, bad):
    bid = _upload_two(client)["batch_id"]
    raw = '{"do_number": "DX1", "actual_amount": 1, "notes": "n", "corrections": [{"image_id": "img_1", "added": [[1, %s, 5, 5]]}]}'
    r = client.post(f"/api/counts/{bid}/confirm", content=raw % bad, headers={"content-type": "application/json"})
    assert r.status_code == 422
    assert repo.batches[bid]["status"] == "draft" and all(p["source"] == "model" for p in repo.pipes)
