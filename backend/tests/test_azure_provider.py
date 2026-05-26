"""
Unit tests for Azure Provider Plugin.

Tests the AzureProvider implementation including service catalog fetching,
pricing data retrieval, region listing, and credential validation.
"""

import pytest
from datetime import datetime
from backend.providers.azure import AzureProvider
from backend.models.service import ServiceCategory, PricingTier


class TestAzureProvider:
    """Test cases for AzureProvider."""
    
    @pytest.fixture
    def azure_provider(self):
        """Create an AzureProvider instance for testing."""
        return AzureProvider()
    
    def test_provider_initialization(self, azure_provider):
        """Test that AzureProvider initializes with correct metadata."""
        assert azure_provider.provider_id == "azure"
        assert azure_provider.provider_name == "Microsoft Azure"
        assert azure_provider.api_version == "1.0"
        assert azure_provider.rate_limit == 10
    
    def test_provider_metadata(self, azure_provider):
        """Test get_metadata returns correct provider information."""
        metadata = azure_provider.get_metadata()
        
        assert metadata["provider_id"] == "azure"
        assert metadata["provider_name"] == "Microsoft Azure"
        assert metadata["api_version"] == "1.0"
        assert metadata["rate_limit"] == 10
        assert "timestamp" in metadata
    
    def test_map_category_vm(self, azure_provider):
        """Test category mapping for Virtual Machines."""
        category = azure_provider._map_category("VM Instance", "Virtual Machines")
        assert category == ServiceCategory.COMPUTE_VMS.value
    
    def test_map_category_storage(self, azure_provider):
        """Test category mapping for Storage."""
        category = azure_provider._map_category("Blob Storage", "Storage")
        assert category == ServiceCategory.OBJECT_STORAGE.value
    
    def test_map_category_sql(self, azure_provider):
        """Test category mapping for SQL Database."""
        category = azure_provider._map_category("SQL Database", "SQL Database")
        assert category == ServiceCategory.RELATIONAL_DATABASE.value
    
    def test_map_category_functions(self, azure_provider):
        """Test category mapping for Functions."""
        category = azure_provider._map_category("Function App", "Functions")
        assert category == ServiceCategory.SERVERLESS_FUNCTIONS.value
    
    def test_map_category_aks(self, azure_provider):
        """Test category mapping for AKS."""
        category = azure_provider._map_category("AKS Cluster", "Azure Kubernetes Service")
        assert category == ServiceCategory.MANAGED_KUBERNETES.value
    
    def test_map_category_unknown(self, azure_provider):
        """Test category mapping for unknown services."""
        category = azure_provider._map_category("Unknown Service", "UnknownFamily")
        assert category == ServiceCategory.OTHER.value
    
    def test_map_pricing_tier_on_demand(self, azure_provider):
        """Test pricing tier mapping for On-Demand."""
        tier = azure_provider._map_pricing_tier(None)
        assert tier == PricingTier.ON_DEMAND.value
    
    def test_map_pricing_tier_spot(self, azure_provider):
        """Test pricing tier mapping for Spot."""
        tier = azure_provider._map_pricing_tier("Spot")
        assert tier == PricingTier.SPOT.value
    
    def test_map_pricing_tier_reserved(self, azure_provider):
        """Test pricing tier mapping for Reserved."""
        tier = azure_provider._map_pricing_tier("Reserved")
        assert tier == PricingTier.RESERVED.value
    
    def test_parse_vm_specs_b2s(self, azure_provider):
        """Test parsing VM specs for Standard_B2s."""
        specs = azure_provider._parse_vm_specs("Standard_B2s")
        assert specs["vcpu"] == 2
        assert specs["memory_gb"] == 4.0
    
    def test_parse_vm_specs_d4s_v3(self, azure_provider):
        """Test parsing VM specs for Standard_D4s_v3."""
        specs = azure_provider._parse_vm_specs("Standard_D4s_v3")
        assert specs["vcpu"] == 4
        assert specs["memory_gb"] == 16.0
    
    def test_parse_vm_specs_unknown(self, azure_provider):
        """Test parsing VM specs for unknown SKU."""
        specs = azure_provider._parse_vm_specs("Standard_Unknown")
        assert specs["vcpu"] is None
        assert specs["memory_gb"] is None
    
    @pytest.mark.asyncio
    async def test_get_service_catalog_no_filters(self, azure_provider):
        """Test fetching service catalog without filters."""
        services = await azure_provider.get_service_catalog()
        
        assert isinstance(services, list)
        assert len(services) > 0
        
        # Check first service has required fields
        first_service = services[0]
        assert "provider" in first_service
        assert "category" in first_service
        assert "service_name" in first_service
        assert "unit" in first_service
        assert "price_usd" in first_service
        assert "tier_label" in first_service
        assert first_service["provider"] == "azure"
    
    @pytest.mark.asyncio
    async def test_get_service_catalog_with_region_filter(self, azure_provider):
        """Test fetching service catalog with region filter."""
        services = await azure_provider.get_service_catalog(region="eastus")
        
        assert isinstance(services, list)
        assert len(services) > 0
        
        # All services should be from eastus
        for service in services:
            assert service.get("region") == "eastus"
    
    @pytest.mark.asyncio
    async def test_get_service_catalog_with_category_filter(self, azure_provider):
        """Test fetching service catalog with category filter."""
        services = await azure_provider.get_service_catalog(
            category=ServiceCategory.COMPUTE_VMS.value
        )
        
        assert isinstance(services, list)
        assert len(services) > 0
        
        # All services should be Compute (VMs)
        for service in services:
            assert service.get("category") == ServiceCategory.COMPUTE_VMS.value
    
    @pytest.mark.asyncio
    async def test_fetch_vm_pricing(self, azure_provider):
        """Test fetching Azure VM pricing."""
        vm_services = await azure_provider._fetch_vm_pricing()
        
        assert isinstance(vm_services, list)
        assert len(vm_services) > 0
        
        # Check VM structure
        for service in vm_services:
            assert service["provider"] == "azure"
            assert service["category"] == ServiceCategory.COMPUTE_VMS.value
            assert "Azure VM" in service["service_name"]
            assert service["unit"] == "per hour"
            assert service["price_usd"] > 0
            assert service["tier_label"] == PricingTier.ON_DEMAND.value
            assert "vcpu" in service
            assert "memory_gb" in service
            assert service["is_fallback"] is True
    
    @pytest.mark.asyncio
    async def test_fetch_vm_pricing_with_region(self, azure_provider):
        """Test fetching VM pricing with region filter."""
        vm_services = await azure_provider._fetch_vm_pricing(region="eastus")
        
        assert isinstance(vm_services, list)
        assert len(vm_services) > 0
        
        # All VMs should be from eastus
        for service in vm_services:
            assert service["region"] == "eastus"
    
    @pytest.mark.asyncio
    async def test_fetch_storage_pricing(self, azure_provider):
        """Test fetching Azure Storage pricing."""
        storage_services = await azure_provider._fetch_storage_pricing()
        
        assert isinstance(storage_services, list)
        assert len(storage_services) > 0
        
        # Check Storage structure
        for service in storage_services:
            assert service["provider"] == "azure"
            assert service["category"] == ServiceCategory.OBJECT_STORAGE.value
            assert "Azure" in service["service_name"]
            assert service["unit"] == "per GB-month"
            assert service["price_usd"] > 0
            assert service["tier_label"] == PricingTier.ON_DEMAND.value
            assert service["is_fallback"] is True
    
    @pytest.mark.asyncio
    async def test_fetch_storage_pricing_with_region(self, azure_provider):
        """Test fetching Storage pricing with region filter."""
        storage_services = await azure_provider._fetch_storage_pricing(region="eastus")
        
        assert isinstance(storage_services, list)
        assert len(storage_services) > 0
        
        # All storage types should be from eastus
        for service in storage_services:
            assert service["region"] == "eastus"
    
    def test_get_fallback_data_no_filters(self, azure_provider):
        """Test getting fallback data without filters."""
        fallback_data = azure_provider._get_fallback_data()
        
        assert isinstance(fallback_data, list)
        assert len(fallback_data) > 0
        
        # Check fallback data structure
        for service in fallback_data:
            assert service["provider"] == "azure"
            assert service["is_fallback"] is True
    
    def test_get_fallback_data_with_region_filter(self, azure_provider):
        """Test getting fallback data with region filter."""
        fallback_data = azure_provider._get_fallback_data(region="eastus")
        
        assert isinstance(fallback_data, list)
        assert len(fallback_data) > 0
        
        # All services should be from eastus
        for service in fallback_data:
            assert service.get("region") == "eastus"
    
    def test_get_fallback_data_with_category_filter(self, azure_provider):
        """Test getting fallback data with category filter."""
        fallback_data = azure_provider._get_fallback_data(
            category=ServiceCategory.COMPUTE_VMS.value
        )
        
        assert isinstance(fallback_data, list)
        assert len(fallback_data) > 0
        
        # All services should be Compute (VMs)
        for service in fallback_data:
            assert service.get("category") == ServiceCategory.COMPUTE_VMS.value
    
    @pytest.mark.asyncio
    async def test_get_pricing_data(self, azure_provider):
        """Test fetching detailed pricing data for a service."""
        pricing_data = await azure_provider.get_pricing_data("Virtual Machines")
        
        assert isinstance(pricing_data, dict)
        assert pricing_data["service_id"] == "Virtual Machines"
        assert "service_name" in pricing_data
        assert "base_price" in pricing_data
        assert "pricing_tiers" in pricing_data
        assert "regional_pricing" in pricing_data
        assert "metadata" in pricing_data
    
    @pytest.mark.asyncio
    async def test_get_pricing_data_with_region(self, azure_provider):
        """Test fetching pricing data with region specified."""
        pricing_data = await azure_provider.get_pricing_data(
            "Virtual Machines",
            region="westus"
        )
        
        assert isinstance(pricing_data, dict)
        assert pricing_data["service_id"] == "Virtual Machines"
    
    @pytest.mark.asyncio
    async def test_get_regions(self, azure_provider):
        """Test fetching list of Azure regions."""
        regions = await azure_provider.get_regions()
        
        assert isinstance(regions, list)
        assert len(regions) > 0
        
        # Check region structure
        for region in regions:
            assert "region_id" in region
            assert "region_name" in region
            assert "location" in region
        
        # Check for common regions
        region_ids = [r["region_id"] for r in regions]
        assert "eastus" in region_ids
        assert "westus" in region_ids
        assert "westeurope" in region_ids
    
    @pytest.mark.asyncio
    async def test_validate_credentials(self, azure_provider):
        """Test credential validation (should always return True for public API)."""
        is_valid = await azure_provider.validate_credentials()
        assert is_valid is True
        
        # Should also return True with API key (not used)
        is_valid_with_key = await azure_provider.validate_credentials(api_key="test-key")
        assert is_valid_with_key is True
    
    @pytest.mark.asyncio
    async def test_close_http_client(self, azure_provider):
        """Test closing HTTP client."""
        # Get client to initialize it
        client = azure_provider._get_http_client()
        assert client is not None
        
        # Close client
        await azure_provider.close()
        assert azure_provider._http_client is None
    
    def test_provider_repr(self, azure_provider):
        """Test string representation of provider."""
        repr_str = repr(azure_provider)
        assert "AzureProvider" in repr_str
        assert "provider_id='azure'" in repr_str
        assert "provider_name='Microsoft Azure'" in repr_str
