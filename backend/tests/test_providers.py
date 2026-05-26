"""
Backend Tests - Task 19.1: Unit tests for provider plugins
Tests service catalog fetching, pricing data normalization, error handling.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from providers.base import ProviderPlugin
from providers.registry import ProviderRegistry
from models.service import ServiceEntry, ServiceCategory, PricingTier


# ── Fixtures ──────────────────────────────────────────────────────────────────

class ConcreteProvider(ProviderPlugin):
    """Minimal concrete provider for testing the abstract base."""

    def __init__(self, fail=False):
        super().__init__("test", "Test Provider", "1.0", 10)
        self._fail = fail

    async def get_service_catalog(self, region=None, category=None, force_refresh=False):
        if self._fail:
            raise RuntimeError("Provider API unavailable")
        return [
            {
                "provider": "test",
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": "Test VM Small",
                "unit": "per hour",
                "price_usd": 0.05,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or "us-east-1",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": False,
                "is_anomaly": False
            }
        ]

    async def get_pricing_data(self, service_id, region=None):
        return {"service_id": service_id, "base_price": 0.05, "pricing_tiers": [], "regional_pricing": {}, "metadata": {}}

    async def get_regions(self):
        return [{"region_id": "us-east-1", "region_name": "US East", "location": "North America"}]

    async def validate_credentials(self, api_key=None, **kwargs):
        if self._fail:
            raise RuntimeError("Auth failed")
        return True


@pytest.fixture
def registry():
    r = ProviderRegistry()
    r.clear()
    return r


# ── Provider Base Tests ───────────────────────────────────────────────────────

class TestProviderPlugin:

    def test_provider_properties(self):
        p = ConcreteProvider()
        assert p.provider_id == "test"
        assert p.provider_name == "Test Provider"
        assert p.api_version == "1.0"
        assert p.rate_limit == 10

    def test_get_metadata_returns_dict(self):
        p = ConcreteProvider()
        meta = p.get_metadata()
        assert meta["provider_id"] == "test"
        assert meta["provider_name"] == "Test Provider"
        assert "timestamp" in meta

    @pytest.mark.asyncio
    async def test_get_service_catalog_returns_list(self):
        p = ConcreteProvider()
        catalog = await p.get_service_catalog()
        assert isinstance(catalog, list)
        assert len(catalog) == 1
        assert catalog[0]["provider"] == "test"

    @pytest.mark.asyncio
    async def test_get_service_catalog_with_region_filter(self):
        p = ConcreteProvider()
        catalog = await p.get_service_catalog(region="eu-west-1")
        assert catalog[0]["region"] == "eu-west-1"

    @pytest.mark.asyncio
    async def test_get_service_catalog_raises_on_failure(self):
        p = ConcreteProvider(fail=True)
        with pytest.raises(RuntimeError):
            await p.get_service_catalog()

    @pytest.mark.asyncio
    async def test_validate_credentials_returns_true(self):
        p = ConcreteProvider()
        assert await p.validate_credentials() is True

    @pytest.mark.asyncio
    async def test_validate_credentials_raises_on_failure(self):
        p = ConcreteProvider(fail=True)
        with pytest.raises(RuntimeError):
            await p.validate_credentials()

    @pytest.mark.asyncio
    async def test_get_regions_returns_list(self):
        p = ConcreteProvider()
        regions = await p.get_regions()
        assert isinstance(regions, list)
        assert regions[0]["region_id"] == "us-east-1"

    def test_repr_contains_provider_id(self):
        p = ConcreteProvider()
        assert "test" in repr(p)


# ── Registry Tests ────────────────────────────────────────────────────────────

class TestProviderRegistry:

    def test_singleton_pattern(self):
        r1 = ProviderRegistry.get_instance()
        r2 = ProviderRegistry.get_instance()
        assert r1 is r2

    def test_register_provider(self, registry):
        p = ConcreteProvider()
        result = registry.register_provider(p, enabled=True)
        assert result is True
        assert registry.get_provider_count() == 1

    def test_register_none_raises(self, registry):
        with pytest.raises(ValueError):
            registry.register_provider(None)

    def test_register_non_plugin_raises(self, registry):
        with pytest.raises(TypeError):
            registry.register_provider("not_a_plugin")

    def test_get_provider_returns_correct_instance(self, registry):
        p = ConcreteProvider()
        registry.register_provider(p)
        retrieved = registry.get_provider("test")
        assert retrieved is p

    def test_get_nonexistent_provider_returns_none(self, registry):
        assert registry.get_provider("nonexistent") is None

    def test_list_providers_all(self, registry):
        registry.register_provider(ConcreteProvider(), enabled=True)
        providers = registry.list_providers()
        assert len(providers) == 1

    def test_list_providers_enabled_only(self, registry):
        p1 = ConcreteProvider()
        p1._provider_id = "enabled"
        p2 = ConcreteProvider()
        p2._provider_id = "disabled"
        registry.register_provider(p1, enabled=True)
        registry.register_provider(p2, enabled=False)
        enabled = registry.list_providers(enabled_only=True)
        assert len(enabled) == 1
        assert enabled[0].provider_id == "enabled"

    def test_enable_disable_provider(self, registry):
        p = ConcreteProvider()
        registry.register_provider(p, enabled=False)
        assert not registry.is_provider_enabled("test")
        registry.enable_provider("test")
        assert registry.is_provider_enabled("test")
        registry.disable_provider("test")
        assert not registry.is_provider_enabled("test")

    def test_unregister_provider(self, registry):
        registry.register_provider(ConcreteProvider())
        assert registry.get_provider_count() == 1
        registry.unregister_provider("test")
        assert registry.get_provider_count() == 0

    def test_clear_registry(self, registry):
        registry.register_provider(ConcreteProvider())
        registry.clear()
        assert registry.get_provider_count() == 0

    def test_repr_contains_counts(self, registry):
        registry.register_provider(ConcreteProvider(), enabled=True)
        r = repr(registry)
        assert "providers=1" in r
        assert "enabled=1" in r


# ── ServiceEntry Tests ────────────────────────────────────────────────────────

class TestServiceEntry:

    def test_create_valid_entry(self):
        entry = ServiceEntry(
            provider="aws",
            category=ServiceCategory.COMPUTE_VMS.value,
            service_name="EC2 t3.medium",
            unit="per hour",
            price_usd=0.0416,
            tier_label=PricingTier.ON_DEMAND.value
        )
        assert entry.provider == "aws"
        assert entry.price_usd == 0.0416

    def test_empty_provider_raises(self):
        with pytest.raises(ValueError):
            ServiceEntry(provider="", category="Compute", service_name="test", unit="hr", price_usd=0.1, tier_label="On-Demand")

    def test_negative_price_raises(self):
        with pytest.raises(ValueError):
            ServiceEntry(provider="aws", category="Compute", service_name="test", unit="hr", price_usd=-1.0, tier_label="On-Demand")

    def test_to_dict_roundtrip(self):
        entry = ServiceEntry(
            provider="gcp", category="Storage", service_name="GCS Standard",
            unit="per GB-month", price_usd=0.02, tier_label="On-Demand",
            region="us-central1"
        )
        d = entry.to_dict()
        restored = ServiceEntry.from_dict(d)
        assert restored.provider == entry.provider
        assert restored.price_usd == entry.price_usd
        assert restored.region == entry.region

    def test_calculate_monthly_cost_hourly(self):
        entry = ServiceEntry(
            provider="aws", category="Compute", service_name="EC2",
            unit="per hour", price_usd=0.1, tier_label="On-Demand"
        )
        assert entry.calculate_monthly_cost(730) == pytest.approx(73.0)

    def test_metadata_defaults_to_empty_dict(self):
        entry = ServiceEntry(
            provider="aws", category="Compute", service_name="EC2",
            unit="per hour", price_usd=0.1, tier_label="On-Demand", metadata=None
        )
        assert entry.metadata == {}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
