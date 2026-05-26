"""
Abstract base class for cloud provider plugins.

This module defines the ProviderPlugin interface that all provider implementations
must conform to. It ensures consistent behavior across different cloud providers
(AWS, Azure, GCP, etc.) for fetching service catalogs, pricing data, and metadata.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone


class ProviderPlugin(ABC):
    """
    Abstract base class for cloud provider plugins.
    
    All provider implementations (AWS, Azure, GCP, etc.) must inherit from this
    class and implement all abstract methods. This ensures a consistent interface
    for the pricing abstraction layer to interact with different providers.
    
    Common Properties:
        provider_id (str): Unique identifier for the provider (e.g., "aws", "azure", "gcp")
        provider_name (str): Human-readable provider name (e.g., "Amazon Web Services")
        api_version (str): Version of the provider's pricing API being used
        rate_limit (int): Maximum requests per minute allowed for this provider
    
    Requirements:
        - Requirement 1.1: Provider Interface definition
        - Requirement 1.2: Provider metadata
        - Requirement 1.3: Credential validation
    """
    
    def __init__(
        self,
        provider_id: str,
        provider_name: str,
        api_version: str = "1.0",
        rate_limit: int = 10
    ):
        """
        Initialize the provider plugin with common properties.
        
        Args:
            provider_id: Unique identifier for the provider (e.g., "aws", "azure", "gcp")
            provider_name: Human-readable provider name (e.g., "Amazon Web Services")
            api_version: Version of the provider's pricing API (default: "1.0")
            rate_limit: Maximum requests per minute (default: 10)
        """
        self._provider_id = provider_id
        self._provider_name = provider_name
        self._api_version = api_version
        self._rate_limit = rate_limit
    
    @property
    def provider_id(self) -> str:
        """Get the unique provider identifier."""
        return self._provider_id
    
    @property
    def provider_name(self) -> str:
        """Get the human-readable provider name."""
        return self._provider_name
    
    @property
    def api_version(self) -> str:
        """Get the API version being used."""
        return self._api_version
    
    @property
    def rate_limit(self) -> int:
        """Get the rate limit (requests per minute)."""
        return self._rate_limit
    
    @abstractmethod
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Fetch the complete service catalog from the provider's API.
        
        This method retrieves all available services with their pricing information
        from the provider's pricing API. Results should be normalized to the unified
        ServiceEntry schema before returning.
        
        Args:
            region: Optional region filter (e.g., "us-east-1", "eastus", "us-central1")
            category: Optional category filter (e.g., "Compute", "Storage", "Database")
            force_refresh: If True, bypass cache and fetch fresh data from API
        
        Returns:
            List of service entries in unified schema format. Each entry should contain:
            - provider: Provider ID (str)
            - category: Logical category (str)
            - service_name: Service name (str)
            - unit: Pricing unit (str)
            - price_usd: Base price in USD (float)
            - tier_label: Pricing tier (str)
            - region: Geographic region (Optional[str])
            - metadata: Additional provider-specific data (Optional[Dict])
            - fetched_at: Timestamp when data was fetched (datetime)
        
        Raises:
            ProviderAPIError: If the provider's API returns an error
            RateLimitError: If rate limit is exceeded
            ValidationError: If returned data doesn't conform to schema
        
        Requirements:
            - Requirement 1.1: Provider Interface implementation
            - Requirement 3.1: Real-time service discovery
            - Requirement 3.2: Service catalog caching
        """
        pass
    
    @abstractmethod
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch detailed pricing data for a specific service.
        
        This method retrieves comprehensive pricing information for a single service,
        including all pricing tiers, regional variations, and metadata.
        
        Args:
            service_id: Provider-specific service identifier
            region: Optional region to get region-specific pricing
        
        Returns:
            Dictionary containing detailed pricing data:
            - service_id: Service identifier (str)
            - service_name: Service name (str)
            - base_price: Base price in USD (float)
            - pricing_tiers: List of available pricing tiers (List[Dict])
            - regional_pricing: Price variations by region (Dict[str, float])
            - metadata: Additional service metadata (Dict)
        
        Raises:
            ProviderAPIError: If the provider's API returns an error
            ServiceNotFoundError: If the service_id doesn't exist
            RateLimitError: If rate limit is exceeded
        
        Requirements:
            - Requirement 1.1: Provider Interface implementation
            - Requirement 3.3: Detailed pricing data fetching
        """
        pass
    
    @abstractmethod
    async def get_regions(self) -> List[Dict[str, str]]:
        """
        Get the list of available regions for this provider.
        
        This method retrieves all geographic regions where the provider offers services.
        
        Returns:
            List of region dictionaries, each containing:
            - region_id: Provider-specific region identifier (str)
            - region_name: Human-readable region name (str)
            - location: Geographic location description (str)
        
        Example:
            [
                {
                    "region_id": "us-east-1",
                    "region_name": "US East (N. Virginia)",
                    "location": "North America"
                },
                {
                    "region_id": "eu-west-1",
                    "region_name": "EU (Ireland)",
                    "location": "Europe"
                }
            ]
        
        Raises:
            ProviderAPIError: If the provider's API returns an error
        
        Requirements:
            - Requirement 1.1: Provider Interface implementation
            - Requirement 16.1: Regional pricing support
        """
        pass
    
    @abstractmethod
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        """
        Validate API credentials if required by the provider.
        
        Some providers require authentication to access their pricing APIs, while
        others provide public access. This method validates credentials and returns
        whether they are valid or if authentication is not required.
        
        Args:
            api_key: Optional API key for authenticated access
            **kwargs: Additional provider-specific authentication parameters
                     (e.g., secret_key, access_token, client_id)
        
        Returns:
            True if credentials are valid or not required, False if invalid
        
        Raises:
            AuthenticationError: If authentication fails with invalid credentials
        
        Requirements:
            - Requirement 1.1: Provider Interface implementation
            - Requirement 1.3: Credential validation
        
        Example:
            # For providers with public APIs (no auth required)
            >>> await provider.validate_credentials()
            True
            
            # For providers requiring API keys
            >>> await provider.validate_credentials(api_key="sk-...")
            True
        """
        pass
    
    def get_metadata(self) -> Dict[str, Any]:
        """
        Get provider metadata including name, version, and configuration.
        
        This is a concrete method that returns common metadata about the provider.
        Subclasses can override this to add provider-specific metadata.
        
        Returns:
            Dictionary containing provider metadata:
            - provider_id: Unique provider identifier (str)
            - provider_name: Human-readable name (str)
            - api_version: API version (str)
            - rate_limit: Requests per minute limit (int)
            - timestamp: Current timestamp (str)
        
        Requirements:
            - Requirement 1.2: Provider metadata retrieval
        """
        return {
            "provider_id": self.provider_id,
            "provider_name": self.provider_name,
            "api_version": self.api_version,
            "rate_limit": self.rate_limit,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def __repr__(self) -> str:
        """String representation of the provider plugin."""
        return (
            f"{self.__class__.__name__}("
            f"provider_id='{self.provider_id}', "
            f"provider_name='{self.provider_name}', "
            f"api_version='{self.api_version}', "
            f"rate_limit={self.rate_limit})"
        )
