import re
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/regex", tags=["regex"])


class RegexRequest(BaseModel):
    pattern: str
    test_string: str
    flags: Optional[List[str]] = []  # "i", "m", "s"


@router.post("/test")
async def test_regex(request: RegexRequest):
    if not request.pattern:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "Pattern cannot be empty"}},
        )

    # Build flags
    flag_value = 0
    flag_names = []
    for f in (request.flags or []):
        f = f.lower()
        if f == "i":
            flag_value |= re.IGNORECASE
            flag_names.append("IGNORECASE")
        elif f == "m":
            flag_value |= re.MULTILINE
            flag_names.append("MULTILINE")
        elif f == "s":
            flag_value |= re.DOTALL
            flag_names.append("DOTALL")

    try:
        compiled = re.compile(request.pattern, flag_value)
    except re.error as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Invalid regex pattern: {str(e)}"}
            },
        )

    matches = []
    for m in compiled.finditer(request.test_string):
        match_info = {
            "match": m.group(0),
            "start": m.start(),
            "end": m.end(),
            "groups": list(m.groups()),
            "named_groups": m.groupdict(),
        }
        matches.append(match_info)

    is_match = bool(compiled.search(request.test_string))

    return {
        "status": "success",
        "data": {
            "is_match": is_match,
            "match_count": len(matches),
            "matches": matches,
            "flags_applied": flag_names,
        },
    }
