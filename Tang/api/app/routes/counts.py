from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app import detector
from app.config import settings
from app.repo import (
    AlreadyConfirmed,
    InvalidCorrections,
    InvalidImages,
    NotFound,
    Repo,
    get_repo,
)
from app.schemas import BatchRecord, ConfirmRequest, CountsResponse, ImageResult

router = APIRouter(prefix="/api")

RepoDep = Annotated[Repo, Depends(get_repo)]


def _image_row(position: int, r: ImageResult) -> dict:
    confs = [p.confidence for p in r.pipes]
    return {
        "position": position,
        "filename": r.filename,
        "original_bytes": r.original_bytes,
        "model_count": r.count or 0,
        "mean_confidence": round(sum(confs) / len(confs), 4) if confs else None,
        "crop_box": r.crop_box,
        "brightness": r.quality.brightness if r.quality else None,
        "error": r.error,
        "pipes": [p.model_dump() for p in r.pipes],
    }


# Plain `def`: FastAPI runs it in a threadpool, so CPU-bound detection does not block the event loop.
@router.post("/counts", response_model=CountsResponse)
def create_counts(
    images: list[UploadFile],
    repo: RepoDep,
    operator_id: Annotated[str, Form(max_length=64)] = "unknown",
):
    if len(images) > settings.max_files_per_request:
        raise HTTPException(413, f"too many files: max {settings.max_files_per_request} per request")

    results = []
    for n, f in enumerate(images, start=1):
        data = f.file.read(settings.max_file_bytes + 1)
        base = {"image_id": f"img_{n}", "filename": f.filename or f"image_{n}", "original_bytes": len(data)}
        if len(data) > settings.max_file_bytes:
            msg = f"file too large: max {settings.max_file_bytes // (1024 * 1024)} MB"
            results.append(ImageResult(**base, error=msg))
            continue
        try:
            results.append(ImageResult(**base, **detector.detect(data)))
        except ValueError as e:
            results.append(ImageResult(**base, error=str(e)))

    batch_id = repo.create_batch(
        operator_id.strip() or "unknown", [_image_row(n, r) for n, r in enumerate(results, start=1)]
    )
    return CountsResponse(batch_id=batch_id, images=results)


class RecordsResponse(BaseModel):
    items: list[BatchRecord]
    total: int  # rows matching the filter, before limit/offset


@router.get("/counts", response_model=RecordsResponse)
def list_counts(
    repo: RepoDep,
    status: Literal["draft", "confirmed", "flagged"] | None = None,
    q: Annotated[str, Query(max_length=64)] = "",  # matches DO number or operator, case-insensitive
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    rows, total = repo.list_batches(status, q, limit, offset)
    return RecordsResponse(items=[BatchRecord.from_row(r) for r in rows], total=total)


@router.post("/counts/{batch_id}/confirm", response_model=BatchRecord)
def confirm_counts(batch_id: str, body: ConfirmRequest, repo: RepoDep):
    try:
        corrections = [c.model_dump() for c in body.corrections] if body.corrections else None
        row = repo.confirm_batch(
            batch_id, body.do_number, body.actual_amount, body.notes, body.image_ids, corrections
        )
    except NotFound:
        raise HTTPException(404, "batch not found") from None
    except AlreadyConfirmed:
        raise HTTPException(409, "batch already confirmed") from None
    except InvalidImages:
        raise HTTPException(422, "image_ids must be a non-empty list of ids from this batch") from None
    except InvalidCorrections as e:
        raise HTTPException(422, f"invalid corrections: {e}") from None
    return BatchRecord.from_row(row)
