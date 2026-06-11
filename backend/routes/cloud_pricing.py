"""
Cloud Pricing API Routes
========================
Exposes live cloud pricing data fetched and cached by cloud_pricing_sync.py.
"""

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from services.cloud_pricing_sync import (
    get_cached_prices,
    get_live_prices,
    get_last_sync_info,
    invalidate_cache,
    _get_static_fallback,
    search_prices,
)
from services.granular_pricing_sync import (
    get_cached_catalog,
    get_live_catalog,
    invalidate_catalog_cache,
    _get_granular_static_fallback,
)
from services.regional_pricing_sync import (
    get_cached_regional_prices,
    get_all_regional_prices,
    get_regional_prices,
    invalidate_regional_cache,
)

router = APIRouter(prefix="/cloud-pricing", tags=["cloud-pricing"])


@router.get("/prices")
async def get_prices():
    """
    Return live (or cached) cloud pricing data.
    Falls back to static data if all live fetches fail.
    """
    try:
        result = await get_cached_prices()
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        # Last-resort fallback — always return something
        fallback = _get_static_fallback()
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {
                    "message": str(e),
                    "entries": fallback,
                    "synced_at": None,
                    "source": "fallback",
                },
            },
        )


@router.post("/sync")
async def sync_prices():
    """
    Force-invalidate the cache and fetch fresh pricing from all providers.
    Returns the refreshed dataset.
    """
    try:
        invalidate_cache()
        entries = await get_live_prices()
        info = get_last_sync_info()
        return {
            "status": "success",
            "data": {
                "entries": entries,
                "synced_at": info["synced_at"],
                "source": info["source"],
                "entry_count": info["entry_count"],
            },
        }
    except Exception as e:
        fallback = _get_static_fallback()
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {
                    "message": str(e),
                    "entries": fallback,
                    "synced_at": None,
                    "source": "fallback",
                },
            },
        )


@router.get("/status")
async def get_sync_status():
    """Return metadata about the current cache state."""
    return {
        "status": "success",
        "data": get_last_sync_info(),
    }


# ── Open service search ───────────────────────────────────────────────────────

@router.get("/search")
async def search_cloud_services(q: str = "", providers: str = "aws,azure,gcp,tata_cloud,jio_cloud,yotta,nxtgen"):
    """
    Search for any cloud service by name across providers.
    Returns matching ServiceEntry records from the requested providers.

    Query params:
      q         — search term (minimum 2 characters)
      providers — comma-separated list: aws, azure, gcp (default: all three)
    """
    if len(q.strip()) < 2:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": "Query must be at least 2 characters"},
            },
        )

    providers_list = [p.strip().lower() for p in providers.split(",") if p.strip()]

    try:
        result = await search_prices(q.strip(), providers_list)
        return {
            "status": "success",
            "data": {
                "entries": result["entries"],
                "partial": result["partial"],
                "cached": result["cached"],
                "query": q.strip(),
            },
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {
                    "message": str(e),
                    "entries": [],
                    "partial": True,
                    "cached": False,
                    "query": q.strip(),
                },
            },
        )


# ── Granular catalog endpoints ────────────────────────────────────────────────

@router.get("/catalog")
async def get_catalog():
    """
    Return the full granular InstanceEntry catalog for all providers and categories.
    Cached for 6 hours. Falls back to static data per-provider on fetch failure.
    """
    try:
        result = await get_cached_catalog()
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        fallback = _get_granular_static_fallback()
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {
                    "message": str(e),
                    "entries": fallback,
                    "synced_at": None,
                    "source": "fallback",
                },
            },
        )


@router.get("/catalog/{category:path}")
async def get_catalog_by_category(category: str):
    """
    Return all InstanceEntry records for a specific service category.
    Returns HTTP 404 if the category is not found in the catalog.
    """
    try:
        result = await get_cached_catalog()
        all_entries = result.get("entries", [])

        # Get all known categories
        known_categories = list({e["category"] for e in all_entries})

        # Filter by requested category
        filtered = [e for e in all_entries if e["category"] == category]

        if not filtered and category not in known_categories:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"Category '{category}' not found. Valid categories: {sorted(known_categories)}",
                },
            )

        return {
            "status": "success",
            "data": {
                "category": category,
                "entries": filtered,
                "synced_at": result.get("synced_at"),
                "source": result.get("source"),
            },
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
        )


# ── Regional pricing endpoints ────────────────────────────────────────────────


