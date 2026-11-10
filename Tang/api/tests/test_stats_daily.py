from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routes.stats import daily_stats

BKK = ZoneInfo("Asia/Bangkok")


def _img(count):
    return {
        "position": 1,
        "filename": "a.png",
        "original_bytes": 100,
        "model_count": count,
        "mean_confidence": None,
        "crop_box": None,
        "brightness": "ok",
        "error": None,
        "pipes": [],
    }


def _ago(days=0, seconds=0):
    return datetime.now(UTC) - timedelta(days=days, seconds=seconds)


def _add(repo, model, *, created, confirm=None, confirmed_at=None):
    """One batch with `model` pipes created at `created`; confirm=actual_amount, confirmed at `confirmed_at`."""
    repo.now = lambda: created
    bid = repo.create_batch("OP-1", [_img(model)])
    if confirm is not None:
        repo.now = lambda: confirmed_at or created
        repo.confirm_batch(bid, "DX1", confirm, "")
    repo.now = lambda: datetime.now(UTC)
    return bid


def _today():
    return datetime.now(UTC).astimezone(BKK).date()


def test_empty_is_zero_filled_oldest_first_ending_today(client):
    r = client.get("/api/stats/daily")
    assert r.status_code == 200
    days = r.json()["days"]
    today = _today()
    assert [d["date"] for d in days] == [(today - timedelta(days=n)).isoformat() for n in range(6, -1, -1)]
    assert all(
        d == {"date": d["date"], "detections": 0, "pipes_actual": 0, "confirmed": 0, "corrected": 0,
              "correction_rate": None}
        for d in days
    )


def test_days_param_sets_length(client):
    assert len(client.get("/api/stats/daily", params={"days": 1}).json()["days"]) == 1
    assert len(client.get("/api/stats/daily", params={"days": 31}).json()["days"]) == 31


@pytest.mark.parametrize("days", [0, 32, -1, "x"])
def test_bad_days_422(client, days):
    assert client.get("/api/stats/daily", params={"days": days}).status_code == 422


def test_daily_math(client, repo):
    _add(repo, 40, created=_ago(seconds=5), confirm=40)  # today, exact
    _add(repo, 50, created=_ago(seconds=4), confirm=47)  # today, corrected
    _add(repo, 20, created=_ago(seconds=3))  # today, draft: detection only
    _add(repo, 30, created=_ago(days=2), confirm=31, confirmed_at=_ago(seconds=2))  # created 2 days ago, confirmed today
    _add(repo, 10, created=_ago(days=3), confirm=10)  # 3 days ago, exact
    _add(repo, 99, created=_ago(days=8), confirm=90)  # outside the 7-day window

    days = {d["date"]: d for d in client.get("/api/stats/daily").json()["days"]}
    today = _today()
    t0, t2, t3 = (days[(today - timedelta(days=n)).isoformat()] for n in (0, 2, 3))
    assert t0 == {"date": today.isoformat(), "detections": 3, "pipes_actual": 40 + 47 + 31, "confirmed": 3,
                  "corrected": 2, "correction_rate": 0.6667}
    assert t2["detections"] == 1 and t2["confirmed"] == 0 and t2["pipes_actual"] == 0
    assert t2["correction_rate"] is None
    assert t3 == {"date": t3["date"], "detections": 1, "pipes_actual": 10, "confirmed": 1, "corrected": 0,
                  "correction_rate": 0.0}
    assert sum(d["detections"] for d in days.values()) == 5  # the 8-day-old batch is not counted


def test_bangkok_day_boundary():
    # 17:30 UTC on 8 Nov = 00:30 on 9 Nov in Bangkok; 16:59 UTC is still 8 Nov
    late, early = datetime(2026, 11, 8, 17, 30, tzinfo=UTC), datetime(2026, 11, 8, 16, 59, tzinfo=UTC)
    confirmed = [{"confirmed_at": late, "model_total": 10, "actual_amount": 12}]
    out = daily_stats([late, early], confirmed, today=date(2026, 11, 9), days=2)
    assert [(d.date, d.detections, d.confirmed, d.pipes_actual) for d in out] == [
        (date(2026, 11, 8), 1, 0, 0),
        (date(2026, 11, 9), 1, 1, 12),
    ]
    assert out[1].corrected == 1 and out[1].correction_rate == 1.0


def test_daily_503_without_database(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "")
    r = TestClient(app).get("/api/stats/daily")
    assert r.status_code == 503 and "database not configured" in r.json()["detail"]
