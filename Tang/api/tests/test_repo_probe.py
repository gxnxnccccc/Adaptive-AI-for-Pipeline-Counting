import re
import uuid
from pathlib import Path

import pytest

from app import repo
from app.repo import ImageToSave
from tests.test_repo import FakeClient, item

SQL = (Path(__file__).resolve().parent.parent / "supabase" / "migrations"
       / "20261124090000_init.sql").read_text()


def files(root):
    return [p for p in root.rglob("*") if p.is_file()]


NAMES = ["../../x", "/etc/passwd", r"C:\x", r"C:\Windows\a.jpg", "a" + chr(0) + ".jpg",
         "a.jpg" + chr(0) + ".exe", "x" * 5000 + ".jpg", "ท่อเหล็ก.jpg", "ท่อ.JPG", "..", ".", "",
         "con.jpg", "a.jpg ", r"..\..\a.png", ".jpg", "emoji😀.webp"]


@pytest.mark.parametrize("name", NAMES)
def test_hostile_names(tmp_path, name):
    c = FakeClient()
    res = repo.save_batch([item(name)], client=c, data_dir=tmp_path)
    fs = files(tmp_path)
    assert len(fs) == 1
    assert fs[0].parent == tmp_path / "images" / res.batch_id
    assert fs[0].suffix in {".jpg", ".png", ".webp", ".bin"}
    assert re.fullmatch(r"[0-9a-f-]{36}\.(jpg|png|webp|bin)", fs[0].name)
    assert c.calls[1][1][0]["filename"] == name
    # nothing escaped data_dir
    assert not [p for p in tmp_path.parent.glob("x*") if p.is_file() and p.name == "x"]


def test_duplicate_names_in_batch(tmp_path):
    res = repo.save_batch([item("a.jpg", b"1"), item("a.jpg", b"22")],
                          client=FakeClient(), data_dir=tmp_path)
    assert len(set(res.image_ids)) == 2
    assert sorted(len(p.read_bytes()) for p in files(tmp_path)) == [1, 2]


def test_ids_uuid4_and_unique(tmp_path):
    res = repo.save_batch([item() for _ in range(20)], client=FakeClient(), data_dir=tmp_path)
    ids = [res.batch_id] + res.image_ids
    assert len(set(ids)) == 21
    for i in ids:
        u = uuid.UUID(i)
        assert u.version == 4 and str(u) == i


def test_rows_match_migration(tmp_path):
    c = FakeClient()
    repo.save_batch([item()], client=c, data_dir=tmp_path)

    def cols(table):
        body = re.search(rf"create table if not exists public\.{table} \((.*?)\n\);", SQL, re.S).group(1)
        return {l.split()[0] for l in body.splitlines() if l.strip()}
    sql_img, sql_b = cols("images"), cols("batches")
    assert set(c.calls[1][1][0]) <= sql_img
    # columns with defaults/nullable that code skips: none for images
    assert sql_img - set(c.calls[1][1][0]) == set()
    assert set(c.calls[0][1]) <= sql_b and sql_b - set(c.calls[0][1]) == {"created_at"}


def test_bytes_equal_len(tmp_path):
    c = FakeClient()
    for data in (b"", b"x", b"\xff" * 12345):
        c.calls.clear()
        repo.save_batch([item("a.jpg", data)], client=c, data_dir=tmp_path)
        r = c.calls[1][1][0]
        assert r["stored_bytes"] == r["original_bytes"] == len(data)


class FailingTmp:
    pass


def test_cleanup_when_write_fails_midway(tmp_path, monkeypatch):
    orig = Path.write_bytes
    n = {"i": 0}

    def flaky(self, data):
        n["i"] += 1
        if n["i"] == 3:
            raise OSError("disk full")
        return orig(self, data)
    monkeypatch.setattr(Path, "write_bytes", flaky)
    c = FakeClient()
    with pytest.raises(OSError):
        repo.save_batch([item(), item(), item(), item()], client=c, data_dir=tmp_path)
    assert files(tmp_path) == []
    assert list((tmp_path / "images").iterdir()) == []
    assert c.calls == []  # no DB call after a failed write


@pytest.mark.parametrize("fail_on", ["batches", "images"])
def test_no_leftover_dirs_on_db_failure(tmp_path, fail_on):
    with pytest.raises(RuntimeError):
        repo.save_batch([item(), item()], client=FakeClient(fail_on), data_dir=tmp_path)
    assert list((tmp_path / "images").iterdir()) == []


def test_empty_list_no_side_effects(tmp_path):
    with pytest.raises(ValueError):
        repo.save_batch([], client=FakeClient(), data_dir=tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_missing_env_no_key_leak(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "SECRETKEY123")
    repo._client = None
    with pytest.raises(RuntimeError) as e:
        repo.get_client()
    assert "SECRETKEY123" not in str(e.value)
    assert "SUPABASE_URL" in str(e.value) and "SERVICE_ROLE_KEY" not in str(e.value).replace("SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.setenv("SUPABASE_URL", "https://secret-host.example")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    with pytest.raises(RuntimeError) as e:
        repo.get_client()
    assert "secret-host" not in str(e.value)
    assert repo._client is None
