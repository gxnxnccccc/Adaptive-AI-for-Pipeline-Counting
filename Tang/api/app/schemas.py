from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.repo import is_flagged


class Pipe(BaseModel):
    box: list[int]  # TODO(contract): format/units still OPEN (mock: pixels, [x,y,w,h])
    confidence: float


class Quality(BaseModel):
    brightness: str  # "dark" | "ok" | "bright"


class ImageResult(BaseModel):
    image_id: str
    filename: str
    count: int | None = None
    crop_box: list[int] | None = None
    pipes: list[Pipe] = []
    quality: Quality | None = None
    original_bytes: int
    # TODO(contract): stored_bytes omitted until image storage exists
    error: str | None = None


class CountsResponse(BaseModel):
    batch_id: str  # DB uuid of the saved draft batch
    images: list[ImageResult]


Text64 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class ConfirmRequest(BaseModel):
    do_number: Text64  # TODO(contract): DO number format still OPEN, any non-empty text for now
    actual_amount: int = Field(ge=0)
    notes: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    # Kept photos (`img_<n>` ids from the upload response). Omitted = keep all; the rest are marked excluded.
    image_ids: Annotated[list[str], Field(min_length=1, max_length=10)] | None = None


class BatchRecord(BaseModel):
    batch_id: str
    created_at: datetime
    operator_id: str
    do_number: str | None
    image_count: int
    model_total: int
    actual_amount: int | None
    variance: int | None  # actual_amount - model_total, null until confirmed
    status: Literal["draft", "confirmed"]
    flagged: bool  # confirmed and actual_amount != model_total
    notes: str | None
    confirmed_at: datetime | None

    @classmethod
    def from_row(cls, row: dict) -> "BatchRecord":
        confirmed = row["status"] == "confirmed"
        return cls(
            batch_id=str(row["id"]),
            variance=row["actual_amount"] - row["model_total"] if confirmed else None,
            flagged=is_flagged(row),
            **{k: row[k] for k in cls.model_fields if k in row and k not in ("variance", "flagged")},
        )
