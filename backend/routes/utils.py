import base64
import binascii
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models import Base64Request

router = APIRouter(prefix="/utils", tags=["utils"])

SUPPORTED_MODES = {"encode", "decode"}


@router.post("/base64")
async def base64_tool(request: Base64Request):
    mode = request.mode.lower().strip()

    if mode not in SUPPORTED_MODES:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {
                    "message": f"Unsupported mode '{request.mode}'. Supported modes: encode, decode"
                },
            },
        )

    if mode == "encode":
        result = base64.b64encode(request.text.encode("utf-8")).decode("utf-8")
        return {
            "status": "success",
            "data": {"result": result},
        }

    # decode mode
    try:
        result = base64.b64decode(request.text, validate=True).decode("utf-8")
        return {
            "status": "success",
            "data": {"result": result},
        }
    except (binascii.Error, UnicodeDecodeError) as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Invalid Base64 input: {str(e)}"},
            },
        )
