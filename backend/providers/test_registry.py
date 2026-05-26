"""
Unit tests for ProviderRegistry.

This module contains comprehensive unit tests for the ProviderRegistry singleton,
including registration, retrieval, listing, and auto-discovery functionality.
"""

import pytest
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone

from backend.providers.base import ProviderPlugin
from backend.providers.registry import ProviderRegistry


# Mock provider implementations for testing
class MockAWSProvider(ProviderPlugin):
    """Mock AWS provider for testing."""
    
    def __init__(self):
        super().__init__(
            provider_id="aws",
            provider_name="Amazon Web Services",
            api_version="1.0",
            rate_limit=10
        )
    
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        return [
            {
                "provider": "aws",
                "category": "Compute",
                "service_name": "EC2 t3.medium",
                "unit": "per hour",
                "price_usd": 0.0416,
                "tier_label": "On-Demand",
                "region": region or "us-east-1",
                "fetched_at": datetime.now(timezone.utc)
            }
        ]
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        return {
            "service_id": service_id,
            "service_name": "EC2 t3.medium",
            "base_price": 0.0416,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {}
        }
    
    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {
                "region_id": "us-east-1",
                "region_name": "US East (N. Virginia)",
                "location": "North America"
            }
        ]
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        return True


class MockAzureProvider(ProviderPlugin):
    """Mock Azure provider for testing."""
    
    def __init__(self):
        super().__init__(
            provider_id="azure",
            provider_name="Microsoft Azure",
            api_version="1.0",
            rate_limit=20
        )
    
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        return [
            {
                "provider": "azure",
                "category": "Compute",
                "service_name": "Azure VM B2s",
                "unit": "per hour",
                "price_usd": 0.0416,
                "tier_label": "Pay-As-You-Go",
                "region": region or "eastus",
                "fetched_at": datetime.now(timezone.utc)
            }
        ]
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        return {
            "service_id": service_id,
            "service_name": "Azure VM B2s",
            "base_price": 0.0416,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {}
        }
    
    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {
                "region_id": "eastus",
                "region_name": "East US",
                "location": "North America"
            }
        ]
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        return True


class InvalidProvider:
    """Invalid provider that doesn't inherit from ProviderPlugin."""
    
    def __init__(self):
        self.provider_id = "invalid"
        self.provider_name = "Invalid Provider"


class IncompleteProvider(ProviderPlugin):
    """Provider that doesn't implement all required methods properly."""
    
    def __init__(self):
        super().__init__(
            provider_id="incomplete",
            provider_name="Incomplete Provider"
        )
    
    # Implement abstract methods but make them non-callable or broken
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        return []
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        return {}
    
    async def get_regions(self) -> List[Dict[str, str]]:
        return []
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        return True


# Fixtures
@pytest.fixture
def registry():
    """Create a fresh registry instance for each test."""
    # Clear the singleton instance
    ProviderRegistry._instance = None
    ProviderRegistry._initialized = False
    
    # Get a new instance
    reg = ProviderRegistry.get_instance()
    
    yield reg
    
    # Cleanup
    reg.clear()


@pytest.fixture
def aws_provider():
    """Create a mock AWS provider."""
    return MockAWSProvider()


@pytest.fixture
def azure_provider():
    """Create a mock Azure provider."""
    return MockAzureProvider()


# Test Cases

class TestProviderRegistrySingleton:
    """Test singleton behavior of ProviderRegistry."""
    
    def test_singleton_instance(self, registry):
        """Test that ProviderRegistry returns the same instance."""
        instance1 = ProviderRegistry.get_instance()
        instance2 = ProviderRegistry.get_instance()
        
        assert instance1 is instance2
        assert instance1 is registry
    
    def test_singleton_new(self, registry):
        """Test that __new__ returns the same instance."""
        instance1 = ProviderRegistry()
        instance2 = ProviderRegistry()
        
        assert instance1 is instance2
        assert instance1 is registry


