import traceback
import pytest
from app import repo
from tests.test_repo import FakeClient, FakeTable, item

KEY = "sekret-service-role-KEY-123"


def leftovers(root):
    return [p for p in root.rglob("*") if p.name != root.name and p != root and p.parent != root.parent
            and (p.is_file() or (p.is_dir() and p.name != "images"))]


def clean(root):
    return not any(p.is_file() for p in root.rglob("*")) and not [p for p in (root / "images").glob("*")] \
        if (root / "images").exists() else True


def test_write_failure_before_db(tmp_path, monkeypatch):
    c = FakeClient()
    calls = []
    orig = repo.Path.write_bytes
    n = {"i": 0}

    def bad(self, data):
        n["i"] += 1
        if n["i"] == 2:
            raise OSError("disk full")
        return orig(self, data)
    monkeypatch.setattr(repo.Path, "write_bytes", bad)
    with pytest.raises(OSError, match="disk full"):
        repo.save_batch([item(), item()], client=c, data_dir=tmp_path)
    assert c.calls == [] and c.deletes == []
    assert clean(tmp_path)


def test_get_client_not_called_before_files_fail(tmp_path, monkeypatch):
    monkeypatch.setattr(repo, "get_client", lambda: pytest.fail("db touched"))
    monkeypatch.setattr(repo.Path, "write_bytes", lambda s, d: (_ for _ in ()).throw(OSError("x")))
    with pytest.raises(OSError):
        repo.save_batch([item()], data_dir=tmp_path)
    assert clean(tmp_path)


@pytest.mark.parametrize("fail_on", ["batches", "images"])
@pytest.mark.parametrize("dfail", [False, True])
def test_matrix(tmp_path, capsys, fail_on, dfail):
    c = FakeClient(fail_on, delete_fails=dfail)
    with pytest.raises(RuntimeError) as e:
        repo.save_batch([item(), item()], client=c, data_dir=tmp_path)
    assert str(e.value) == "boom" and type(e.value) is RuntimeError
    assert e.value.__context__ is None  # original, not chained to cleanup error
    tb = "".join(traceback.format_exception(e.value))
    assert "client.table(\"images\").insert" in tb or fail_on == "batches" or "save_batch" in tb
    assert "save_batch" in tb and "execute" in tb  # original frames kept
    assert KEY not in tb
    assert len(c.deletes) == (1 if fail_on == "images" else 0)
    if c.deletes:
        assert c.deletes[0] == ("batches", ("id", c.calls[0][1]["id"]))
    assert clean(tmp_path)
    o = capsys.readouterr()
    assert o.out == "" and o.err == ""


@pytest.mark.parametrize("exc", [ConnectionError, OSError, TimeoutError, ValueError, Exception])
def test_delete_exc_swallowed(tmp_path, exc):
    class T(FakeTable):
        def execute(self):
            if self.op == "delete":
                raise exc("cleanup " + KEY)
            return super().execute()
    class C(FakeClient):
        def table(self, name):
            return T(self, name)
    with pytest.raises(RuntimeError, match="^boom$"):
        repo.save_batch([item()], client=C("images"), data_dir=tmp_path)
    assert clean(tmp_path)


def test_keyboardinterrupt_in_delete_propagates(tmp_path):
    class T(FakeTable):
        def execute(self):
            if self.op == "delete":
                raise KeyboardInterrupt()
            return super().execute()
    class C(FakeClient):
        def table(self, name):
            return T(self, name)
    with pytest.raises(KeyboardInterrupt):
        repo.save_batch([item()], client=C("images"), data_dir=tmp_path)
    assert clean(tmp_path)  # files removed before delete attempted


def test_success_no_delete(tmp_path):
    c = FakeClient()
    repo.save_batch([item()], client=c, data_dir=tmp_path)
    assert c.deletes == [] and len(c.calls) == 2
