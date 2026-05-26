"""
Unit tests for the ProviderPlugin abstract base class.

Tests verify that:
1. The abstract base class cannot be instantiated directly
2. Concrete implementations must implement all abstract methods
3. Common properties (provider_id, provider_name, api_version, rate_limit) work correctly
4. The get_metadata() method returns expected data
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
from providers.base import ProviderPlugin


class ConcreteProvider(ProviderPlugin):
    """
    Concrete implementation of ProviderPlugin for testing purposes.
    Implements all abstract methods with minimal functionality.
    """
    
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Mock implementation returning a sample service catalog."""
        return [
            {
                "provider": self.provider_id,
                "category": "Compute",
                "service_name": "Test VM",
                "unit": "per hour",
                "price_usd": 0.05,
                "tier_label": "On-Demand",
                "region": region,
                "metadata": {},
                "fetched_at": datetime.now(timezone.utc).isoformat()
            }
        ]
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mock implementation returning sample pricing data."""
        return {
            "service_id": service_id,
            "service_name": "Test Service",
            "base_price": 0.05,
            "pricing_tiers": [{"tier": "On-Demand", "price": 0.05}],
            "regional_pricing": {"us-east-1": 0.05},
            "metadata": {}
        }
    
    async def get_regions(self) -> List[Dict[str, str]]:
        """Mock implementation returning sample regions."""
        return [
            {
                "region_id": "us-east-1",
                "region_name": "US East (Test)",
                "location": "North America"
            }
        ]
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        """Mock implementation that always returns True."""
        return True


class IncompleteProvider(ProviderPlugin):
    """
    Incomplete implementation missing some abstract methods.
    Used to test that abstract methods are enforced.
    """
    
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        return []
    
    # Missing: get_pricing_data, get_regions, validate_credentials


def test_cannot_instantiate_abstract_base_class():
    """Test that ProviderPlugin cannot be instantiated directly."""
    with pytest.raises(TypeError) as exc_info:
        ProviderPlugin(
            provider_id="test",
            provider_name="Test Provider"
        )
    
    assert "Can't instantiate abstract class" in str(exc_info.value)


def test_cannot_instantiate_incomplete_implementation():
    """Test that incomplete implementations cannot be instantiated."""
    with pytest.raises(TypeError) as exc_info:
        IncompleteProvider(
            provider_id="incomplete",
            provider_name="Incomplete Provider"
        )
    
    assert "Can't instantiate abstract class" in str(exc_info.value)


def test_concrete_provider_initialization():
    """Test that a complete concrete implementation can be instantiated."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider",
        api_version="2.0",
        rate_limit=20
    )
    
    assert provider.provider_id == "test"
    assert provider.provider_name == "Test Provider"
    assert provider.api_version == "2.0"
    assert provider.rate_limit == 20


def test_concrete_provider_default_values():
    """Test that default values are applied correctly."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    assert provider.api_version == "1.0"
    assert provider.rate_limit == 10


def test_provider_properties_are_read_only():
    """Test that provider properties cannot be modified after initialization."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    # Properties should be read-only (no setter)
    with pytest.raises(AttributeError):
        provider.provider_id = "modified"
    
    with pytest.raises(AttributeError):
        provider.provider_name = "Modified Provider"


def test_get_metadata():
    """Test that get_metadata returns correct provider information."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider",
        api_version="2.0",
        rate_limit=20
    )
    
    metadata = provider.get_metadata()
    
    assert metadata["provider_id"] == "test"
    assert metadata["provider_name"] == "Test Provider"
    assert metadata["api_version"] == "2.0"
    assert metadata["rate_limit"] == 20
    assert "timestamp" in metadata
    
    # Verify timestamp is in ISO format
    datetime.fromisoformat(metadata["timestamp"])


def test_provider_repr():
    """Test the string representation of the provider."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider",
        api_version="2.0",
        rate_limit=20
    )
    
    repr_str = repr(provider)
    
    assert "ConcreteProvider" in repr_str
    assert "provider_id='test'" in repr_str
    assert "provider_name='Test Provider'" in repr_str
    assert "api_version='2.0'" in repr_str
    assert "rate_limit=20" in repr_str


@pytest.mark.asyncio
async def test_get_service_catalog():
    """Test that get_service_catalog returns expected data structure."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    catalog = await provider.get_service_catalog(region="us-east-1")
    
    assert isinstance(catalog, list)
    assert len(catalog) > 0
    
    service = catalog[0]
    assert service["provider"] == "test"
    assert service["category"] == "Compute"
    assert service["service_name"] == "Test VM"
    assert service["unit"] == "per hour"
    assert service["price_usd"] == 0.05
    assert service["tier_label"] == "On-Demand"
    assert service["region"] == "us-east-1"


@pytest.mark.asyncio
async def test_get_pricing_data():
    """Test that get_pricing_data returns expected data structure."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    pricing = await provider.get_pricing_data(
        service_id="test-service-1",
        region="us-east-1"
    )
    
    assert pricing["service_id"] == "test-service-1"
    assert pricing["service_name"] == "Test Service"
    assert pricing["base_price"] == 0.05
    assert isinstance(pricing["pricing_tiers"], list)
    assert isinstance(pricing["regional_pricing"], dict)
    assert isinstance(pricing["metadata"], dict)


@pytest.mark.asyncio
async def test_get_regions():
    """Test that get_regions returns expected data structure."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    regions = await provider.get_regions()
    
    assert isinstance(regions, list)
    assert len(regions) > 0
    
    region = regions[0]
    assert "region_id" in region
    assert "region_name" in region
    assert "location" in region
    assert region["region_id"] == "us-east-1"


@pytest.mark.asyncio
async def test_validate_credentials_no_auth():
    """Test credential validation when no authentication is required."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    is_valid = await provider.validate_credentials()
    
    assert is_valid is True


@pytest.mark.asyncio
async def test_validate_credentials_with_api_key():
    """Test credential validation with API key."""
    provider = ConcreteProvider(
        provider_id="test",
        provider_name="Test Provider"
    )
    
    is_valid = await provider.validate_credentials(api_key="test-key-123")
    
    assert is_valid is True


def test_multiple_provider_instances():
    """Test that multiple provider instances can coexist with different configurations."""
    provider1 = ConcreteProvider(
        provider_id="aws",
        provider_name="Amazon Web Services",
        api_version="1.0",
        rate_limit=10
    )
    
    provider2 = ConcreteProvider(
        provider_id="azure",
        provider_name="Microsoft Azure",
        api_version="2.0",
        rate_limit=20
    )
    
    assert provider1.provider_id == "aws"
    assert provider2.provider_id == "azure"
    assert provider1.rate_limit == 10
    assert provider2.rate_limit == 20
    
    # Verify they are independent instances
    assert provider1 is not provider2
