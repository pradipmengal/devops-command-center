import hashlib
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/hash", tags=["hash"])

SUPPORTED_ALGORITHMS = {"md5", "sha1", "sha256", "sha512", "sha224", "sha384"}


class HashRequest(BaseModel):
    text: str
    algorithm: str


@router.post("/generate")
async def generate_hash(request: HashRequest):
    algo = request.algorithm.lower().strip()

    if algo not in SUPPORTED_ALGORITHMS:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {
                    "message": f"Unsupported algorithm '{request.algorithm}'. "
                               f"Supported: {', '.join(sorted(SUPPORTED_ALGORITHMS))}"
                },
            },
        )

    if not request.text:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "Input text cannot be empty"}},
        )

    h = hashlib.new(algo, request.text.encode("utf-8"))
    return {
        "status": "success",
        "data": {
            "hash": h.hexdigest(),
            "algorithm": algo,
            "input_length": len(request.text),
        },
    }
