import uuid
from pathlib import Path

import pytest

from app import repo
from app.repo import ImageToSave
from app.schemas import Detection, Pipe


class FakeTable:
    def __init__(self, db, name):
        self.db, self.name = db, name

    def insert(self, rows):
        self.rows = rows
        self.op = "insert"
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, val):
        self.filter = (col, val)
        return self

    def execute(self):
        if self.op == "delete":
            self.db.deletes.append((self.name, self.filter))
            if self.db.delete_fails:
                raise ConnectionError("cleanup boom")
            return
        if self.db.fail_on == self.name:
            raise RuntimeError("boom")
        self.db.calls.append((self.name, self.rows))


class FakeClient:
    def __init__(self, fail_on=None, delete_fails=False):
        self.fail_on, self.calls = fail_on, []
        self.delete_fails, self.deletes = delete_fails, []

    def table(self, name):
        return FakeTable(self, name)


def det(n=2):
    pipes = [Pipe(box=(1, 2, 3, 4), confidence=0.9) for _ in range(n)]
    return Detection(count=n, crop_box=(0, 0, 10, 10), pipes=pipes)


def item(filename="a.jpg", data=b"abc"):
    return ImageToSave(filename=filename, data=data, detection=det(),
                       quality={"brightness": "ok", "blur": "ok"})


def test_saves_rows_and_files(tmp_path):
    client = FakeClient()
    res = repo.save_batch([item(), item("b.png", b"zz")], client=client, data_dir=tmp_path)
    assert [c[0] for c in client.calls] == ["batches", "images"]
    batch = client.calls[0][1]
    assert set(batch) == {"id", "confirmed"} and batch["confirmed"] is False
    assert batch["id"] == res.batch_id
    rows = client.calls[1][1]
    assert len(rows) == 2
    cols = {"id", "batch_id", "filename", "count", "crop_box", "pipes",
            "quality", "original_bytes", "stored_bytes"}
    for r in rows:
        assert set(r) == cols
        uuid.UUID(r["id"])
        assert r["batch_id"] == res.batch_id
    assert rows[0]["filename"] == "a.jpg" and rows[0]["count"] == 2
    assert rows[0]["crop_box"] == [0, 0, 10, 10]
    assert rows[0]["pipes"][0] == {"box": [1, 2, 3, 4], "confidence": 0.9}
    assert rows[0]["original_bytes"] == rows[0]["stored_bytes"] == 3
    assert res.image_ids == [r["id"] for r in rows]
    f = tmp_path / "images" / res.batch_id / f"{rows[1]['id']}.png"
    assert f.read_bytes() == b"zz"


EVIL = r"../../evil.jpg\..\x"


def test_filename_never_used_as_path(tmp_path):
    client = FakeClient()
    res = repo.save_batch([item(EVIL)], client=client, data_dir=tmp_path)
    files = [p for p in tmp_path.rglob("*") if p.is_file()]
    assert len(files) == 1
    assert files[0].parent == tmp_path / "images" / res.batch_id
    assert files[0].stem == res.image_ids[0]
    assert client.calls[1][1][0]["filename"] == EVIL


@pytest.mark.parametrize("name,ext", [("x.JPG", ".jpg"), ("x.jpeg", ".jpg"),
                                      ("x.webp", ".webp"), ("x.exe", ".bin"),
                                      ("x./../", ".bin"), ("noext", ".bin")])
def test_ext_whitelist(tmp_path, name, ext):
    res = repo.save_batch([item(name)], client=FakeClient(), data_dir=tmp_path)
    files = list((tmp_path / "images" / res.batch_id).iterdir())
    assert files[0].suffix == ext


@pytest.mark.parametrize("fail_on", ["batches", "images"])
def test_cleanup_on_insert_failure(tmp_path, fail_on):
    with pytest.raises(RuntimeError):
        repo.save_batch([item(), item()], client=FakeClient(fail_on), data_dir=tmp_path)
    assert [p for p in tmp_path.rglob("*") if p.is_file()] == []
    assert not list((tmp_path / "images").glob("*")) if (tmp_path / "images").exists() else True


def _no_files(tmp_path):
    return [p for p in tmp_path.rglob("*") if p.is_file()] == []


def test_images_insert_fails_deletes_batch_row(tmp_path):
    client = FakeClient("images")
    with pytest.raises(RuntimeError, match="boom"):
        repo.save_batch([item()], client=client, data_dir=tmp_path)
    batch_id = client.calls[0][1]["id"]
    assert client.deletes == [("batches", ("id", batch_id))]
    assert _no_files(tmp_path)


def test_batches_insert_fails_no_delete(tmp_path):
    client = FakeClient("batches")
    with pytest.raises(RuntimeError, match="boom"):
        repo.save_batch([item()], client=client, data_dir=tmp_path)
    assert client.deletes == []


def test_cleanup_failure_does_not_mask_original(tmp_path, capsys):
    client = FakeClient("images", delete_fails=True)
    with pytest.raises(RuntimeError, match="boom"):
        repo.save_batch([item()], client=client, data_dir=tmp_path)
    assert len(client.deletes) == 1
    assert _no_files(tmp_path)
    out = capsys.readouterr()
    assert out.out == "" and out.err == ""


def test_empty_batch_rejected(tmp_path):
    with pytest.raises(ValueError):
        repo.save_batch([], client=FakeClient(), data_dir=tmp_path)


def test_missing_env_clear_error(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    repo._client = None
    with pytest.raises(RuntimeError) as e:
        repo.get_client()
    assert "SUPABASE_URL" in str(e.value)
    assert "SUPABASE_SERVICE_ROLE_KEY" in str(e.value)
