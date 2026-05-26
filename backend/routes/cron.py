from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models import CronRequest

router = APIRouter(prefix="/cron", tags=["cron"])

FIELD_RANGES = {
    "minute": (0, 59),
    "hour": (0, 23),
    "day": (1, 31),
    "month": (1, 12),
    "weekday": (0, 6),
}

FIELD_LABELS = {
    "minute": "minute",
    "hour": "hour",
    "day": "day of month",
    "month": "month",
    "weekday": "weekday",
}


def validate_field(name: str, value: str) -> str | None:
    """Returns an error message if invalid, None if valid."""
    if value == "*":
        return None
    try:
        int_val = int(value)
    except ValueError:
        low, high = FIELD_RANGES[name]
        return f"Invalid {name} value '{value}': must be '*' or an integer in range {low}-{high}"

    low, high = FIELD_RANGES[name]
    if not (low <= int_val <= high):
        return f"Invalid {name} value '{value}': must be '*' or an integer in range {low}-{high}"

    return None


def describe_field(name: str, value: str) -> str:
    label = FIELD_LABELS[name]
    if value == "*":
        return f"every {label}"
    return f"at {label} {value}"


@router.post("/build")
async def build_cron(request: CronRequest):
    fields = {
        "minute": request.minute,
        "hour": request.hour,
        "day": request.day,
        "month": request.month,
        "weekday": request.weekday,
    }

    # Validate all fields
    for name, value in fields.items():
        error = validate_field(name, value)
        if error:
            return JSONResponse(
                status_code=422,
                content={
                    "status": "error",
                    "data": {"message": error},
                },
            )

    expression = f"{request.minute} {request.hour} {request.day} {request.month} {request.weekday}"

    parts = [describe_field(name, value) for name, value in fields.items()]
    description = ", ".join(parts).capitalize()

    return {
        "status": "success",
        "data": {
            "expression": expression,
            "description": description,
        },
    }
