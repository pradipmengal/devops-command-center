"""
Example usage of ProviderRegistry.

This script demonstrates how to use the ProviderRegistry singleton to manage
cloud provider plugins in the Multi-Cloud Cost Intelligence Platform.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.providers.registry import ProviderRegistry
from backend.providers.base import ProviderPlugin
from typing import List, Dict, Optional, Any


# Example: Create a simple mock provider
class ExampleProvider(ProviderPlugin):
    """Example provider implementation for demonstration."""
    
    def __init__(self):
        super().__init__(
            provider_id="example",
            provider_name="Example Cloud Provider",
            api_version="1.0",
            rate_limit=10
        )
    
    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Return a sample service catalog."""
        return [
            {
                "provider": "example",
                "category": "Compute",
                "service_name": "Example VM Small",
                "unit": "per hour",
                "price_usd": 0.05,
                "tier_label": "On-Demand",
                "region": region or "us-east-1"
            },
            {
                "provider": "example",
                "category": "Storage",
                "service_name": "Example Object Storage",
                "unit": "per GB-month",
                "price_usd": 0.023,
                "tier_label": "Standard",
                "region": region or "us-east-1"
            }
        ]
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """Return sample pricing data for a service."""
        return {
            "service_id": service_id,
            "service_name": "Example VM Small",
            "base_price": 0.05,
            "pricing_tiers": [
                {"tier": "On-Demand", "price": 0.05},
                {"tier": "Reserved", "price": 0.03}
            ],
            "regional_pricing": {
                "us-east-1": 0.05,
                "us-west-2": 0.052,
                "eu-west-1": 0.056
            },
            "metadata": {
                "vcpu": 2,
                "memory_gb": 4,
                "storage_gb": 50
            }
        }
    
    async def get_regions(self) -> List[Dict[str, str]]:
        """Return available regions."""
        return [
            {
                "region_id": "us-east-1",
                "region_name": "US East",
                "location": "North America"
            },
            {
                "region_id": "us-west-2",
                "region_name": "US West",
                "location": "North America"
            },
            {
                "region_id": "eu-west-1",
                "region_name": "EU West",
                "location": "Europe"
            }
        ]
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        """Validate credentials (no auth required for this example)."""
        return True


async def main():
    """Demonstrate ProviderRegistry usage."""
    
    print("=" * 70)
    print("ProviderRegistry Example Usage")
    print("=" * 70)
    print()
    
    # 1. Get the singleton instance
    print("1. Getting ProviderRegistry singleton instance...")
    registry = ProviderRegistry.get_instance()
    print(f"   Registry: {registry}")
    print()
    
    # 2. Create and register a provider
    print("2. Creating and registering an example provider...")
    example_provider = ExampleProvider()
    registry.register_provider(example_provider, enabled=True)
    print(f"   Registered: {example_provider.provider_id} - {example_provider.provider_name}")
    print(f"   Total providers: {registry.get_provider_count()}")
    print()
    
    # 3. Retrieve a provider
    print("3. Retrieving the provider by ID...")
    retrieved = registry.get_provider("example")
    if retrieved:
        print(f"   Found: {retrieved.provider_name}")
        print(f"   Metadata: {retrieved.get_metadata()}")
    print()
    
    # 4. List all providers
    print("4. Listing all registered providers...")
    all_providers = registry.list_providers()
    for provider in all_providers:
        enabled = "✓" if registry.is_provider_enabled(provider.provider_id) else "✗"
        print(f"   [{enabled}] {provider.provider_id}: {provider.provider_name}")
    print()
    
    # 5. Get enabled providers only
    print("5. Getting enabled providers...")
    enabled_providers = registry.get_enabled_providers()
    print(f"   Enabled count: {len(enabled_providers)}")
    for provider in enabled_providers:
        print(f"   - {provider.provider_id}: {provider.provider_name}")
    print()
    
    # 6. Disable a provider
    print("6. Disabling the example provider...")
    registry.disable_provider("example")
    print(f"   Is enabled: {registry.is_provider_enabled('example')}")
    print(f"   Enabled providers: {registry.get_enabled_provider_count()}")
    print()
    
    # 7. Re-enable the provider
    print("7. Re-enabling the example provider...")
    registry.enable_provider("example")
    print(f"   Is enabled: {registry.is_provider_enabled('example')}")
    print()
    
    # 8. Use the provider to fetch data
    print("8. Using the provider to fetch service catalog...")
    catalog = await example_provider.get_service_catalog(region="us-east-1")
    print(f"   Services found: {len(catalog)}")
    for service in catalog:
        print(f"   - {service['service_name']}: ${service['price_usd']}/{service['unit']}")
    print()
    
    # 9. Get pricing data for a specific service
    print("9. Getting detailed pricing data...")
    pricing = await example_provider.get_pricing_data("vm-small", region="us-east-1")
    print(f"   Service: {pricing['service_name']}")
    print(f"   Base price: ${pricing['base_price']}/hour")
    print(f"   Pricing tiers: {len(pricing['pricing_tiers'])}")
    for tier in pricing['pricing_tiers']:
        print(f"     - {tier['tier']}: ${tier['price']}/hour")
    print()
    
    # 10. Get available regions
    print("10. Getting available regions...")
    regions = await example_provider.get_regions()
    print(f"    Regions available: {len(regions)}")
    for region in regions:
        print(f"    - {region['region_id']}: {region['region_name']} ({region['location']})")
    print()
    
    # 11. Unregister the provider
    print("11. Unregistering the provider...")
    registry.unregister_provider("example")
    print(f"    Total providers: {registry.get_provider_count()}")
    print()
    
    # 12. Auto-discovery (would discover actual provider files)
    print("12. Auto-discovery of providers...")
    print("    Note: This would discover provider plugins from the providers directory")
    print("    In a real scenario, you would have aws.py, azure.py, gcp.py files")
    discovered_count = registry.auto_discover_providers()
    print(f"    Discovered: {discovered_count} providers")
    print()
    
    print("=" * 70)
    print("Example completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