class TestProviderRegistration:
    """Test provider registration functionality."""
    
    def test_register_provider_success(self, registry, aws_provider):
        """Test successful provider registration."""
        result = registry.register_provider(aws_provider)
        
        assert result is True
        assert registry.get_provider_count() == 1
        assert registry.get_provider("aws") is aws_provider
    
    def test_register_multiple_providers(self, registry, aws_provider, azure_provider):
        """Test registering multiple providers."""
        registry.register_provider(aws_provider)
        registry.register_provider(azure_provider)
        
        assert registry.get_provider_count() == 2
        assert registry.get_provider("aws") is aws_provider
        assert registry.get_provider("azure") is azure_provider
    
    def test_register_provider_disabled(self, registry, aws_provider):
        """Test registering a provider as disabled."""
        registry.register_provider(aws_provider, enabled=False)
        
        assert registry.get_provider("aws") is aws_provider
        assert not registry.is_provider_enabled("aws")
        assert len(registry.get_enabled_providers()) == 0
    
    def test_register_provider_none(self, registry):
        """Test that registering None raises ValueError."""
        with pytest.raises(ValueError, match="Provider cannot be None"):
            registry.register_provider(None)
    
    def test_register_invalid_provider_type(self, registry):
        """Test that registering non-ProviderPlugin raises TypeError."""
        invalid = InvalidProvider()
        
        with pytest.raises(TypeError, match="must inherit from ProviderPlugin"):
            registry.register_provider(invalid)
    
    def test_register_provider_without_validation(self, registry):
        """Test registering provider without validation."""
        # Create an incomplete provider (missing abstract method implementations)
        incomplete = IncompleteProvider()
        
        # Should succeed when validation is disabled
        result = registry.register_provider(incomplete, validate=False)
        assert result is True
    
    def test_register_provider_replaces_existing(self, registry, aws_provider):
        """Test that re-registering a provider replaces the existing one."""
        registry.register_provider(aws_provider)
        
        # Create a new instance with same provider_id
        new_aws = MockAWSProvider()
        registry.register_provider(new_aws)
        
        assert registry.get_provider_count() == 1
        assert registry.get_provider("aws") is new_aws


class TestProviderRetrieval:
    """Test provider retrieval functionality."""
    
    def test_get_provider_success(self, registry, aws_provider):
        """Test successful provider retrieval."""
        registry.register_provider(aws_provider)
        
        retrieved = registry.get_provider("aws")
        assert retrieved is aws_provider
    
    def test_get_provider_not_found(self, registry):
        """Test retrieving non-existent provider returns None."""
        result = registry.get_provider("nonexistent")
        assert result is None
    
    def test_get_provider_after_unregister(self, registry, aws_provider):
        """Test that get_provider returns None after unregistering."""
        registry.register_provider(aws_provider)
        registry.unregister_provider("aws")
        
        result = registry.get_provider("aws")
        assert result is None


class TestProviderListing:
    """Test provider listing functionality."""
    
    def test_list_providers_empty(self, registry):
        """Test listing providers when registry is empty."""
        providers = registry.list_providers()
        assert providers == []
    
    def test_list_providers_all(self, registry, aws_provider, azure_provider):
        """Test listing all providers."""
        registry.register_provider(aws_provider)
        registry.register_provider(azure_provider)
        
        providers = registry.list_providers()
        assert len(providers) == 2
        assert aws_provider in providers
        assert azure_provider in providers
    
    def test_list_providers_enabled_only(self, registry, aws_provider, azure_provider):
        """Test listing only enabled providers."""
        registry.register_provider(aws_provider, enabled=True)
        registry.register_provider(azure_provider, enabled=False)
        
        enabled_providers = registry.list_providers(enabled_only=True)
        assert len(enabled_providers) == 1
        assert aws_provider in enabled_providers
        assert azure_provider not in enabled_providers
    
    def test_get_enabled_providers(self, registry, aws_provider, azure_provider):
        """Test get_enabled_providers method."""
        registry.register_provider(aws_provider, enabled=True)
        registry.register_provider(azure_provider, enabled=False)
        
        enabled_providers = registry.get_enabled_providers()
        assert len(enabled_providers) == 1
        assert aws_provider in enabled_providers


