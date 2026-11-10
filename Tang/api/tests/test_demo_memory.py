import pytest
from fastapi.testclient import TestClient

from app import repo as repo_mod
from app.config import settings
from app.main import app
from tests.conftest import files, png_stack


@pytest.fixture
def no_keys(monkeypatch):
    """No Supabase keys, no dependency override: the real get_repo runs."""
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_secret_key", "")
    monkeypatch.setattr(repo_mod, "_demo_repo", None)


def upload(c):
    return c.post("/api/counts", files=files(("a.png", png_stack(), "image/png")), data={"operator_id": "op1"})


def test_demo_memory_full_flow_shared_across_requests(no_keys, monkeypatch):
    monkeypatch.setattr(settings, "demo_memory", True)
    c = TestClient(app)
    r = upload(c)
    assert r.status_code == 200
    batch_id = r.json()["batch_id"]
    ok = c.post(f"/api/counts/{batch_id}/confirm", json={"do_number": "DO-1", "actual_amount": 5, "notes": "ok"})
    assert ok.status_code == 200
    assert c.get("/api/stats").status_code == 200
    assert c.get("/api/stats").json()["confirmed_total"] == 1
    assert c.get("/api/counts").json()["total"] == 1  # same repo every request


def test_demo_flag_off_still_503(no_keys, monkeypatch):
    monkeypatch.setattr(settings, "demo_memory", False)
    assert TestClient(app).get("/api/stats").status_code == 503


@pytest.mark.parametrize("demo,expected", [(True, "memory"), (False, "none")])
def test_health_storage(no_keys, monkeypatch, demo, expected):
    monkeypatch.setattr(settings, "demo_memory", demo)
    assert TestClient(app).get("/health").json() == {"status": "ok", "storage": expected}


def test_health_storage_supabase(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "https://x.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_" + "a" * 30)
    assert TestClient(app).get("/health").json()["storage"] == "supabase"
