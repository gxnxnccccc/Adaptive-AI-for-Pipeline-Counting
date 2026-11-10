from collections import Counter, defaultdict
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
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


class DayStats(BaseModel):
    date: date  # Bangkok calendar day
    detections: int  # batches created that day (any status)
    pipes_actual: int  # sum of actual_amount of batches confirmed that day
    confirmed: int  # batches confirmed that day
    corrected: int  # confirmed that day with actual != model
    correction_rate: float | None  # corrected / confirmed; null if none confirmed


class DailyStatsResponse(BaseModel):
    days: list[DayStats]  # oldest first, ends today


def local_day(t: datetime) -> date:
    return t.astimezone(LOCAL_TZ).date()


def daily_stats(created: list[datetime], confirmed: list[dict], today: date, days: int) -> list[DayStats]:
    """Bucket rows by Bangkok day; one entry per day (zero-filled) from today-(days-1) to today."""
    detections = Counter(local_day(t) for t in created)
    by_day: dict[date, list[dict]] = defaultdict(list)
    for r in confirmed:
        by_day[local_day(r["confirmed_at"])].append(r)
    out = []
    for n in range(days - 1, -1, -1):
        d = today - timedelta(days=n)
        rows = by_day[d]
        corrected = sum(1 for r in rows if r["actual_amount"] != r["model_total"])
        out.append(
            DayStats(
                date=d,
                detections=detections[d],
                pipes_actual=sum(r["actual_amount"] for r in rows),
                confirmed=len(rows),
                corrected=corrected,
                correction_rate=round(corrected / len(rows), 4) if rows else None,
            )
        )
    return out


@router.get("/stats/daily", response_model=DailyStatsResponse)
def get_daily_stats(repo: Annotated[Repo, Depends(get_repo)], days: Annotated[int, Query(ge=1, le=31)] = 7):
    now = datetime.now(UTC)
    _, end = today_bounds(now)
    start = end - timedelta(days=days)  # Bangkok has no DST: every day is 24 h
    rows = repo.daily_rows(start, end)
    return DailyStatsResponse(days=daily_stats(rows["created"], rows["confirmed"], local_day(now), days))


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
