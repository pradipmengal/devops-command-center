import uuid
import re
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/uuid", tags=["uuid"])


class UUIDRequest(BaseModel):
    version: int = 4       # 1 or 4
    count: int = 1         # 1–20
    namespace: Optional[str] = None   # for v5
    name: Optional[str] = None        # for v5


class UUIDValidateRequest(BaseModel):
    value: str


@router.post("/generate")
async def generate_uuid(request: UUIDRequest):
    if request.version not in {1, 4, 5}:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "version must be 1, 4, or 5"}},
        )

    count = max(1, min(request.count, 20))

    results = []
    for _ in range(count):
        if request.version == 1:
            results.append(str(uuid.uuid1()))
        elif request.version == 4:
            results.append(str(uuid.uuid4()))
        elif request.version == 5:
            ns = uuid.NAMESPACE_DNS
            name = request.name or "example.com"
            results.append(str(uuid.uuid5(ns, name)))

    return {
        "status": "success",
        "data": {
            "uuids": results,
            "version": request.version,
            "count": count,
        },
    }


@router.post("/validate")
async def validate_uuid(request: UUIDValidateRequest):
    pattern = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        re.IGNORECASE,
    )
    is_valid = bool(pattern.match(request.value.strip()))

    version = None
    if is_valid:
        version = int(request.value[14])

    return {
        "status": "success",
        "data": {
            "is_valid": is_valid,
            "version": version,
            "value": request.value.strip(),
        },
    }
