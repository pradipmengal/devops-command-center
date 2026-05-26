"""
Unit tests for AWS Provider Plugin.

Tests the AWSProvider implementation including service catalog fetching,
pricing data retrieval, region listing, and credential validation.
"""

import pytest
from datetime import datetime
from backend.providers.aws import AWSProvider
from backend.models.service import ServiceCategory, PricingTier


class TestAWSProvider:
    """Test cases for AWSProvider."""
    
    @pytest.fixture
    def aws_provider(self):
        """Create an AWSProvider instance for testing."""
        return AWSProvider()
    
    def test_provider_initialization(self, aws_provider):
        """Test that AWSProvider initializes with correct metadata."""
        assert aws_provider.provider_id == "aws"
        assert aws_provider.provider_name == "Amazon Web Services"
        assert aws_provider.api_version == "1.0"
        assert aws_provider.rate_limit == 10
    
    def test_provider_metadata(self, aws_provider):
        """Test get_metadata returns correct provider information."""
        metadata = aws_provider.get_metadata()
        
        assert metadata["provider_id"] == "aws"
        assert metadata["provider_name"] == "Amazon Web Services"
        assert metadata["api_version"] == "1.0"
        assert metadata["rate_limit"] == 10
        assert "timestamp" in metadata
    
    def test_map_category_ec2(self, aws_provider):
        """Test category mapping for EC2 services."""
        category = aws_provider._map_category("EC2 Instance", "AmazonEC2")
        assert category == "Compute (VMs)"
    
    def test_map_category_s3(self, aws_provider):
        """Test category mapping for S3 services."""
        category = aws_provider._map_category("S3 Storage", "AmazonS3")
        assert category == "Object Storage"
    
    def test_map_category_rds(self, aws_provider):
        """Test category mapping for RDS services."""
        category = aws_provider._map_category("RDS Database", "AmazonRDS")
        assert category == "Relational Database"
    
    def test_map_category_lambda(self, aws_provider):
        """Test category mapping for Lambda services."""
        category = aws_provider._map_category("Lambda Function", "AWSLambda")
        assert category == "Serverless Functions"
    
    def test_map_category_eks(self, aws_provider):
        """Test category mapping for EKS services."""
        category = aws_provider._map_category("EKS Cluster", "AmazonEKS")
        assert category == "Managed Kubernetes"
    
    def test_map_category_unknown(self, aws_provider):
        """Test category mapping for unknown services."""
        category = aws_provider._map_category("Unknown Service", "UnknownCode")
        assert category == ServiceCategory.OTHER.value
    
    def test_map_pricing_tier_on_demand(self, aws_provider):
        """Test pricing tier mapping for On-Demand."""
        tier = aws_provider._map_pricing_tier("OnDemand")
        assert tier == PricingTier.ON_DEMAND.value
    
    def test_map_pricing_tier_reserved(self, aws_provider):
        """Test pricing tier mapping for Reserved."""
        tier = aws_provider._map_pricing_tier("Reserved")
        assert tier == PricingTier.RESERVED.value
    
    def test_map_pricing_tier_spot(self, aws_provider):
        """Test pricing tier mapping for Spot."""
        tier = aws_provider._map_pricing_tier("Spot")
        assert tier == PricingTier.SPOT.value
    
    @pytest.mark.asyncio
    async def test_get_service_catalog_no_filters(self, aws_provider):
        """Test fetching service catalog without filters."""
        services = await aws_provider.get_service_catalog()
        
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
        assert first_service["provider"] == "aws"
    
    @pytest.mark.asyncio
    async def test_get_service_catalog_with_region_filter(self, aws_provider):
        """Test fetching service catalog with region filter."""
        services = await aws_provider.get_service_catalog(region="us-east-1")
        
        assert isinstance(services, list)
        assert len(services) > 0
        
        # All services should be from us-east-1
        for service in services:
            assert service.get("region") == "us-east-1"
    
    @pytest.mark.asyncio
    async def test_get_service_catalog_with_category_filter(self, aws_provider):
        """Test fetching service catalog with category filter."""
        services = await aws_provider.get_service_catalog(
            category=ServiceCategory.COMPUTE_VMS.value
        )
        
        assert isinstance(services, list)
        assert len(services) > 0
        
        # All services should be Compute (VMs)
        for service in services:
            assert service.get("category") == ServiceCategory.COMPUTE_VMS.value
    
    @pytest.mark.asyncio
    async def test_fetch_ec2_pricing(self, aws_provider):
        """Test fetching EC2 instance pricing."""
        ec2_services = await aws_provider._fetch_ec2_pricing()
        
        assert isinstance(ec2_services, list)
        assert len(ec2_services) > 0
        
        # Check EC2 instance structure
        for service in ec2_services:
            assert service["provider"] == "aws"
            assert service["category"] == ServiceCategory.COMPUTE_VMS.value
            assert "EC2" in service["service_name"]
            assert service["unit"] == "per hour"
            assert service["price_usd"] > 0
            assert service["tier_label"] == PricingTier.ON_DEMAND.value
            assert "vcpu" in service
            assert "memory_gb" in service
            assert service["is_fallback"] is True
    
    @pytest.mark.asyncio
    async def test_fetch_ec2_pricing_with_region(self, aws_provider):
        """Test fetching EC2 pricing with region filter."""
        ec2_services = await aws_provider._fetch_ec2_pricing(region="us-east-1")
        
        assert isinstance(ec2_services, list)
        assert len(ec2_services) > 0
        
        # All instances should be from us-east-1
        for service in ec2_services:
            assert service["region"] == "us-east-1"
    
    @pytest.mark.asyncio
    async def test_fetch_s3_pricing(self, aws_provider):
        """Test fetching S3 storage pricing."""
        s3_services = await aws_provider._fetch_s3_pricing()
        
        assert isinstance(s3_services, list)
        assert len(s3_services) > 0
        
        # Check S3 storage structure
        for service in s3_services:
            assert service["provider"] == "aws"
            assert service["category"] == ServiceCategory.OBJECT_STORAGE.value
            assert "S3" in service["service_name"]
            assert service["unit"] == "per GB-month"
            assert service["price_usd"] > 0
            assert service["tier_label"] == PricingTier.ON_DEMAND.value
            assert service["is_fallback"] is True
    
    @pytest.mark.asyncio
    async def test_fetch_s3_pricing_with_region(self, aws_provider):
        """Test fetching S3 pricing with region filter."""
        s3_services = await aws_provider._fetch_s3_pricing(region="us-east-1")
        
        assert isinstance(s3_services, list)
        assert len(s3_services) > 0
        
        # All storage classes should be from us-east-1
        for service in s3_services:
            assert service["region"] == "us-east-1"
    
    def test_get_fallback_data_no_filters(self, aws_provider):
        """Test getting fallback data without filters."""
        fallback_data = aws_provider._get_fallback_data()
        
        assert isinstance(fallback_data, list)
        assert len(fallback_data) > 0
        
        # Check fallback data structure
        for service in fallback_data:
            assert service["provider"] == "aws"
            assert service["is_fallback"] is True
    
    def test_get_fallback_data_with_region_filter(self, aws_provider):
        """Test getting fallback data with region filter."""
        fallback_data = aws_provider._get_fallback_data(region="us-east-1")
        
        assert isinstance(fallback_data, list)
        assert len(fallback_data) > 0
        
        # All services should be from us-east-1
        for service in fallback_data:
            assert service.get("region") == "us-east-1"
    
    def test_get_fallback_data_with_category_filter(self, aws_provider):
        """Test getting fallback data with category filter."""
        fallback_data = aws_provider._get_fallback_data(
            category=ServiceCategory.COMPUTE_VMS.value
        )
        
        assert isinstance(fallback_data, list)
        assert len(fallback_data) > 0
        
        # All services should be Compute (VMs)
        for service in fallback_data:
            assert service.get("category") == ServiceCategory.COMPUTE_VMS.value
    
    @pytest.mark.asyncio
    async def test_get_pricing_data(self, aws_provider):
        """Test fetching detailed pricing data for a service."""
        pricing_data = await aws_provider.get_pricing_data("AmazonEC2")
        
        assert isinstance(pricing_data, dict)
        assert pricing_data["service_id"] == "AmazonEC2"
        assert "service_name" in pricing_data
        assert "base_price" in pricing_data
        assert "pricing_tiers" in pricing_data
        assert "regional_pricing" in pricing_data
        assert "metadata" in pricing_data
    
    @pytest.mark.asyncio
    async def test_get_pricing_data_with_region(self, aws_provider):
        """Test fetching pricing data with region specified."""
        pricing_data = await aws_provider.get_pricing_data(
            "AmazonEC2",
            region="us-west-2"
        )
        
        assert isinstance(pricing_data, dict)
        assert pricing_data["service_id"] == "AmazonEC2"
    
    @pytest.mark.asyncio
    async def test_get_regions(self, aws_provider):
        """Test fetching list of AWS regions."""
        regions = await aws_provider.get_regions()
        
        assert isinstance(regions, list)
        assert len(regions) > 0
        
        # Check region structure
        for region in regions:
            assert "region_id" in region
            assert "region_name" in region
            assert "location" in region
        
        # Check for common regions
        region_ids = [r["region_id"] for r in regions]
        assert "us-east-1" in region_ids
        assert "us-west-2" in region_ids
        assert "eu-west-1" in region_ids
    
    @pytest.mark.asyncio
    async def test_validate_credentials(self, aws_provider):
        """Test credential validation (should always return True for public API)."""
        is_valid = await aws_provider.validate_credentials()
        assert is_valid is True
        
        # Should also return True with API key (not used)
        is_valid_with_key = await aws_provider.validate_credentials(api_key="test-key")
        assert is_valid_with_key is True
    
    @pytest.mark.asyncio
    async def test_close_http_client(self, aws_provider):
        """Test closing HTTP client."""
        # Get client to initialize it
        client = aws_provider._get_http_client()
        assert client is not None
        
        # Close client
        await aws_provider.close()
        assert aws_provider._http_client is None
    
    def test_provider_repr(self, aws_provider):
        """Test string representation of provider."""
        repr_str = repr(aws_provider)
        assert "AWSProvider" in repr_str
        assert "provider_id='aws'" in repr_str
        assert "provider_name='Amazon Web Services'" in repr_str
