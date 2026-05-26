from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/timestamp", tags=["timestamp"])

TIMEZONES = {
    "UTC":     0,
    "US/Eastern":  -5,
    "US/Pacific":  -8,
    "Europe/London": 0,
    "Europe/Paris":  1,
    "Asia/Kolkata":  5.5,
    "Asia/Tokyo":    9,
    "Australia/Sydney": 10,
}


class TimestampRequest(BaseModel):
    value: str          # Unix timestamp (int as string) OR ISO date string
    mode: str           # "to_date" or "to_timestamp"


@router.post("/convert")
async def convert_timestamp(request: TimestampRequest):
    mode = request.mode.lower().strip()

    if mode not in {"to_date", "to_timestamp"}:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": "mode must be 'to_date' or 'to_timestamp'"}
            },
        )

    try:
        if mode == "to_date":
            ts = int(request.value)
            dt_utc = datetime.fromtimestamp(ts, tz=timezone.utc)

            zones = {}
            for name, offset_hours in TIMEZONES.items():
                from datetime import timedelta
                offset = timedelta(hours=offset_hours)
                tz = timezone(offset)
                zones[name] = dt_utc.astimezone(tz).strftime("%Y-%m-%d %H:%M:%S %Z")

            return {
                "status": "success",
                "data": {
                    "unix_timestamp": ts,
                    "utc": dt_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "iso8601": dt_utc.isoformat(),
                    "timezones": zones,
                    "relative": _relative_time(dt_utc),
                },
            }

        else:  # to_timestamp
            # Try parsing common date formats
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d",
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y",
            ]
            dt = None
            for fmt in formats:
                try:
                    dt = datetime.strptime(request.value.strip(), fmt)
                    break
                except ValueError:
                    continue

            if dt is None:
                return JSONResponse(
                    status_code=422,
                    content={
                        "status": "error",
                        "data": {"message": f"Cannot parse date '{request.value}'. "
                                            "Use formats like: 2024-01-15 14:30:00 or 2024-01-15"}
                    },
                )

            dt_utc = dt.replace(tzinfo=timezone.utc)
            ts = int(dt_utc.timestamp())

            return {
                "status": "success",
                "data": {
                    "unix_timestamp": ts,
                    "utc": dt_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "iso8601": dt_utc.isoformat(),
                },
            }

    except (ValueError, OSError) as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Conversion failed: {str(e)}"}
            },
        )


def _relative_time(dt: datetime) -> str:
    now = datetime.now(tz=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 0:
        seconds = -seconds
        prefix, suffix = "in ", ""
    else:
        prefix, suffix = "", " ago"

    if seconds < 60:
        return f"{prefix}{seconds} second{'s' if seconds != 1 else ''}{suffix}"
    elif seconds < 3600:
        m = seconds // 60
        return f"{prefix}{m} minute{'s' if m != 1 else ''}{suffix}"
    elif seconds < 86400:
        h = seconds // 3600
        return f"{prefix}{h} hour{'s' if h != 1 else ''}{suffix}"
    else:
        d = seconds // 86400
        return f"{prefix}{d} day{'s' if d != 1 else ''}{suffix}"
