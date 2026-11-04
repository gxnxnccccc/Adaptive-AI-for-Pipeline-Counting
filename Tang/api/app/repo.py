"""Storage adapter: the ONLY file that imports supabase.

Routes get a Repo through the `get_repo` FastAPI dependency. Tests override it
with InMemoryRepo (same behaviour, no network). Rows are plain dicts with the
DB column names (see supabase/migrations/20261104_init.sql) plus image_count.
"""

import uuid
from contextlib import suppress
from datetime import UTC, datetime
from functools import cached_property
from typing import Protocol

from app.config import settings

BATCH_COLUMNS = (
    "id, created_at, operator_id, do_number, status, model_total, actual_amount, notes, confirmed_at"
)


class RepoUnavailable(Exception):
    """Database not configured or not reachable -> HTTP 503 (handler in main.py)."""


class NotFound(Exception):
    pass


class AlreadyConfirmed(Exception):
    pass


class InvalidImages(Exception):
    """image_ids empty or not part of this batch -> HTTP 422."""


class Repo(Protocol):
    def create_batch(self, operator_id: str, images: list[dict]) -> str: ...
    def confirm_batch(
        self, batch_id: str, do_number: str, actual_amount: int, notes: str, image_ids: list[str] | None = None
    ) -> dict: ...
    def get_batch(self, batch_id: str) -> dict | None: ...
    def list_batches(self, status: str | None, q: str, limit: int, offset: int) -> tuple[list[dict], int]: ...
    def stats(self, day_start: datetime, day_end: datetime) -> dict: ...


# ---- shared rules (both repos must behave the same) ----


def is_flagged(row: dict) -> bool:
    """Confirmed and the operator's count differs from the model (same as the DB generated column)."""
    return row["status"] == "confirmed" and row["actual_amount"] != row["model_total"]


def clean_q(q: str | None) -> str:
    """Search text: letters, digits, space and '-' only. No PostgREST reserved chars
    (, . : ( ) ") and no ilike wildcards (% _ *), so both repos do a plain
    case-insensitive substring match."""
    return "".join(ch for ch in (q or "") if ch.isalnum() or ch in " -").strip()


def kept_positions(image_ids: list[str] | None, positions: list[int]) -> set[int]:
    """`img_<n>` ids -> upload positions to keep. None = keep all. Empty or unknown ids -> InvalidImages."""
    if image_ids is None:
        return set(positions)
    kept = set()
    for image_id in image_ids:
        n = image_id[4:] if image_id.startswith("img_") else ""
        if not n.isdigit() or int(n) not in positions:
            raise InvalidImages(image_id)
        kept.add(int(n))
    if not kept:
        raise InvalidImages("no images kept")
    return kept


def _valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def _image_rows(batch_id: str, images: list[dict]) -> tuple[list[dict], list[dict]]:
    """images: [{position, filename, original_bytes, model_count, mean_confidence,
    crop_box, brightness, error, pipes:[{box, confidence}]}] -> (image rows, pipe rows)."""
    image_rows, pipe_rows = [], []
    for img in images:
        image_id = str(uuid.uuid4())
        image_rows.append({"id": image_id, "batch_id": batch_id, **{k: v for k, v in img.items() if k != "pipes"}})
        pipe_rows += [
            {"image_id": image_id, "box": p["box"], "confidence": p["confidence"], "source": "model", "removed": False}
            for p in img.get("pipes", [])
        ]
    return image_rows, pipe_rows


# ---- Supabase ----


def is_configured() -> bool:
    """Only a real-looking server key counts: new `sb_secret_...` or a legacy service_role JWT.
    Anything else (empty, `<...>`, `your-key-here`) is treated as a placeholder -> 503."""
    key = settings.supabase_secret_key.strip()
    real_key = (key.startswith("sb_secret_") and len(key) > 20) or (key.startswith("eyJ") and key.count(".") == 2)
    return settings.supabase_url.strip().startswith("https://") and real_key


