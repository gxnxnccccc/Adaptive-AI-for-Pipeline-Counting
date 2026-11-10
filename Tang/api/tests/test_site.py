import importlib

from fastapi.testclient import TestClient


def test_serves_built_site(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<html>spds</html>")
    (tmp_path / "x.txt").write_text("hi")
    monkeypatch.setenv("SPDS_SITE", str(tmp_path))
    import app.main as m

    m = importlib.reload(m)
    try:
        c = TestClient(m.app)
        assert c.get("/processing").text == "<html>spds</html>"  # SPA fallback
        assert c.get("/x.txt").text == "hi"
        assert c.get("/..%2f..%2fetc/passwd").text == "<html>spds</html>"  # no traversal
        assert c.get("/api/nope").status_code == 404
        assert c.get("/health").json()["status"] == "ok"
    finally:
        monkeypatch.delenv("SPDS_SITE")
        importlib.reload(m)
