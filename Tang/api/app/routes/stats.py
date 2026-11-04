from datetime import UTC, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.repo import Repo, get_repo

router = APIRouter(prefix="/api")

LOCAL_TZ = ZoneInfo("Asia/Bangkok")  # "today" = the warehouse's calendar day, not UTC


class StatsResponse(BaseModel):
    detections_today: int  # batches created today (any status)
    confirmed_total: int  # confirmed batches, all time
    correction_rate: float | None  # confirmed with actual != model / confirmed_total; null if none confirmed
    failed_images_today: int  # photos uploaded today that the detector could not read


def today_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """[start, end) of the current Bangkok day, as UTC datetimes."""
    local = (now or datetime.now(UTC)).astimezone(LOCAL_TZ)
    start = datetime.combine(local.date(), time.min, tzinfo=LOCAL_TZ)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


@router.get("/stats", response_model=StatsResponse)
def get_stats(repo: Annotated[Repo, Depends(get_repo)]):
    s = repo.stats(*today_bounds())
    confirmed = s["confirmed_total"]
    return StatsResponse(
        detections_today=s["detections_today"],
        confirmed_total=confirmed,
        correction_rate=round(s["flagged_total"] / confirmed, 4) if confirmed else None,
        failed_images_today=s["failed_images_today"],
    )