class SupabaseRepo:
    def __init__(self, url: str, key: str):
        self._url, self._key = url, key

    @cached_property
    def _db(self):
        # lazy import + client: the app imports and /health works without a key
        from supabase import create_client

        return create_client(self._url, self._key)

    def _run(self, query):
        try:
            return query.execute()
        except Exception as e:  # network / PostgREST errors -> 503, never a raw 500 with internals
            reason = getattr(e, "message", None) or type(e).__name__  # e.g. "Invalid API key"
            raise RepoUnavailable(f"database error: {reason}") from e

    def create_batch(self, operator_id: str, images: list[dict]) -> str:
        batch_id = str(uuid.uuid4())
        model_total = sum(img["model_count"] for img in images)
        image_rows, pipe_rows = _image_rows(batch_id, images)
        self._run(self._db.table("batches").insert({"id": batch_id, "operator_id": operator_id, "model_total": model_total}))
        try:  # PostgREST has no multi-table transaction: undo the batch if a child insert fails
            if image_rows:
                self._run(self._db.table("images").insert(image_rows))
            if pipe_rows:
                self._run(self._db.table("pipes").insert(pipe_rows))
        except RepoUnavailable:
            with suppress(RepoUnavailable):  # best effort; the original error is raised below
                self._run(self._db.table("batches").delete().eq("id", batch_id))  # cascades
            raise
        return batch_id

    def get_batch(self, batch_id: str) -> dict | None:
        if not _valid_uuid(batch_id):
            return None
        res = self._run(self._db.table("batches").select(f"{BATCH_COLUMNS}, images(count)").eq("id", batch_id).limit(1))
        return _flatten(res.data[0]) if res.data else None

    def confirm_batch(
        self, batch_id: str, do_number: str, actual_amount: int, notes: str, image_ids: list[str] | None = None
    ) -> dict:
        if not _valid_uuid(batch_id):
            raise NotFound(batch_id)
        current = self.get_batch(batch_id)
        if current is None:
            raise NotFound(batch_id)
        if current["status"] != "draft":
            raise AlreadyConfirmed(batch_id)
        # model_total comes from the kept images only (column images.excluded: migration 20261104_images_excluded.sql)
        imgs = self._run(self._db.table("images").select("position, model_count").eq("batch_id", batch_id)).data
        kept = kept_positions(image_ids, [i["position"] for i in imgs])
        values = {
            "status": "confirmed",
            "do_number": do_number,
            "actual_amount": actual_amount,
            "notes": notes,
            "confirmed_at": datetime.now(UTC).isoformat(),
            "model_total": sum(i["model_count"] for i in imgs if i["position"] in kept),
        }
        # only a draft can be confirmed: the status filter makes this atomic
        res = self._run(self._db.table("batches").update(values).eq("id", batch_id).eq("status", "draft"))
        if not res.data:
            raise AlreadyConfirmed(batch_id)
        dropped = [i["position"] for i in imgs if i["position"] not in kept]
        if dropped:
            self._run(
                self._db.table("images").update({"excluded": True}).eq("batch_id", batch_id).in_("position", dropped)
            )
        row = self.get_batch(batch_id)
        if row is None:
            raise NotFound(batch_id)
        return row

    def list_batches(self, status: str | None, q: str, limit: int, offset: int) -> tuple[list[dict], int]:
        term = clean_q(q)

        def build(columns: str, **kw):
            query = self._db.table("batches").select(columns, count="exact", **kw)
            if status == "flagged":
                query = query.eq("flagged", True)
            elif status:
                query = query.eq("status", status)
            if term:
                query = query.or_(f"do_number.ilike.*{term}*,operator_id.ilike.*{term}*")
            return query

        query = build(f"{BATCH_COLUMNS}, images(count)").order("created_at", desc=True).order("id", desc=True)
        try:
            res = self._run(query.range(offset, offset + limit - 1))
        except RepoUnavailable as e:
            if getattr(e.__cause__, "code", None) != "PGRST103":  # offset past the end
                raise
            return [], self._run(build("id", head=True)).count or 0
        return [_flatten(r) for r in res.data], res.count or 0

    def stats(self, day_start: datetime, day_end: datetime) -> dict:
        def count(table: str, build) -> int:
            return self._run(build(self._db.table(table).select("id", count="exact", head=True))).count or 0

        start, end = day_start.isoformat(), day_end.isoformat()
        return {
            "detections_today": count("batches", lambda b: b.gte("created_at", start).lt("created_at", end)),
            "confirmed_total": count("batches", lambda b: b.eq("status", "confirmed")),
            "flagged_total": count("batches", lambda b: b.eq("flagged", True)),
            "failed_images_today": count(
                "images", lambda b: b.not_.is_("error", "null").gte("created_at", start).lt("created_at", end)
            ),
        }


