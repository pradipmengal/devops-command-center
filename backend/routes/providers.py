"""
Provider API Routes
===================
Exposes endpoints for dynamic provider selection, service discovery,
and multi-cloud service comparison.

Requirements:
    - Requirement 2.1: Dynamic provider selection
    - Requirement 3.1: Real-time service discovery
    - Requirement 6.1: Service search and filtering
    - Requirement 7.1: Multi-cloud comparison
"""

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel

from services.pricing_orchestrator import PricingOrchestrator
from providers.registry import ProviderRegistry


router = APIRouter(prefix="", tags=["providers"])

# Initialize orchestrator (singleton pattern)
_orchestrator = None


def get_orchestrator() -> PricingOrchestrator:
    """Get or create the PricingOrchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        # Initialize provider registry with auto-discovery
        registry = ProviderRegistry.get_instance()
        registry.auto_discover_providers()
        
        # Create orchestrator
        _orchestrator = PricingOrchestrator(registry=registry)
    
    return _orchestrator


# ── Request/Response Models ───────────────────────────────────────────────────

class CompareServicesRequest(BaseModel):
    """Request model for service comparison."""
    service_ids: List[str]
    providers: Optional[List[str]] = None


# ── Provider Endpoints ────────────────────────────────────────────────────────

@router.get("/providers")
async def get_providers():
    """
    Get list of available providers with metadata.
    
    Returns:
        List of provider metadata including:
        - provider_id: Unique identifier
        - provider_name: Human-readable name
        - enabled: Whether provider is enabled
        - api_version: API version
        - rate_limit: Requests per minute limit
    
    Requirements:
        - Requirement 2.1: Dynamic provider selection
        - Requirement 2.2: Provider metadata retrieval
    
    Example:
        GET /api/providers
        
        Response:
        {
            "status": "success",
            "data": {
                "providers": [
                    {
                        "provider_id": "aws",
                        "provider_name": "Amazon Web Services",
                        "enabled": true,
                        "api_version": "1.0",
                        "rate_limit": 10
                    },
                    ...
                ]
            }
        }
    """
    try:
        orchestrator = get_orchestrator()
        providers = orchestrator.get_available_providers()
        
        return {
            "status": "success",
            "data": {
                "providers": providers,
                "count": len(providers)
            }
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to fetch providers: {str(e)}"
            }
        )


@router.get("/providers/{provider_id}/regions")
async def get_provider_regions(provider_id: str):
    """
    Get available regions for a specific provider.

    Args:
        provider_id: Provider identifier (e.g., 'aws', 'azure', 'gcp')

    Returns:
        List of regions with region_id, region_name, and location

    Example:
        GET /api/providers/aws/regions

        Response:
        {
            "status": "success",
            "data": {
                "provider_id": "aws",
                "regions": [
                    {
                        "region_id": "us-east-1",
                        "region_name": "US East (N. Virginia)",
                        "location": "North America"
                    }
                ]
            }
        }
    """
    try:
        orchestrator = get_orchestrator()
        registry = ProviderRegistry.get_instance()
        provider = registry.get_provider(provider_id)

        if provider is None:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"Provider '{provider_id}' not found"
                }
            )

        regions = await provider.get_regions()

        return {
            "status": "success",
            "data": {
                "provider_id": provider_id,
                "regions": regions,
                "count": len(regions)
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to fetch regions for provider '{provider_id}': {str(e)}"
            }
        )


@router.get("/providers/{provider_id}/services")
async def get_provider_services(
    provider_id: str,
    region: Optional[str] = Query(None, description="Filter by region"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=500, description="Items per page")
):
    """
    Fetch service catalog for a specific provider.
    
    Args:
        provider_id: Provider identifier (e.g., 'aws', 'azure', 'gcp')
        region: Optional region filter
        category: Optional category filter
        search: Optional search term for service name
        page: Page number (default: 1)
        page_size: Items per page (default: 100, max: 500)
    
    Returns:
        Paginated list of services from the specified provider
    
    Requirements:
        - Requirement 3.1: Real-time service discovery
        - Requirement 3.2: Service catalog fetching
        - Requirement 6.1: Service filtering
    
    Example:
        GET /api/providers/aws/services?region=us-east-1&category=Compute&page=1
        
        Response:
        {
            "status": "success",
            "data": {
                "provider_id": "aws",
                "services": [...],
                "pagination": {
                    "page": 1,
                    "page_size": 100,
                    "total_items": 247,
                    "total_pages": 3
                },
                "cached": true
            }
        }
    """
    try:
        orchestrator = get_orchestrator()
        
        # Build filter parameters
        regions = [region] if region else None
        categories = [category] if category else None
        
        # Fetch services
        services = await orchestrator.fetch_services(
            provider_ids=[provider_id],
            regions=regions,
            categories=categories,
            force_refresh=False
        )
        
        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            services = [
                s for s in services
                if search_lower in s.service_name.lower() or
                   search_lower in s.category.lower()
            ]
        
        # Calculate pagination
        total_items = len(services)
        total_pages = (total_items + page_size - 1) // page_size
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        # Get page of services
        page_services = services[start_idx:end_idx]
        
        # Convert ServiceEntry objects to dictionaries
        services_data = [
            {
                'provider': s.provider,
                'category': s.category,
                'service_name': s.service_name,
                'unit': s.unit,
                'price_usd': s.price_usd,
                'tier_label': s.tier_label,
                'region': s.region,
                'vcpu': s.vcpu,
                'memory_gb': s.memory_gb,
                'storage_gb': s.storage_gb,
                'metadata': s.metadata,
                'fetched_at': s.fetched_at.isoformat() if s.fetched_at else None,
                'is_fallback': s.is_fallback,
                'price_status': 'live' if s.is_fallback is False else 'fallback'
            }
            for s in page_services
        ]
        
        return {
            "status": "success",
            "data": {
                "provider_id": provider_id,
                "services": services_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_items": total_items,
                    "total_pages": total_pages
                },
                "filters": {
                    "region": region,
                    "category": category,
                    "search": search
                }
            }
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to fetch services for provider '{provider_id}': {str(e)}"
            }
        )


@router.get("/services/search")
async def search_services(
    providers: Optional[str] = Query(None, description="Comma-separated provider IDs"),
    regions: Optional[str] = Query(None, description="Comma-separated regions"),
    categories: Optional[str] = Query(None, description="Comma-separated categories"),
    search: Optional[str] = Query(None, description="Search term"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=500, description="Items per page")
):
    """
    Search across all enabled providers with filtering.
    
    Args:
        providers: Comma-separated provider IDs (e.g., 'aws,azure,gcp')
        regions: Comma-separated regions
        categories: Comma-separated categories
        search: Search term for service name/category
        min_price: Minimum price filter
        max_price: Maximum price filter
        page: Page number
        page_size: Items per page
    
    Returns:
        Paginated search results across all specified providers
    
    Requirements:
        - Requirement 6.1: Multi-provider service search
        - Requirement 6.2: Advanced filtering
        - Requirement 6.3: Relevance ranking
    
    Example:
        GET /api/services/search?providers=aws,azure&categories=Compute&search=vm&min_price=0.01&max_price=1.0
        
        Response:
        {
            "status": "success",
            "data": {
                "services": [...],
                "pagination": {...},
                "filters": {...}
            }
        }
    """
    try:
        orchestrator = get_orchestrator()
        
        # Parse comma-separated parameters
        provider_list = providers.split(',') if providers else None
        region_list = regions.split(',') if regions else None
        category_list = categories.split(',') if categories else None
        
        # Fetch services
        services = await orchestrator.fetch_services(
            provider_ids=provider_list,
            regions=region_list,
            categories=category_list,
            force_refresh=False
        )
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            services = [
                s for s in services
                if search_lower in s.service_name.lower() or
                   search_lower in s.category.lower() or
                   search_lower in s.provider.lower()
            ]
        
        # Apply price filters
        if min_price is not None:
            services = [s for s in services if s.price_usd >= min_price]
        
        if max_price is not None:
            services = [s for s in services if s.price_usd <= max_price]
        
        # Sort by relevance (if search term provided) or by price
        if search:
            # Simple relevance: prioritize exact matches in service name
            search_lower = search.lower()
            services.sort(
                key=lambda s: (
                    0 if search_lower == s.service_name.lower() else
                    1 if search_lower in s.service_name.lower() else
                    2 if search_lower in s.category.lower() else
                    3
                )
            )
        else:
            # Sort by price (ascending)
            services.sort(key=lambda s: s.price_usd)
        
        # Calculate pagination
        total_items = len(services)
        total_pages = (total_items + page_size - 1) // page_size
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        # Get page of services
        page_services = services[start_idx:end_idx]
        
        # Convert to dictionaries
        services_data = [
            {
                'provider': s.provider,
                'category': s.category,
                'service_name': s.service_name,
                'unit': s.unit,
                'price_usd': s.price_usd,
                'tier_label': s.tier_label,
                'region': s.region,
                'vcpu': s.vcpu,
                'memory_gb': s.memory_gb,
                'storage_gb': s.storage_gb,
                'metadata': s.metadata,
                'is_fallback': s.is_fallback,
                'price_status': 'live' if s.is_fallback is False else 'fallback',
                'fetched_at': s.fetched_at.isoformat() if s.fetched_at else None
            }
            for s in page_services
        ]
        
        return {
            "status": "success",
            "data": {
                "services": services_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_items": total_items,
                    "total_pages": total_pages
                },
                "filters": {
                    "providers": provider_list,
                    "regions": region_list,
                    "categories": category_list,
                    "search": search,
                    "min_price": min_price,
                    "max_price": max_price
                }
            }
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to search services: {str(e)}"
            }
        )


@router.post("/services/compare")
async def compare_services(request: CompareServicesRequest):
    """
    Compare services side-by-side across providers.
    
    Args:
        request: CompareServicesRequest containing:
            - service_ids: List of service identifiers to compare
            - providers: Optional list of provider IDs to include
    
    Returns:
        Side-by-side comparison with price differences highlighted
    
    Requirements:
        - Requirement 7.1: Multi-cloud service comparison
        - Requirement 7.2: Price difference calculation
        - Requirement 7.3: Cheapest option highlighting
    
    Example:
        POST /api/services/compare
        {
            "service_ids": ["aws:ec2:t3.medium", "azure:vm:b2s", "gcp:compute:e2-medium"],
            "providers": ["aws", "azure", "gcp"]
        }
        
        Response:
        {
            "status": "success",
            "data": {
                "comparison": [...],
                "cheapest": {...},
                "price_differences": {...}
            }
        }
    """
    try:
        orchestrator = get_orchestrator()
        
        # Fetch services from specified providers
        services = await orchestrator.fetch_services(
            provider_ids=request.providers,
            force_refresh=False
        )
        
        # Filter to requested service IDs
        # Note: This is a simplified implementation
        # In production, you'd need a proper service ID format and lookup
        
        # Group services by category for comparison
        services_by_category = {}
        for service in services:
            category = service.category
            if category not in services_by_category:
                services_by_category[category] = []
            services_by_category[category].append(service)
        
        # Build comparison data
        comparison_data = []
        for category, category_services in services_by_category.items():
            if not category_services:
                continue
            
            # Find cheapest service in this category
            cheapest = min(category_services, key=lambda s: s.price_usd)
            
            # Calculate price differences
            services_with_diff = []
            for service in category_services:
                price_diff = service.price_usd - cheapest.price_usd
                price_diff_pct = (price_diff / cheapest.price_usd * 100) if cheapest.price_usd > 0 else 0
                
                services_with_diff.append({
                    'provider': service.provider,
                    'service_name': service.service_name,
                    'price_usd': service.price_usd,
                    'unit': service.unit,
                    'tier_label': service.tier_label,
                    'is_cheapest': service.provider == cheapest.provider and service.service_name == cheapest.service_name,
                    'price_difference': round(price_diff, 4),
                    'price_difference_pct': round(price_diff_pct, 2)
                })
            
            comparison_data.append({
                'category': category,
                'services': services_with_diff,
                'cheapest_provider': cheapest.provider,
                'cheapest_price': cheapest.price_usd
            })
        
        return {
            "status": "success",
            "data": {
                "comparison": comparison_data,
                "total_categories": len(comparison_data)
            }
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to compare services: {str(e)}"
            }
        )


# ── Cache and Health Endpoints ────────────────────────────────────────────────

@router.post("/services/refresh")
async def refresh_services(
    providers: Optional[str] = Query(None, description="Comma-separated provider IDs to refresh")
):
    """
    Force refresh of service catalog (invalidate cache).
    
    Args:
        providers: Optional comma-separated provider IDs. If None, refreshes all.
    
    Returns:
        Confirmation of cache invalidation
    
    Requirements:
        - Requirement 4.3: Cache invalidation on manual refresh
    
    Example:
        POST /api/services/refresh?providers=aws,azure
    """
    try:
        orchestrator = get_orchestrator()
        
        # Invalidate cache
        if providers:
            provider_list = providers.split(',')
            count = 0
            for provider_id in provider_list:
                count += orchestrator.invalidate_cache(f"{provider_id}:*")
        else:
            count = orchestrator.invalidate_cache('*')
        
        return {
            "status": "success",
            "data": {
                "message": "Cache invalidated successfully",
                "entries_invalidated": count
            }
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to refresh services: {str(e)}"
            }
        )


@router.get("/health")
async def health_check():
    """
    Health check endpoint for the API.
    
    Returns:
        API health status
    """
    try:
        orchestrator = get_orchestrator()
        cache_stats = orchestrator.get_cache_stats()
        
        return {
            "status": "healthy",
            "data": {
                "api_version": "1.0",
                "cache_stats": cache_stats
            }
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "message": str(e)
            }
        )


@router.get("/health/providers")
async def provider_health_check(
    providers: Optional[str] = Query(None, description="Comma-separated provider IDs to check")
):
    """
    Check health status of provider APIs.
    
    Args:
        providers: Optional comma-separated provider IDs. If None, checks all enabled providers.
    
    Returns:
        Health status for each provider
    
    Example:
        GET /api/health/providers?providers=aws,azure,gcp
        
        Response:
        {
            "status": "success",
            "data": {
                "aws": {
                    "status": "healthy",
                    "response_time_ms": 245.3,
                    "error": null
                },
                ...
            }
        }
    """
    try:
        orchestrator = get_orchestrator()
        
        provider_list = providers.split(',') if providers else None
        
        health_status = await orchestrator.get_provider_health(provider_list)
        
        return {
            "status": "success",
            "data": health_status
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to check provider health: {str(e)}"
            }
        )


@router.get("/stats/cache")
async def get_cache_stats():
    """
    Get cache statistics.
    
    Returns:
        Cache performance statistics
    """
    try:
        orchestrator = get_orchestrator()
        stats = orchestrator.get_cache_stats()
        
        return {
            "status": "success",
            "data": stats
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to get cache stats: {str(e)}"
            }
        )


@router.get("/stats/rate-limit")
async def get_rate_limit_stats(
    provider: Optional[str] = Query(None, description="Provider ID to get stats for")
):
    """
    Get rate limiting statistics.
    
    Args:
        provider: Optional provider ID. If None, returns stats for all providers.
    
    Returns:
        Rate limiting statistics
    """
    try:
        orchestrator = get_orchestrator()
        stats = orchestrator.get_rate_limit_stats(provider)
        
        return {
            "status": "success",
            "data": stats
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to get rate limit stats: {str(e)}"
            }
        )