@router.get("/regional")
async def get_regional_pricing(
    providers: str = Query("aws,azure,gcp,tata_cloud,jio_cloud,yotta,nxtgen", description="Comma-separated provider IDs"),
    regions: str = Query("", description="Comma-separated region IDs (empty = all regions)"),
):
    """
    Get live per-region pricing for one or more cloud providers.
    Each price entry includes a `price_status` field:
      - "live"     -> fetched from provider API
      - "cached"   -> from in-memory cache
      - "fallback" -> estimated via region multiplier

    Returns:
      { provider: { prices: { region: { category: { service_name, price_usd, unit, tier_label, price_status } } }, overall_status } }
    """
    provider_list = [p.strip().lower() for p in providers.split(",") if p.strip()]

    region_list = [r.strip() for r in regions.split(",") if r.strip()] or None

    try:
        result = await get_cached_regional_prices(providers=provider_list, regions=region_list)
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "message": str(e),
                "data": {},
            },
        )


@router.get("/regional/{provider_id}")
async def get_provider_regional_pricing(
    provider_id: str,
    regions: str = Query("", description="Comma-separated region IDs (empty = all regions)"),
):
    """
    Get live per-region pricing for a single provider.
    """
    region_list = [r.strip() for r in regions.split(",") if r.strip()] or None

    try:
        result = await get_regional_prices(provider=provider_id, regions=region_list)
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "message": str(e),
                "data": {"prices": {}, "overall_status": "fallback"},
            },
        )


@router.post("/regional/refresh")
async def refresh_regional_prices(
    providers: str = Query("aws,azure,gcp,tata_cloud,jio_cloud,yotta,nxtgen", description="Comma-separated provider IDs"),
):
    """
    Force-invalidate the regional cache and fetch fresh pricing from all providers.
    """
    provider_list = [p.strip().lower() for p in providers.split(",") if p.strip()]

    try:
        invalidate_regional_cache()
        result = await get_all_regional_prices(providers=provider_list)
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "message": str(e),
                "data": {},
            },
        )


@router.get("/regional/status")
async def get_regional_pricing_status():
    """
    Return the overall status of regional pricing data.
    """
    from services.regional_pricing_sync import _regional_cache
    return {
        "status": "success",
        "data": {
            "source": _regional_cache.source,
            "fetched_at": _regional_cache.fetched_at.isoformat() if _regional_cache.fetched_at else None,
            "entry_count": len(_regional_cache.entries),
        },
    }


# ── Infracost health check ───────────────────────────────────────────────────


@router.get("/infracost/health")
async def infracost_health_check():
    """
    Check if the Infracost API is reachable and configured.
    Returns the health status of the Infracost integration.
    """
    from services.infracost_client import InfracostClient
    from services.settings import get_infracost_api_key

    api_key = get_infracost_api_key()
    if not api_key:
        return {
            "status": "success",
            "data": {
                "configured": False,
                "healthy": False,
                "message": "INFRACOST_API_KEY not set. Get a free key at https://infracost.io",
            },
        }

    client = InfracostClient(api_key=api_key)
    try:
        result = await client.health_check()
        return {
            "status": "success",
            "data": {
                "configured": True,
                "healthy": result["status"] == "healthy",
                "message": result.get("message", ""),
            },
        }
    except Exception as e:
        return {
            "status": "success",
            "data": {
                "configured": True,
                "healthy": False,
                "message": str(e),
            },
        }
    finally:
        await client.close()


@router.post("/infracost/test")
async def infracost_test_key(payload: dict = Body(...)):
    """
    Test a user-provided Infracost API key without saving it to environment.
    The key is sent in the request body and tested against the Infracost API.
    """
    from services.infracost_client import InfracostClient

    api_key = (payload or {}).get("api_key", "").strip()
    if not api_key:
        return {
            "status": "success",
            "data": {
                "valid": False,
                "message": "No API key provided",
            },
        }

    client = InfracostClient(api_key=api_key)
    try:
        result = await client.health_check()
        healthy = result["status"] == "healthy"
        return {
            "status": "success",
            "data": {
                "valid": healthy,
                "message": "Connection successful! Live pricing enabled." if healthy
                          else "API reached but returned no prices (key may be invalid or rate-limited).",
            },
        }
    except Exception as e:
        return {
            "status": "success",
            "data": {
                "valid": False,
                "message": f"Connection failed: {str(e)}",
            },
        }
    finally:
        await client.close()


@router.post("/catalog/refresh")
async def refresh_catalog():
    """
    Force-invalidate the granular catalog cache and fetch fresh data from all providers.
    """
    try:
        invalidate_catalog_cache()
        entries = await get_live_catalog()
        from services.granular_pricing_sync import _catalog_cache
        return {
            "status": "success",
            "data": {
                "entries": entries,
                "synced_at": _catalog_cache.fetched_at.isoformat() if _catalog_cache.fetched_at else None,
                "source": _catalog_cache.source,
                "entry_count": len(entries),
            },
        }
    except Exception as e:
        fallback = _get_granular_static_fallback()
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {
                    "message": str(e),
                    "entries": fallback,
                    "synced_at": None,
                    "source": "fallback",
                },
            },
        )
