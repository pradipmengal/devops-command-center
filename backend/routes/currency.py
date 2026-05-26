"""Currency API Routes - Task 16.1 backend endpoint"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.currency_converter import get_converter

router = APIRouter(prefix="/currency", tags=["currency"])


@router.get("/rates")
async def get_rates():
    """Get current exchange rates (USD base)."""
    try:
        converter = get_converter()
        return {"status": "success", "data": converter.get_rates()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@router.post("/refresh")
async def refresh_rates():
    """Force refresh exchange rates from external API."""
    try:
        converter = get_converter()
        success = await converter.refresh_rates()
        return {"status": "success", "data": {"refreshed": success, **converter.get_rates()}}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@router.get("/convert")
async def convert_price(amount: float, from_currency: str = "USD", to_currency: str = "EUR"):
    """Convert a price between currencies."""
    try:
        converter = get_converter()
        converted = converter.convert(amount, from_currency, to_currency)
        return {
            "status": "success",
            "data": {
                "original": amount,
                "from_currency": from_currency.upper(),
                "to_currency": to_currency.upper(),
                "converted": round(converted, 6)
            }
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