class TestProviderEnableDisable:
    """Test provider enable/disable functionality."""
    
    def test_enable_provider(self, registry, aws_provider):
        """Test enabling a provider."""
        registry.register_provider(aws_provider, enabled=False)
        
        result = registry.enable_provider("aws")
        assert result is True
        assert registry.is_provider_enabled("aws")
    
    def test_disable_provider(self, registry, aws_provider):
        """Test disabling a provider."""
        registry.register_provider(aws_provider, enabled=True)
        
        result = registry.disable_provider("aws")
        assert result is True
        assert not registry.is_provider_enabled("aws")
    
    def test_enable_nonexistent_provider(self, registry):
        """Test enabling non-existent provider returns False."""
        result = registry.enable_provider("nonexistent")
        assert result is False
    
    def test_disable_nonexistent_provider(self, registry):
        """Test disabling non-existent provider returns False."""
        result = registry.disable_provider("nonexistent")
        assert result is False
    
    def test_is_provider_enabled_default(self, registry):
        """Test is_provider_enabled returns False for non-existent provider."""
        assert not registry.is_provider_enabled("nonexistent")


class TestProviderUnregistration:
    """Test provider unregistration functionality."""
    
    def test_unregister_provider_success(self, registry, aws_provider):
        """Test successful provider unregistration."""
        registry.register_provider(aws_provider)
        
        result = registry.unregister_provider("aws")
        assert result is True
        assert registry.get_provider_count() == 0
        assert registry.get_provider("aws") is None
    
    def test_unregister_nonexistent_provider(self, registry):
        """Test unregistering non-existent provider returns False."""
        result = registry.unregister_provider("nonexistent")
        assert result is False


class TestProviderCounts:
    """Test provider count functionality."""
    
    def test_get_provider_count_empty(self, registry):
        """Test provider count when registry is empty."""
        assert registry.get_provider_count() == 0
    
    def test_get_provider_count(self, registry, aws_provider, azure_provider):
        """Test provider count with multiple providers."""
        registry.register_provider(aws_provider)
        registry.register_provider(azure_provider)
        
        assert registry.get_provider_count() == 2
    
    def test_get_enabled_provider_count(self, registry, aws_provider, azure_provider):
        """Test enabled provider count."""
        registry.register_provider(aws_provider, enabled=True)
        registry.register_provider(azure_provider, enabled=False)
        
        assert registry.get_enabled_provider_count() == 1


class TestRegistryClear:
    """Test registry clear functionality."""
    
    def test_clear_registry(self, registry, aws_provider, azure_provider):
        """Test clearing the registry."""
        registry.register_provider(aws_provider)
        registry.register_provider(azure_provider)
        
        registry.clear()
        
        assert registry.get_provider_count() == 0
        assert len(registry.list_providers()) == 0


class TestRegistryRepr:
    """Test registry string representation."""
    
    def test_repr_empty(self, registry):
        """Test __repr__ with empty registry."""
        repr_str = repr(registry)
        assert "ProviderRegistry" in repr_str
        assert "providers=0" in repr_str
        assert "enabled=0" in repr_str
    
    def test_repr_with_providers(self, registry, aws_provider, azure_provider):
        """Test __repr__ with providers."""
        registry.register_provider(aws_provider, enabled=True)
        registry.register_provider(azure_provider, enabled=False)
        
        repr_str = repr(registry)
        assert "ProviderRegistry" in repr_str
        assert "providers=2" in repr_str
        assert "enabled=1" in repr_str


class TestProviderValidation:
    """Test provider interface validation."""
    
    def test_validate_complete_provider(self, registry, aws_provider):
        """Test validation passes for complete provider."""
        result = registry._validate_provider_interface(aws_provider)
        assert result is True
    
    def test_validate_provider_with_non_callable_method(self, registry, aws_provider):
        """Test validation fails for provider with non-callable method."""
        # Take a valid provider and make one of its methods non-callable
        aws_provider.get_regions = "not_a_function"
        
        result = registry._validate_provider_interface(aws_provider)
        assert result is False


# Integration test for auto-discovery would require actual provider files
# This is tested manually or in integration tests
class TestAutoDiscovery:
    """Test auto-discovery functionality."""
    
    def test_auto_discover_with_invalid_directory(self, registry):
        """Test auto-discovery with invalid directory."""
        count = registry.auto_discover_providers("/nonexistent/path")
        assert count == 0
