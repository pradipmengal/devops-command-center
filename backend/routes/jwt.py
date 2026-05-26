import base64
import json
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/jwt", tags=["jwt"])


class JWTRequest(BaseModel):
    token: str


@router.post("/decode")
async def decode_jwt(request: JWTRequest):
    try:
        parts = request.token.strip().split(".")
        if len(parts) != 3:
            return JSONResponse(
                status_code=422,
                content={
                    "status": "error",
                    "data": {"message": "Invalid JWT format: must have 3 parts separated by dots"}
                },
            )

        header_b64, payload_b64, signature = parts

        # Decode header
        header_json = base64.urlsafe_b64decode(header_b64 + "==").decode("utf-8")
        header = json.loads(header_json)

        # Decode payload
        payload_json = base64.urlsafe_b64decode(payload_b64 + "==").decode("utf-8")
        payload = json.loads(payload_json)

        # Check expiry
        exp = payload.get("exp")
        is_expired = None
        expires_in = None
        if exp:
            exp_dt = datetime.fromtimestamp(exp)
            now = datetime.now()
            is_expired = now > exp_dt
            expires_in = int((exp_dt - now).total_seconds()) if not is_expired else None

        return {
            "status": "success",
            "data": {
                "header": header,
                "payload": payload,
                "signature": signature,
                "is_expired": is_expired,
                "expires_in_seconds": expires_in,
            },
        }
    except Exception as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Failed to decode JWT: {str(e)}"}
            },
        )