def _flatten(row: dict) -> dict:
    """PostgREST returns images(count) as [{"count": n}]."""
    row = dict(row)
    embedded = row.pop("images", None) or [{"count": 0}]
    row["image_count"] = embedded[0]["count"]
    return row


_supabase_repo: SupabaseRepo | None = None


def get_repo() -> Repo:
    """FastAPI dependency. Tests replace it via app.dependency_overrides."""
    global _supabase_repo
    if not is_configured():
        raise RepoUnavailable("database not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY in api/.env")
    if _supabase_repo is None:
        _supabase_repo = SupabaseRepo(settings.supabase_url, settings.supabase_secret_key)
    return _supabase_repo


# ---- in-memory (tests, mirrors SupabaseRepo) ----


class InMemoryRepo:
    def __init__(self):
        self.batches: dict[str, dict] = {}
        self.images: list[dict] = []
        self.pipes: list[dict] = []
        self.now = lambda: datetime.now(UTC)  # tests replace this to place rows on other days

    def create_batch(self, operator_id: str, images: list[dict]) -> str:
        batch_id = str(uuid.uuid4())
        created = self.now()
        image_rows, pipe_rows = _image_rows(batch_id, images)
        self.batches[batch_id] = {
            "id": batch_id,
            "created_at": created,
            "operator_id": operator_id,
            "do_number": None,
            "status": "draft",
            "model_total": sum(img["model_count"] for img in images),
            "actual_amount": None,
            "notes": None,
            "confirmed_at": None,
        }
        self.images += [{**r, "created_at": created, "excluded": False} for r in image_rows]
        self.pipes += pipe_rows
        return batch_id

    def get_batch(self, batch_id: str) -> dict | None:
        row = self.batches.get(batch_id)
        if row is None:
            return None
        return {**row, "image_count": sum(1 for i in self.images if i["batch_id"] == batch_id)}

    def confirm_batch(
        self, batch_id: str, do_number: str, actual_amount: int, notes: str, image_ids: list[str] | None = None
    ) -> dict:
        row = self.batches.get(batch_id)
        if row is None:
            raise NotFound(batch_id)
        if row["status"] != "draft":
            raise AlreadyConfirmed(batch_id)
        imgs = [i for i in self.images if i["batch_id"] == batch_id]
        kept = kept_positions(image_ids, [i["position"] for i in imgs])
        for i in imgs:
            i["excluded"] = i["position"] not in kept
        row.update(
            status="confirmed",
            do_number=do_number,
            actual_amount=actual_amount,
            notes=notes,
            confirmed_at=self.now(),
            model_total=sum(i["model_count"] for i in imgs if i["position"] in kept),
        )
        return self.get_batch(batch_id)

    def list_batches(self, status: str | None, q: str, limit: int, offset: int) -> tuple[list[dict], int]:
        rows = list(self.batches.values())
        if status == "flagged":
            rows = [r for r in rows if is_flagged(r)]
        elif status:
            rows = [r for r in rows if r["status"] == status]
        if q := clean_q(q).lower():
            rows = [r for r in rows if q in (r["do_number"] or "").lower() or q in r["operator_id"].lower()]
        rows.sort(key=lambda r: (r["created_at"], r["id"]), reverse=True)
        return [self.get_batch(r["id"]) for r in rows[offset : offset + limit]], len(rows)

    def stats(self, day_start: datetime, day_end: datetime) -> dict:
        def today(row):
            return day_start <= row["created_at"] < day_end

        rows = self.batches.values()
        return {
            "detections_today": sum(1 for r in rows if today(r)),
            "confirmed_total": sum(1 for r in rows if r["status"] == "confirmed"),
            "flagged_total": sum(1 for r in rows if is_flagged(r)),
            "failed_images_today": sum(1 for i in self.images if i["error"] is not None and today(i)),
        }
