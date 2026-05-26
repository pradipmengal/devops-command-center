"""
Pricing Orchestrator - Coordinates pricing data retrieval across multiple providers.

This module implements the PricingOrchestrator service that manages parallel fetching
of pricing data from multiple cloud providers, handles errors gracefully, and provides
health monitoring capabilities.

Requirements:
    - Requirement 5.1: Parallel provider fetching
    - Requirement 5.2: Error handling and fallback
    - Requirement 5.3: Health monitoring
    - Requirement 5.4: Data aggregation and deduplication
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timezone

import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from providers.base import ProviderPlugin
from providers.registry import ProviderRegistry
from models.service import ServiceEntry


logger = logging.getLogger(__name__)


class PricingOrchestratorError(Exception):
    """Base exception for PricingOrchestrator errors."""
    pass


class ProviderNotFoundError(PricingOrchestratorError):
    """Raised when a requested provider is not found in the registry."""
    pass


class PricingOrchestrator:
    """
    Orchestrates pricing data retrieval across multiple cloud providers.
    
    The PricingOrchestrator coordinates parallel fetching of service catalogs
    from multiple providers, handles errors gracefully, aggregates results,
    and provides health monitoring capabilities.
    
    Features:
        - Parallel provider fetching for optimal performance
        - Graceful error handling with partial results
        - Automatic deduplication of service entries
        - Provider health monitoring
        - Support for filtering by region and category
    
    Requirements:
        - Requirement 5.1: Parallel provider fetching
        - Requirement 5.2: Error handling and fallback
        - Requirement 5.3: Health monitoring
        - Requirement 5.4: Data aggregation and deduplication
    
    Usage:
        >>> registry = ProviderRegistry.get_instance()
        >>> orchestrator = PricingOrchestrator(registry=registry)
        >>> services = await orchestrator.fetch_services(provider_ids=["aws", "azure"])
        >>> health = await orchestrator.get_provider_health(provider_ids=["aws"])
    """
    
    def __init__(
        self,
        registry: Optional[ProviderRegistry] = None,
        cache_manager: Optional[Any] = None,
        rate_limiter: Optional[Any] = None
    ):
        """
        Initialize the PricingOrchestrator.
        
        Args:
            registry: ProviderRegistry instance (default: singleton instance)
            cache_manager: Optional CacheManager instance
            rate_limiter: Optional RateLimiter instance
        """
        self._registry = registry or ProviderRegistry.get_instance()
        self._cache_manager = cache_manager
        self._rate_limiter = rate_limiter
        logger.info("PricingOrchestrator initialized")
    
    async def fetch_services(
        self,
        provider_ids: Optional[List[str]] = None,
        regions: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        force_refresh: bool = False
    ) -> List[ServiceEntry]:
        """
        Fetch service catalogs from multiple providers in parallel.
        
        This method coordinates parallel fetching of service catalogs from
        the specified providers (or all enabled providers if none specified).
        It handles errors gracefully, returning partial results if some
        providers fail.
        
        Args:
            provider_ids: List of provider IDs to fetch from (default: all enabled)
            regions: Optional list of regions to filter by
            categories: Optional list of categories to filter by
            force_refresh: If True, bypass cache and fetch fresh data
        
        Returns:
            List of ServiceEntry objects aggregated from all providers
        
        Raises:
            ProviderNotFoundError: If a specified provider_id is not registered
        
        Requirements:
            - Requirement 5.1: Parallel provider fetching
            - Requirement 5.2: Error handling with partial results
            - Requirement 5.4: Data aggregation and deduplication
        
        Example:
            >>> services = await orchestrator.fetch_services(
            ...     provider_ids=["aws", "azure"],
            ...     regions=["us-east-1", "eastus"],
            ...     categories=["Compute (VMs)"]
            ... )
        """
        # Determine which providers to fetch from
        if provider_ids is None:
            # Fetch from all enabled providers
            providers = self._registry.get_enabled_providers()
            if not providers:
                logger.warning("No enabled providers found")
                return []
        else:
            # Validate and get specified providers
            providers = []
            for provider_id in provider_ids:
                provider = self._registry.get_provider(provider_id)
                if provider is None:
                    raise ProviderNotFoundError(
                        f"Provider '{provider_id}' not found in registry"
                    )
                providers.append(provider)
        
        logger.info(
            f"Fetching services from {len(providers)} provider(s): "
            f"{[p.provider_id for p in providers]}"
        )
        
        # Fetch from all providers in parallel
        tasks = [
            self._fetch_from_provider(
                provider=provider,
                regions=regions,
                categories=categories,
                force_refresh=force_refresh
            )
            for provider in providers
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Aggregate results and handle errors
        all_services: List[ServiceEntry] = []
        for provider, result in zip(providers, results):
            if isinstance(result, Exception):
                logger.error(
                    f"Failed to fetch services from provider '{provider.provider_id}': {result}"
                )
                # Continue with other providers (graceful degradation)
                continue
            
            if isinstance(result, list):
                all_services.extend(result)
        
        # Deduplicate services
        deduplicated_services = self._deduplicate_services(all_services)
        
        logger.info(
            f"Fetched {len(deduplicated_services)} unique services "
            f"(before deduplication: {len(all_services)})"
        )
        
        return deduplicated_services
    
    async def _fetch_from_provider(
        self,
        provider: ProviderPlugin,
        regions: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        force_refresh: bool = False
    ) -> List[ServiceEntry]:
        """
        Fetch service catalog from a single provider.
        
        This is an internal method that handles fetching from a single provider
        and converting the raw data to ServiceEntry objects.
        
        When multiple regions are specified, the provider is called separately
        for each region to ensure services are properly tagged per region.
        
        Args:
            provider: The provider plugin to fetch from
            regions: Optional list of regions to filter by
            categories: Optional list of categories to filter by
            force_refresh: If True, bypass cache
        
        Returns:
            List of ServiceEntry objects from this provider
        
        Raises:
            Exception: Any error from the provider's get_service_catalog method
        """
        logger.debug(f"Fetching from provider: {provider.provider_id}")
        
        # Filter regions to only those valid for this provider
        # Prevents cross-provider region conflicts (e.g., AWS "ap-south-1" being sent to GCP)
        valid_region_ids: Set[str] = set()
        try:
            provider_regions = await provider.get_regions()
            valid_region_ids = {r["region_id"] for r in provider_regions if "region_id" in r}
        except Exception as e:
            logger.warning(f"Could not fetch valid regions for '{provider.provider_id}': {e}")
        
        provider_regions = None
        if regions:
            provider_regions = [r for r in regions if r in valid_region_ids]
            if not provider_regions:
                logger.debug(
                    f"No valid regions for provider '{provider.provider_id}' "
                    f"(requested: {regions}, valid for this provider: none match)"
                )
                return []
        
        all_raw_services: List[Dict] = []
        
        # When multiple regions are specified, fetch per-region so services
        # get properly tagged with each requested region instead of default
        if provider_regions and len(provider_regions) > 1:
            for region in provider_regions:
                region_services = await provider.get_service_catalog(
                    region=region,
                    category=categories[0] if categories and len(categories) == 1 else None,
                    force_refresh=force_refresh
                )
                all_raw_services.extend(region_services)
        else:
            raw_services = await provider.get_service_catalog(
                region=provider_regions[0] if provider_regions else None,
                category=categories[0] if categories and len(categories) == 1 else None,
                force_refresh=force_refresh
            )
            all_raw_services = raw_services
        
        # Convert raw data to ServiceEntry objects
        service_entries: List[ServiceEntry] = []
        for raw_service in all_raw_services:
            try:
                # Apply additional filtering if multiple categories specified
                if categories and len(categories) > 1:
                    if raw_service.get('category') not in categories:
                        continue
                
                # Create ServiceEntry from raw data
                service_entry = ServiceEntry.from_dict(raw_service)
                service_entries.append(service_entry)
            
            except Exception as e:
                logger.warning(
                    f"Failed to parse service entry from provider '{provider.provider_id}': {e}"
                )
                # Skip invalid entries
                continue
        
        logger.debug(
            f"Fetched {len(service_entries)} services from provider '{provider.provider_id}'"
        )
        
        return service_entries
    
    def _deduplicate_services(
        self,
        services: List[ServiceEntry]
    ) -> List[ServiceEntry]:
        """
        Remove duplicate service entries based on unique key.
        
        Deduplication is based on a composite key of:
        (provider, category, service_name, region, tier_label)
        
        Args:
            services: List of ServiceEntry objects (may contain duplicates)
        
        Returns:
            List of unique ServiceEntry objects
        
        Requirements:
            - Requirement 5.4: Data deduplication
        """
        seen_keys: Set[tuple] = set()
        unique_services: List[ServiceEntry] = []
        
        for service in services:
            # Create unique key
            key = (
                service.provider,
                service.category,
                service.service_name,
                service.region or "",
                service.tier_label
            )
            
            if key not in seen_keys:
                seen_keys.add(key)
                unique_services.append(service)
            else:
                logger.debug(
                    f"Skipping duplicate service: {service.provider} - {service.service_name}"
                )
        
        return unique_services
    
    async def get_provider_health(
        self,
        provider_ids: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Check health status of providers by testing their APIs.
        
        This method performs health checks on the specified providers
        (or all enabled providers) by attempting to validate credentials
        and measuring response times.
        
        Args:
            provider_ids: List of provider IDs to check (default: all enabled)
        
        Returns:
            Dictionary mapping provider_id to health status:
            {
                "provider_id": {
                    "status": "healthy" | "unavailable",
                    "response_time_ms": float,
                    "error": str | None,
                    "checked_at": str (ISO timestamp)
                }
            }
        
        Requirements:
            - Requirement 5.3: Health monitoring
        
        Example:
            >>> health = await orchestrator.get_provider_health(provider_ids=["aws"])
            >>> print(health["aws"]["status"])
            healthy
        """
        # Determine which providers to check
        if provider_ids is None:
            providers = self._registry.get_enabled_providers()
        else:
            providers = []
            for provider_id in provider_ids:
                provider = self._registry.get_provider(provider_id)
                if provider:
                    providers.append(provider)
        
        logger.info(f"Checking health of {len(providers)} provider(s)")
        
        # Check all providers in parallel
        tasks = [
            self._check_provider_health(provider)
            for provider in providers
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build health status dictionary
        health_status: Dict[str, Dict[str, Any]] = {}
        for provider, result in zip(providers, results):
            if isinstance(result, Exception):
                health_status[provider.provider_id] = {
                    "status": "unavailable",
                    "response_time_ms": None,
                    "error": str(result),
                    "checked_at": datetime.now(timezone.utc).isoformat()
                }
            else:
                health_status[provider.provider_id] = result
        
        return health_status
    
    async def _check_provider_health(
        self,
        provider: ProviderPlugin
    ) -> Dict[str, Any]:
        """
        Check health of a single provider.
        
        Args:
            provider: The provider plugin to check
        
        Returns:
            Dictionary with health status information
        """
        start_time = datetime.now(timezone.utc)
        
        try:
            # Attempt to validate credentials (lightweight health check)
            await provider.validate_credentials()
            
            end_time = datetime.now(timezone.utc)
            response_time_ms = (end_time - start_time).total_seconds() * 1000
            
            return {
                "status": "healthy",
                "response_time_ms": response_time_ms,
                "error": None,
                "checked_at": end_time.isoformat()
            }
        
        except Exception as e:
            end_time = datetime.now(timezone.utc)
            response_time_ms = (end_time - start_time).total_seconds() * 1000
            
            logger.error(f"Health check failed for provider '{provider.provider_id}': {e}")
            
            return {
                "status": "unavailable",
                "response_time_ms": response_time_ms,
                "error": str(e),
                "checked_at": end_time.isoformat()
            }
    
    def get_available_providers(self) -> List[Dict[str, Any]]:
        """
        Get metadata for all registered providers.
        
        Returns:
            List of provider metadata dictionaries with enabled status
        
        Requirements:
            - Requirement 1.2: Provider metadata retrieval
            - Requirement 2.1: Dynamic provider selection
        
        Example:
            >>> providers = orchestrator.get_available_providers()
            >>> for provider in providers:
            ...     print(f"{provider['provider_id']}: {provider['enabled']}")
        """
        all_providers = self._registry.list_providers()
        
        provider_metadata = []
        for provider in all_providers:
            metadata = provider.get_metadata()
            metadata["enabled"] = self._registry.is_provider_enabled(provider.provider_id)
            provider_metadata.append(metadata)
        
        return provider_metadata
    
    def invalidate_cache(self, pattern: str) -> int:
        """
        Invalidate cache entries matching pattern.
        
        Args:
            pattern: Pattern to match (supports * wildcard)
        
        Returns:
            Number of cache entries invalidated
        
        Example:
            >>> orchestrator.invalidate_cache('aws:*')  # Invalidate all AWS cache
            5
        """
        if self._cache_manager is None:
            logger.warning("Cache manager not configured, cannot invalidate cache")
            return 0
        
        return self._cache_manager.invalidate(pattern)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        
        Example:
            >>> stats = orchestrator.get_cache_stats()
            >>> print(f"Hit rate: {stats['hit_rate']:.1f}%")
        """
        if self._cache_manager is None:
            return {
                "enabled": False,
                "message": "Cache manager not configured"
            }
        
        stats = self._cache_manager.get_stats()
        stats["enabled"] = True
        return stats
    
    def get_rate_limit_stats(self, provider_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get rate limiting statistics.
        
        Args:
            provider_id: Optional provider ID (None = all providers)
        
        Returns:
            Dictionary with rate limiting statistics
        
        Example:
            >>> stats = orchestrator.get_rate_limit_stats('aws')
            >>> print(f"Requests made: {stats['requests_made']}")
        """
        if self._rate_limiter is None:
            return {
                "enabled": False,
                "message": "Rate limiter not configured"
            }
        
        stats = self._rate_limiter.get_stats(provider_id)
        if isinstance(stats, dict) and 'provider_id' in stats:
            stats["enabled"] = True
        else:
            stats = {"enabled": True, "providers": stats}
        
        return stats
    
    def __repr__(self) -> str:
        """String representation of the orchestrator."""
        total_providers = self._registry.get_provider_count()
        enabled_providers = self._registry.get_enabled_provider_count()
        
        return (
            f"PricingOrchestrator("
            f"providers={total_providers}, "
            f"enabled={enabled_providers})"
        )
