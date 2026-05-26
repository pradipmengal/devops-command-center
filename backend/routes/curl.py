import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional

router = APIRouter(prefix="/curl", tags=["curl"])


class CurlRequest(BaseModel):
    method: str
    url: str
    headers: Optional[Dict[str, str]] = {}
    body: Optional[str] = None
    auth_type: Optional[str] = None   # "basic", "bearer", "none"
    auth_value: Optional[str] = None
    follow_redirects: Optional[bool] = True
    verbose: Optional[bool] = False
    insecure: Optional[bool] = False


@router.post("/build")
async def build_curl(request: CurlRequest):
    method = request.method.upper().strip()
    url = request.url.strip()

    if not url:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "URL cannot be empty"}},
        )

    valid_methods = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
    if method not in valid_methods:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Invalid method '{method}'. Supported: {', '.join(sorted(valid_methods))}"}
            },
        )

    parts = ["curl"]

    # Flags
    if request.verbose:
        parts.append("-v")
    if request.insecure:
        parts.append("-k")
    if request.follow_redirects:
        parts.append("-L")

    # Method (omit -X GET since it's default)
    if method != "GET":
        parts.append(f"-X {method}")

    # Auth
    if request.auth_type == "bearer" and request.auth_value:
        parts.append(f'-H "Authorization: Bearer {request.auth_value}"')
    elif request.auth_type == "basic" and request.auth_value:
        parts.append(f'-u "{request.auth_value}"')

    # Headers
    for key, value in (request.headers or {}).items():
        parts.append(f'-H "{key}: {value}"')

    # Body
    if request.body:
        # Escape double quotes in body
        escaped = request.body.replace('"', '\\"')
        parts.append(f'-d "{escaped}"')

        # Auto-add Content-Type if not already set
        header_keys_lower = {k.lower() for k in (request.headers or {}).keys()}
        if "content-type" not in header_keys_lower:
            # Try to detect JSON
            try:
                json.loads(request.body)
                parts.insert(-1, '-H "Content-Type: application/json"')
            except (json.JSONDecodeError, ValueError):
                parts.insert(-1, '-H "Content-Type: application/x-www-form-urlencoded"')

    # URL (always last)
    parts.append(f'"{url}"')

    command = " \\\n  ".join(parts)

    return {
        "status": "success",
        "data": {
            "command": command,
            "method": method,
            "url": url,
        },
    }
