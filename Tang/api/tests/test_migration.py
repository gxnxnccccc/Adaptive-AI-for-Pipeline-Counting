"""Static checks on the init migration (no database needed).

Parses the SQL text only. Nothing here connects to Postgres or Supabase.
"""
import re
from pathlib import Path

MIG = Path(__file__).resolve().parents[1] / "supabase" / "migrations" / "20261124090000_init.sql"


def _sql() -> str:
    """SQL with -- comments stripped, lowercased, whitespace collapsed."""
    raw = MIG.read_text(encoding="utf-8")
    no_comments = "\n".join(line.split("--", 1)[0] for line in raw.splitlines())
    return re.sub(r"\s+", " ", no_comments).lower()


def _table_body(sql: str, name: str) -> str:
    m = re.search(rf"create table if not exists public\.{name} \((.*?)\);", sql)
    assert m, f"table {name} not created with 'if not exists'"
    return m.group(1)


def _cols(body: str) -> dict:
    # split on commas outside parentheses
    parts, depth, cur = [], 0, ""
    for ch in body:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    parts.append(cur.strip())
    out = {}
    for p in parts:
        name, rest = p.split(" ", 1)
        out[name] = rest
    return out


def test_file_exists():
    assert MIG.is_file()


def test_batches_columns():
    cols = _cols(_table_body(_sql(), "batches"))
    assert list(cols) == ["id", "created_at", "confirmed"]
    assert cols["id"] == "uuid primary key default gen_random_uuid()"
    assert cols["created_at"] == "timestamptz not null default now()"
    assert cols["confirmed"] == "boolean not null default false"


def test_images_columns():
    cols = _cols(_table_body(_sql(), "images"))
    assert list(cols) == [
        "id", "batch_id", "filename", "count", "crop_box",
        "pipes", "quality", "original_bytes", "stored_bytes",
    ]
    assert cols["id"] == "uuid primary key default gen_random_uuid()"
    assert cols["batch_id"] == "uuid not null references public.batches(id) on delete cascade"
    assert cols["filename"] == "text"
    assert cols["count"] == "integer not null"
    assert cols["crop_box"] == "jsonb"
    assert cols["pipes"] == "jsonb not null default '[]'"
    assert cols["quality"] == "jsonb"
    assert cols["original_bytes"] == "bigint"
    assert cols["stored_bytes"] == "bigint"


def test_index_on_batch_id():
    assert re.search(
        r"create index if not exists \w+ on public\.images \(batch_id\);", _sql()
    )


def test_rls_enabled_no_policies():
    sql = _sql()
    assert "alter table public.batches enable row level security;" in sql
    assert "alter table public.images enable row level security;" in sql
    assert "create policy" not in sql


def test_rerunnable_only_if_not_exists():
    sql = _sql()
    for stmt in re.findall(r"create (?:unique )?(table|index)\b ?(if not exists)?", sql):
        assert stmt[1] == "if not exists", f"create {stmt[0]} without if not exists"
    assert "drop " not in sql


def test_no_forbidden_fields():
    sql = _sql()
    for bad in ("pipe_size", "do_number", "final_count", "actual", "note"):
        assert bad not in sql, f"forbidden field in SQL: {bad}"


def test_env_example_has_no_secrets():
    env = MIG.parents[2] / ".env.example"
    text = env.read_text(encoding="utf-8")
    assert "MOCK_SEED=0" in text
    for line in text.splitlines():
        if line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        if key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            assert val.strip().startswith("<") or "<" in val, f"{key} not a placeholder"
        assert not re.search(r"eyJ[A-Za-z0-9_-]{20,}|sb_secret_|sbp_", val), f"secret-like value in {key}"
