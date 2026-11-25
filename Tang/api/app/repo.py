"""Persist a batch: rows in Supabase (tables batches/images), files on local disk.

Files: <data_dir>/images/<batch_id>/<image_id><ext>. Names are generated here;
the client filename is stored only as the DB column `filename`, never as a path.
Image storage in a Supabase bucket is M5; the swap point is this file.
"""
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from app import config
from app.schemas import Detection

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_EXTS = {".jpg": ".jpg", ".jpeg": ".jpg", ".png": ".png", ".webp": ".webp"}

_client = None


@dataclass
class ImageToSave:
    filename: str  # original name, display only
    data: bytes
    detection: Detection
    quality: dict  # placeholder until quality check exists (OPEN-3)


@dataclass
class SavedBatch:
    batch_id: str
    image_ids: list[str]


def get_client():
    """Lazy real Supabase client. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."""
    global _client
    if _client is None:
        url, key = config.supabase_settings()
        missing = [n for n, v in (("SUPABASE_URL", url),
                                  ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        if missing:
            raise RuntimeError("Missing env var(s): " + ", ".join(missing)
                               + ". Set them in api/.env.")
        from supabase import create_client
        _client = create_client(url, key)
    return _client


def _safe_ext(filename: str) -> str:
    # Only the suffix of the last path part, whitelisted. Anything else -> .bin
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    return _EXTS.get(Path(name).suffix.lower(), ".bin")


def save_batch(images: list[ImageToSave], client=None, data_dir: Path | None = None) -> SavedBatch:
    if not images:
        raise ValueError("images must not be empty")
    data_dir = Path(data_dir) if data_dir else DEFAULT_DATA_DIR
    batch_id = str(uuid.uuid4())
    batch_dir = data_dir / "images" / batch_id
    rows = []
    batch_inserted = False
    try:
        batch_dir.mkdir(parents=True)
        for im in images:
            image_id = str(uuid.uuid4())
            (batch_dir / f"{image_id}{_safe_ext(im.filename)}").write_bytes(im.data)
            d = im.detection
            rows.append({
                "id": image_id,
                "batch_id": batch_id,
                "filename": im.filename,
                "count": d.count,
                "crop_box": list(d.crop_box),
                "pipes": [{"box": list(p.box), "confidence": p.confidence} for p in d.pipes],
                "quality": im.quality,
                "original_bytes": len(im.data),
                "stored_bytes": len(im.data),  # no compression yet
            })
        client = client or get_client()
        client.table("batches").insert({"id": batch_id, "confirmed": False}).execute()
        batch_inserted = True
        client.table("images").insert(rows).execute()
    except Exception:
        shutil.rmtree(batch_dir, ignore_errors=True)
        if batch_inserted:
            try:  # best-effort: drop the orphan batches row; never mask the original error
                client.table("batches").delete().eq("id", batch_id).execute()
            except Exception:
                pass
        raise
    return SavedBatch(batch_id=batch_id, image_ids=[r["id"] for r in rows])
