from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routes.stats import today_bounds


def _img(count, error=None):
    return {
        "position": 1,
        "filename": "a.png",
        "original_bytes": 100,
        "model_count": count,
        "mean_confidence": None,
        "crop_box": None,
        "brightness": None if error else "ok",
        "error": error,
        "pipes": [],
    }


def _add(repo, operator, model, *, confirm=None, seconds=0, days=0, failed=0):
    """One batch with `model` pipes (+ `failed` unreadable photos), created `seconds`/`days` ago."""
    t = datetime.now(UTC) - timedelta(days=days, seconds=seconds)
    repo.now = lambda: t
    bid = repo.create_batch(operator, [_img(model)] + [_img(0, "cannot decode") for _ in range(failed)])
    if confirm:
        do_number, actual = confirm
        repo.confirm_batch(bid, do_number, actual, "checked")
    return bid


@pytest.fixture
def seeded(repo):
    """Newest first: d (draft), c (flagged), b (confirmed exact), a (draft, 2 days ago)."""
    ids = {
        "a": _add(repo, "OP-1", 30, days=2, failed=1),
        "b": _add(repo, "OP-2", 40, confirm=("DX26030043", 40), seconds=3),
        "c": _add(repo, "op-1", 50, confirm=("DX26030099", 47), seconds=2, failed=2),
        "d": _add(repo, "OP-3", 20, seconds=1),
    }
    repo.now = lambda: datetime.now(UTC)
    return ids


def _ids(r, seeded):
    names = {v: k for k, v in seeded.items()}
    return [names[i["batch_id"]] for i in r.json()["items"]]


def test_list_all_newest_first_with_item_shape(client, seeded):
    r = client.get("/api/counts")
    assert r.status_code == 200
    assert r.json()["total"] == 4 and _ids(r, seeded) == ["d", "c", "b", "a"]
    by = {i["batch_id"]: i for i in r.json()["items"]}
    c, d = by[seeded["c"]], by[seeded["d"]]
    assert c["status"] == "confirmed" and c["variance"] == -3 and c["flagged"] is True
    assert c["do_number"] == "DX26030099" and c["operator_id"] == "op-1" and c["image_count"] == 3
    assert c["model_total"] == 50 and c["actual_amount"] == 47
    assert d["status"] == "draft" and d["variance"] is None and d["flagged"] is False
    assert d["do_number"] is None and d["actual_amount"] is None and d["image_count"] == 1
    assert by[seeded["b"]]["variance"] == 0 and by[seeded["b"]]["flagged"] is False


@pytest.mark.parametrize(
    ("status", "expected"),
    [("draft", ["d", "a"]), ("confirmed", ["c", "b"]), ("flagged", ["c"])],
)
def test_filter_by_status(client, seeded, status, expected):
    r = client.get("/api/counts", params={"status": status})
    assert _ids(r, seeded) == expected and r.json()["total"] == len(expected)


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("dx2603", ["c", "b"]),  # DO number, case-insensitive substring
        ("0099", ["c"]),
        ("op-1", ["c", "a"]),  # operator, case-insensitive
        ("OP-3", ["d"]),
        ("nothing", []),
        ("0043,status.eq.draft", []),  # PostgREST syntax is stripped, not injected
        ("  ", ["d", "c", "b", "a"]),
    ],
)
def test_search_do_or_operator(client, seeded, q, expected):
    assert _ids(client.get("/api/counts", params={"q": q}), seeded) == expected


def test_search_combines_with_status(client, seeded):
    r = client.get("/api/counts", params={"q": "op-1", "status": "draft"})
    assert _ids(r, seeded) == ["a"] and r.json()["total"] == 1


def test_paging(client, seeded):
    p1 = client.get("/api/counts", params={"limit": 2, "offset": 0})
    p2 = client.get("/api/counts", params={"limit": 2, "offset": 2})
    past = client.get("/api/counts", params={"limit": 2, "offset": 10})
    assert _ids(p1, seeded) == ["d", "c"] and _ids(p2, seeded) == ["b", "a"]
    assert p1.json()["total"] == p2.json()["total"] == past.json()["total"] == 4
    assert past.json()["items"] == []


@pytest.mark.parametrize(
    "params", [{"status": "deleted"}, {"limit": 0}, {"limit": 101}, {"offset": -1}, {"q": "x" * 65}]
)
def test_bad_query_422(client, params):
    assert client.get("/api/counts", params=params).status_code == 422


def test_stats_math(client, seeded):
    r = client.get("/api/stats")
    assert r.status_code == 200
    assert r.json() == {
        "detections_today": 3,  # b, c, d (a is 2 days old)
        "confirmed_total": 2,  # b, c
        "correction_rate": 0.5,  # c of (b, c)
        "failed_images_today": 2,  # c's two bad photos; a's is old
    }


def test_stats_empty(client):
    assert client.get("/api/stats").json() == {
        "detections_today": 0,
        "confirmed_total": 0,
        "correction_rate": None,
        "failed_images_today": 0,
    }


def test_today_is_bangkok_day():
    # 18:00 UTC = 01:00 next day in Bangkok (UTC+7)
    start, end = today_bounds(datetime(2026, 11, 4, 18, 0, tzinfo=UTC))
    assert start == datetime(2026, 11, 4, 17, 0, tzinfo=UTC) and end == datetime(2026, 11, 5, 17, 0, tzinfo=UTC)
    start, _ = today_bounds(datetime(2026, 11, 4, 16, 59, tzinfo=UTC))
    assert start == datetime(2026, 11, 3, 17, 0, tzinfo=UTC)


def test_records_and_stats_503_without_database(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "")
    client = TestClient(app)
    for path in ("/api/counts", "/api/stats"):
        r = client.get(path)
        assert r.status_code == 503 and "database not configured" in r.json()["detail"]
