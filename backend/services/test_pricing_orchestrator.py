"""
Unit tests for PricingOrchestrator.

This module contains comprehensive unit tests for the PricingOrchestrator service,
including tests for parallel provider fetching, error handling, filtering, and
deduplication.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, patch

import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.pricing_orchestrator import (
    PricingOrchestrator,
    PricingOrchestratorError,
    ProviderNotFoundError
)
from providers.base import ProviderPlugin
from providers.registry import ProviderRegistry
from models.service import ServiceEntry, ServiceCategory, PricingTier


# Mock Provider for testing
class MockProvider(ProviderPlugin):
    """Mock provider for testing purposes."""
    
    def __init__(
        self,
        provider_id: str,
        provider_name: str,
        services: Optional[List[Dict[str, Any]]] = None,
        should_fail: bool = False,
        delay_seconds: float = 0.0
    ):
        super().__init__(
            provider_id=provider_id,
            provider_name=provider_name,
            api_version="1.0",
            rate_limit=10
        )
        self._services = services or []
        self._should_fail = should_fail
        self._delay_seconds = delay_seconds
    
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Mock implementation of get_service_catalog."""
        if self._delay_seconds > 0:
            await asyncio.sleep(self._delay_seconds)
        
        if self._should_fail:
            raise Exception(f"Mock provider '{self.provider_id}' failed")
        
        # Apply filters
        services = self._services.copy()
        
        if region:
            services = [s for s in services if s.get('region') == region]
        
        if category:
            services = [s for s in services if s.get('category') == category]
        
        return services
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mock implementation of get_pricing_data."""
        return {
            "service_id": service_id,
            "service_name": f"Mock Service {service_id}",
            "base_price": 0.0,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {}
        }
    
    async def get_regions(self) -> List[Dict[str, str]]:
        """Mock implementation of get_regions."""
        return [
            {"region_id": "us-east-1", "region_name": "US East", "location": "North America"}
        ]
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        """Mock implementation of validate_credentials."""
        if self._should_fail:
            raise Exception(f"Mock provider '{self.provider_id}' credential validation failed")
        return True


@pytest.fixture
def mock_registry():
    """Create a mock ProviderRegistry for testing."""
    registry = ProviderRegistry()
    registry.clear()  # Clear any existing providers
    return registry


@pytest.fixture
def sample_aws_services():
    """Sample AWS service data for testing."""
    return [
        {
            "provider": "aws",
            "category": ServiceCategory.COMPUTE_VMS.value,
            "service_name": "EC2 t3.medium",
            "unit": "per hour",
            "price_usd": 0.0416,
            "tier_label": PricingTier.ON_DEMAND.value,
            "region": "us-east-1",
            "vcpu": 2,
            "memory_gb": 4.0,
            "metadata": {"instance_type": "t3.medium"},
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "is_fallback": False,
            "is_anomaly": False
        },
        {
            "provider": "aws",
            "category": ServiceCategory.OBJECT_STORAGE.value,
            "service_name": "S3 Standard",
            "unit": "per GB-month",
            "price_usd": 0.023,
            "tier_label": PricingTier.ON_DEMAND.value,
            "region": "us-east-1",
            "metadata": {"storage_class": "Standard"},
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "is_fallback": False,
            "is_anomaly": False
        }
    ]


@pytest.fixture
def sample_azure_services():
    """Sample Azure service data for testing."""
    return [
        {
            "provider": "azure",
            "category": ServiceCategory.COMPUTE_VMS.value,
            "service_name": "Azure VM B2s",
            "unit": "per hour",
            "price_usd": 0.0416,
            "tier_label": PricingTier.ON_DEMAND.value,
            "region": "eastus",
            "vcpu": 2,
            "memory_gb": 4.0,
            "metadata": {"vm_size": "B2s"},
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "is_fallback": False,
            "is_anomaly": False
        }
    ]


class TestPricingOrchestrator:
    """Test suite for PricingOrchestrator."""
    
    @pytest.mark.asyncio
    async def test_fetch_services_from_single_provider(
        self,
        mock_registry,
        sample_aws_services
    ):
        """Test fetching services from a single provider."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(provider_ids=["aws"])
        
        # Assert
        assert len(services) == 2
        assert all(isinstance(s, ServiceEntry) for s in services)
        assert services[0].provider == "aws"
        assert services[0].service_name == "EC2 t3.medium"
        assert services[1].service_name == "S3 Standard"
    
    @pytest.mark.asyncio
    async def test_fetch_services_from_multiple_providers(
        self,
        mock_registry,
        sample_aws_services,
        sample_azure_services
    ):
        """Test fetching services from multiple providers in parallel."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        azure_provider = MockProvider("azure", "Azure", services=sample_azure_services)
        
        mock_registry.register_provider(aws_provider, enabled=True)
        mock_registry.register_provider(azure_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(provider_ids=["aws", "azure"])
        
        # Assert
        assert len(services) == 3
        aws_services = [s for s in services if s.provider == "aws"]
        azure_services = [s for s in services if s.provider == "azure"]
        assert len(aws_services) == 2
        assert len(azure_services) == 1
    
    @pytest.mark.asyncio
    async def test_fetch_services_with_region_filter(
        self,
        mock_registry,
        sample_aws_services
    ):
        """Test fetching services with region filtering."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(
            provider_ids=["aws"],
            regions=["us-east-1"]
        )
        
        # Assert
        assert len(services) == 2
        assert all(s.region == "us-east-1" for s in services)
    
    @pytest.mark.asyncio
    async def test_fetch_services_with_category_filter(
        self,
        mock_registry,
        sample_aws_services
    ):
        """Test fetching services with category filtering."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(
            provider_ids=["aws"],
            categories=[ServiceCategory.COMPUTE_VMS.value]
        )
        
        # Assert
        assert len(services) == 1
        assert services[0].category == ServiceCategory.COMPUTE_VMS.value
        assert services[0].service_name == "EC2 t3.medium"
    
    @pytest.mark.asyncio
    async def test_fetch_services_handles_provider_failure(
        self,
        mock_registry,
        sample_aws_services
    ):
        """Test that orchestrator handles provider failures gracefully."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        failing_provider = MockProvider("failing", "Failing Provider", should_fail=True)
        
        mock_registry.register_provider(aws_provider, enabled=True)
        mock_registry.register_provider(failing_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(provider_ids=["aws", "failing"])
        
        # Assert - should still get AWS services despite failing provider
        assert len(services) == 2
        assert all(s.provider == "aws" for s in services)
    
    @pytest.mark.asyncio
    async def test_fetch_services_deduplicates_entries(self, mock_registry):
        """Test that duplicate service entries are removed."""
        # Setup - create duplicate services
        duplicate_services = [
            {
                "provider": "aws",
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": "EC2 t3.medium",
                "unit": "per hour",
                "price_usd": 0.0416,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": "us-east-1",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": False,
                "is_anomaly": False
            },
            {
                "provider": "aws",
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": "EC2 t3.medium",  # Duplicate
                "unit": "per hour",
                "price_usd": 0.0416,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": "us-east-1",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": False,
                "is_anomaly": False
            }
        ]
        
        aws_provider = MockProvider("aws", "AWS", services=duplicate_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(provider_ids=["aws"])
        
        # Assert - should only have one entry
        assert len(services) == 1
        assert services[0].service_name == "EC2 t3.medium"
    
    @pytest.mark.asyncio
    async def test_fetch_services_with_invalid_provider_id(self, mock_registry):
        """Test that fetching with invalid provider ID raises error."""
        # Setup
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute & Assert
        with pytest.raises(ProviderNotFoundError) as exc_info:
            await orchestrator.fetch_services(provider_ids=["nonexistent"])
        
        assert "nonexistent" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_fetch_services_from_all_enabled_providers(
        self,
        mock_registry,
        sample_aws_services,
        sample_azure_services
    ):
        """Test fetching from all enabled providers when no provider_ids specified."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        azure_provider = MockProvider("azure", "Azure", services=sample_azure_services)
        disabled_provider = MockProvider("disabled", "Disabled", services=[])
        
        mock_registry.register_provider(aws_provider, enabled=True)
        mock_registry.register_provider(azure_provider, enabled=True)
        mock_registry.register_provider(disabled_provider, enabled=False)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute - no provider_ids specified
        services = await orchestrator.fetch_services()
        
        # Assert - should get services from enabled providers only
        assert len(services) == 3
        providers = {s.provider for s in services}
        assert providers == {"aws", "azure"}
        assert "disabled" not in providers
    
    @pytest.mark.asyncio
    async def test_fetch_services_returns_empty_list_when_no_providers(
        self,
        mock_registry
    ):
        """Test that empty list is returned when no providers are available."""
        # Setup - empty registry
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services()
        
        # Assert
        assert services == []
    
    @pytest.mark.asyncio
    async def test_get_provider_health_all_healthy(
        self,
        mock_registry,
        sample_aws_services
    ):
        """Test health check when all providers are healthy."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        health = await orchestrator.get_provider_health(provider_ids=["aws"])
        
        # Assert
        assert "aws" in health
        assert health["aws"]["status"] == "healthy"
        assert health["aws"]["error"] is None
        assert "response_time_ms" in health["aws"]
        assert "checked_at" in health["aws"]
    
    @pytest.mark.asyncio
    async def test_get_provider_health_with_failure(self, mock_registry):
        """Test health check when a provider fails."""
        # Setup
        failing_provider = MockProvider("failing", "Failing", should_fail=True)
        mock_registry.register_provider(failing_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        health = await orchestrator.get_provider_health(provider_ids=["failing"])
        
        # Assert
        assert "failing" in health
        assert health["failing"]["status"] == "unavailable"
        assert health["failing"]["error"] is not None
        assert "response_time_ms" in health["failing"]
    
    def test_get_available_providers(
        self,
        mock_registry,
        sample_aws_services,
        sample_azure_services
    ):
        """Test getting metadata for all available providers."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        azure_provider = MockProvider("azure", "Azure", services=sample_azure_services)
        
        mock_registry.register_provider(aws_provider, enabled=True)
        mock_registry.register_provider(azure_provider, enabled=False)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        providers = orchestrator.get_available_providers()
        
        # Assert
        assert len(providers) == 2
        
        aws_metadata = next(p for p in providers if p["provider_id"] == "aws")
        assert aws_metadata["provider_name"] == "AWS"
        assert aws_metadata["enabled"] is True
        
        azure_metadata = next(p for p in providers if p["provider_id"] == "azure")
        assert azure_metadata["provider_name"] == "Azure"
        assert azure_metadata["enabled"] is False
    
    @pytest.mark.asyncio
    async def test_parallel_execution_performance(
        self,
        mock_registry,
        sample_aws_services,
        sample_azure_services
    ):
        """Test that providers are fetched in parallel, not sequentially."""
        # Setup - providers with delays
        delay = 0.1  # 100ms delay per provider
        aws_provider = MockProvider(
            "aws", "AWS",
            services=sample_aws_services,
            delay_seconds=delay
        )
        azure_provider = MockProvider(
            "azure", "Azure",
            services=sample_azure_services,
            delay_seconds=delay
        )
        
        mock_registry.register_provider(aws_provider, enabled=True)
        mock_registry.register_provider(azure_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute and measure time
        start_time = datetime.now(timezone.utc)
        services = await orchestrator.fetch_services(provider_ids=["aws", "azure"])
        end_time = datetime.now(timezone.utc)
        
        elapsed_seconds = (end_time - start_time).total_seconds()
        
        # Assert - parallel execution should take ~delay seconds, not 2*delay
        # Allow some overhead for test execution
        assert elapsed_seconds < delay * 1.5, \
            f"Expected parallel execution (~{delay}s), but took {elapsed_seconds}s"
        assert len(services) == 3
    
    @pytest.mark.asyncio
    async def test_fetch_services_with_invalid_service_data(self, mock_registry):
        """Test that invalid service entries are skipped with warning."""
        # Setup - services with missing required fields
        invalid_services = [
            {
                "provider": "aws",
                "category": ServiceCategory.COMPUTE_VMS.value,
                # Missing service_name, unit, price_usd, tier_label
                "region": "us-east-1",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "provider": "aws",
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": "EC2 t3.medium",
                "unit": "per hour",
                "price_usd": 0.0416,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": "us-east-1",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": False,
                "is_anomaly": False
            }
        ]
        
        aws_provider = MockProvider("aws", "AWS", services=invalid_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        services = await orchestrator.fetch_services(provider_ids=["aws"])
        
        # Assert - should only get the valid service
        assert len(services) == 1
        assert services[0].service_name == "EC2 t3.medium"
    
    def test_orchestrator_repr(self, mock_registry, sample_aws_services):
        """Test string representation of orchestrator."""
        # Setup
        aws_provider = MockProvider("aws", "AWS", services=sample_aws_services)
        mock_registry.register_provider(aws_provider, enabled=True)
        
        orchestrator = PricingOrchestrator(registry=mock_registry)
        
        # Execute
        repr_str = repr(orchestrator)
        
        # Assert
        assert "PricingOrchestrator" in repr_str
        assert "providers=1" in repr_str
        assert "enabled=1" in repr_str


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
