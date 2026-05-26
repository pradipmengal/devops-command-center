"""
Backend Tests - Task 19.2: Integration tests for pricing orchestrator.
Tests parallel provider calls, caching behavior, rate limiting.
"""

import pytest
import asyncio
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from providers.base import ProviderPlugin
from providers.registry import ProviderRegistry
from services.pricing_orchestrator import PricingOrchestrator, ProviderNotFoundError
from services.cache_manager import CacheManager
from services.rate_limiter import RateLimiter
from models.service import ServiceEntry, ServiceCategory, PricingTier


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_service(provider, name, price, category=ServiceCategory.COMPUTE_VMS.value):
    return {
        "provider": provider,
        "category": category,
        "service_name": name,
        "unit": "per hour",
        "price_usd": price,
        "tier_label": PricingTier.ON_DEMAND.value,
        "region": "us-east-1",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_fallback": False,
        "is_anomaly": False
    }


class SlowProvider(ProviderPlugin):
    def __init__(self, pid, delay=0.1, services=None):
        super().__init__(pid, pid.upper(), "1.0", 10)
        self._delay = delay
        self._services = services or [make_service(pid, f"{pid} VM", 0.05)]

    async def get_service_catalog(self, region=None, category=None, force_refresh=False):
        await asyncio.sleep(self._delay)
        return self._services

    async def get_pricing_data(self, service_id, region=None):
        return {"service_id": service_id, "base_price": 0.05, "pricing_tiers": [], "regional_pricing": {}, "metadata": {}}

    async def get_regions(self):
        return [{"region_id": "us-east-1", "region_name": "US East", "location": "North America"}]

    async def validate_credentials(self, api_key=None, **kwargs):
        return True


@pytest.fixture
def fresh_registry():
    r = ProviderRegistry()
    r.clear()
    return r


# ── Parallel Execution Tests ──────────────────────────────────────────────────

class TestParallelExecution:

    @pytest.mark.asyncio
    async def test_parallel_is_faster_than_sequential(self, fresh_registry):
        """Two 100ms providers should complete in ~100ms, not 200ms."""
        delay = 0.1
        for pid in ["aws", "azure"]:
            fresh_registry.register_provider(SlowProvider(pid, delay=delay), enabled=True)

        orch = PricingOrchestrator(registry=fresh_registry)
        start = time.time()
        services = await orch.fetch_services(provider_ids=["aws", "azure"])
        elapsed = time.time() - start

        assert elapsed < delay * 1.8, f"Expected ~{delay}s, got {elapsed:.2f}s"
        assert len(services) == 2

    @pytest.mark.asyncio
    async def test_partial_failure_returns_successful_results(self, fresh_registry):
        """If one provider fails, results from others are still returned."""
        class FailingProvider(SlowProvider):
            async def get_service_catalog(self, **kwargs):
                raise RuntimeError("API down")

        fresh_registry.register_provider(SlowProvider("aws"), enabled=True)
        fresh_registry.register_provider(FailingProvider("azure"), enabled=True)

        orch = PricingOrchestrator(registry=fresh_registry)
        services = await orch.fetch_services(provider_ids=["aws", "azure"])

        assert len(services) == 1
        assert services[0].provider == "aws"

    @pytest.mark.asyncio
    async def test_deduplication_removes_duplicates(self, fresh_registry):
        """Duplicate entries from same provider are removed."""
        dup_services = [make_service("aws", "EC2 t3", 0.05)] * 3
        fresh_registry.register_provider(SlowProvider("aws", services=dup_services), enabled=True)

        orch = PricingOrchestrator(registry=fresh_registry)
        services = await orch.fetch_services(provider_ids=["aws"])
        assert len(services) == 1

    @pytest.mark.asyncio
    async def test_empty_registry_returns_empty_list(self, fresh_registry):
        orch = PricingOrchestrator(registry=fresh_registry)
        services = await orch.fetch_services()
        assert services == []

    @pytest.mark.asyncio
    async def test_unknown_provider_raises(self, fresh_registry):
        orch = PricingOrchestrator(registry=fresh_registry)
        with pytest.raises(ProviderNotFoundError):
            await orch.fetch_services(provider_ids=["nonexistent"])


# ── Caching Tests ─────────────────────────────────────────────────────────────

class TestCachingBehavior:

    def test_cache_hit_returns_same_value(self):
        cache = CacheManager(backend='memory', ttl_hours=1)
        data = [{"service": "EC2", "price": 0.05}]
        cache.set("aws:services", data)
        result = cache.get("aws:services")
        assert result == data

    def test_cache_miss_returns_none(self):
        cache = CacheManager(backend='memory')
        assert cache.get("nonexistent:key") is None

    def test_cache_invalidation_by_pattern(self):
        cache = CacheManager(backend='memory')
        cache.set("aws:services:us-east-1", "data1")
        cache.set("aws:services:eu-west-1", "data2")
        cache.set("azure:services:eastus", "data3")

        count = cache.invalidate("aws:*")
        assert count == 2
        assert cache.get("aws:services:us-east-1") is None
        assert cache.get("azure:services:eastus") == "data3"

    def test_cache_stats_track_hits_and_misses(self):
        cache = CacheManager(backend='memory')
        cache.set("key", "value")
        cache.get("key")       # hit
        cache.get("missing")   # miss

        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 50.0

    def test_orchestrator_exposes_cache_stats(self, fresh_registry):
        cache = CacheManager(backend='memory')
        orch = PricingOrchestrator(registry=fresh_registry, cache_manager=cache)
        stats = orch.get_cache_stats()
        assert stats["enabled"] is True
        assert "hits" in stats

    def test_orchestrator_invalidate_cache(self, fresh_registry):
        cache = CacheManager(backend='memory')
        cache.set("aws:services", "data")
        orch = PricingOrchestrator(registry=fresh_registry, cache_manager=cache)
        count = orch.invalidate_cache("aws:*")
        assert count == 1


# ── Rate Limiting Tests ───────────────────────────────────────────────────────

class TestRateLimiting:

    @pytest.mark.asyncio
    async def test_rate_limit_blocks_excess_requests(self):
        limiter = RateLimiter()
        limiter.configure_provider("test", max_requests=3, window_seconds=60)

        results = [await limiter.acquire("test") for _ in range(4)]
        assert results[:3] == [True, True, True]
        assert results[3] is False

    @pytest.mark.asyncio
    async def test_rate_limit_resets_after_window(self):
        limiter = RateLimiter()
        limiter.configure_provider("test", max_requests=1, window_seconds=1)

        assert await limiter.acquire("test") is True
        assert await limiter.acquire("test") is False

        await asyncio.sleep(1.1)
        assert await limiter.acquire("test") is True

    @pytest.mark.asyncio
    async def test_different_providers_independent(self):
        limiter = RateLimiter()
        limiter.configure_provider("aws", max_requests=1, window_seconds=60)
        limiter.configure_provider("azure", max_requests=1, window_seconds=60)

        assert await limiter.acquire("aws") is True
        assert await limiter.acquire("aws") is False
        assert await limiter.acquire("azure") is True  # Azure unaffected

    def test_rate_limit_stats(self):
        limiter = RateLimiter()
        limiter.configure_provider("test", max_requests=5, window_seconds=60)
        stats = limiter.get_stats("test")
        assert stats["requests_made"] == 0
        assert stats["requests_blocked"] == 0

    def test_orchestrator_exposes_rate_limit_stats(self, fresh_registry):
        limiter = RateLimiter()
        orch = PricingOrchestrator(registry=fresh_registry, rate_limiter=limiter)
        stats = orch.get_rate_limit_stats()
        assert stats["enabled"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
