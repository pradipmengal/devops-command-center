"""
Sharing API Routes - Task 18.1
Shareable links for comparison state.
"""

import uuid
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Dict, Optional

router = APIRouter(prefix="/share", tags=["sharing"])

# In-memory store (replace with DB in production)
_shares: Dict[str, Dict[str, Any]] = {}
SHARE_TTL_DAYS = 30


class ShareRequest(BaseModel):
    state: Dict[str, Any]  # Comparison/filter state to share
    title: Optional[str] = "Multi-Cloud Comparison"


@router.post("/create")
async def create_share(request: ShareRequest):
    """Create a shareable link for the current comparison state."""
    share_id = uuid.uuid4().hex[:12]
    expires_at = datetime.now(timezone.utc) + timedelta(days=SHARE_TTL_DAYS)

    _shares[share_id] = {
        "id": share_id,
        "title": request.title,
        "state": request.state,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat()
    }

    return {
        "status": "success",
        "data": {
            "share_id": share_id,
            "share_url": f"/shared/{share_id}",
            "expires_at": expires_at.isoformat()
        }
    }


@router.get("/{share_id}")
async def get_share(share_id: str):
    """Retrieve shared comparison state by ID."""
    share = _shares.get(share_id)

    if not share:
        raise HTTPException(status_code=404, detail="Share not found or expired")

    # Check expiry
    expires_at = datetime.fromisoformat(share["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        del _shares[share_id]
        raise HTTPException(status_code=410, detail="Share link has expired")

    return {"status": "success", "data": share}
