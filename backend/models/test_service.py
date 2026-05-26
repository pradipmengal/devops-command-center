"""
Unit tests for ServiceEntry model.

Tests validation, field constraints, and helper methods for the unified
ServiceEntry schema used across the Multi-Cloud Cost Intelligence Platform.

Requirements:
    - Requirement 1.5: Unified Service Entry Schema validation
    - Requirement 5.1: Required fields validation
    - Requirement 5.2: Optional metadata fields
    - Requirement 8.1: Cost estimation calculations
"""

import pytest
from pydantic import ValidationError
from .service import ServiceEntry


class TestServiceEntryValidation:
    """Test validation rules for ServiceEntry fields."""
    
    def test_valid_service_entry_creation(self):
        """Test creating a valid ServiceEntry with all required fields."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="ec2-t3-medium-us-east-1",
            service_name="EC2 t3.medium",
            category="Compute (VMs)",
            region="us-east-1",
            price_usd=0.0416,
            unit="per hour",
            currency="USD"
        )
        
        assert entry.provider_id == "aws"
        assert entry.service_id == "ec2-t3-medium-us-east-1"
        assert entry.service_name == "EC2 t3.medium"
        assert entry.category == "Compute (VMs)"
        assert entry.region == "us-east-1"
        assert entry.price_usd == 0.0416
        assert entry.unit == "per hour"
        assert entry.currency == "USD"
        assert entry.metadata is None
    
    def test_valid_service_entry_with_metadata(self):
        """Test creating a ServiceEntry with optional metadata."""
        entry = ServiceEntry(
            provider_id="azure",
            service_id="vm-b2s-eastus",
            service_name="Azure VM B2s",
            category="Compute (VMs)",
            region="eastus",
            price_usd=0.0416,
            unit="per hour",
            currency="USD",
            metadata={
                "vcpu": 2,
                "memory_gb": 4.0,
                "tier_label": "Standard",
                "storage_gb": 100
            }
        )
        
        assert entry.metadata is not None
        assert entry.metadata["vcpu"] == 2
        assert entry.metadata["memory_gb"] == 4.0
        assert entry.metadata["tier_label"] == "Standard"
    
    def test_provider_id_normalized_to_lowercase(self):
        """Test that provider_id is normalized to lowercase."""
        entry = ServiceEntry(
            provider_id="AWS",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour"
        )
        
        assert entry.provider_id == "aws"
    
    def test_currency_normalized_to_uppercase(self):
        """Test that currency is normalized to uppercase."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour",
            currency="usd"
        )
        
        assert entry.currency == "USD"
    
    def test_price_usd_rounded_to_six_decimals(self):
        """Test that price_usd is rounded to 6 decimal places."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=0.04166666666666,
            unit="per hour"
        )
        
        assert entry.price_usd == 0.041667
    
    def test_missing_required_field_raises_error(self):
        """Test that missing required fields raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="aws",
                service_id="test",
                # Missing service_name
                category="Compute",
                region="us-east-1",
                price_usd=1.0,
                unit="per hour"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("service_name",) for error in errors)
    
    def test_empty_provider_id_raises_error(self):
        """Test that empty provider_id raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="",
                service_id="test",
                service_name="Test Service",
                category="Compute",
                region="us-east-1",
                price_usd=1.0,
                unit="per hour"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("provider_id",) for error in errors)
    
    def test_negative_price_raises_error(self):
        """Test that negative price_usd raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="aws",
                service_id="test",
                service_name="Test Service",
                category="Compute",
                region="us-east-1",
                price_usd=-1.0,
                unit="per hour"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("price_usd",) for error in errors)
    
    def test_excessive_price_raises_error(self):
        """Test that price_usd exceeding $1M raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="aws",
                service_id="test",
                service_name="Test Service",
                category="Compute",
                region="us-east-1",
                price_usd=1_000_001.0,
                unit="per hour"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("price_usd",) for error in errors)
    
    def test_invalid_currency_code_raises_error(self):
        """Test that invalid currency code raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="aws",
                service_id="test",
                service_name="Test Service",
                category="Compute",
                region="us-east-1",
                price_usd=1.0,
                unit="per hour",
                currency="US"  # Should be 3 letters
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("currency",) for error in errors)
    
    def test_invalid_provider_id_with_special_chars_raises_error(self):
        """Test that provider_id with invalid characters raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="aws@cloud",
                service_id="test",
                service_name="Test Service",
                category="Compute",
                region="us-east-1",
                price_usd=1.0,
                unit="per hour"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("provider_id",) for error in errors)
    
    def test_metadata_with_non_dict_raises_error(self):
        """Test that metadata with non-dict value raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceEntry(
                provider_id="aws",
                service_id="test",
                service_name="Test Service",
                category="Compute",
                region="us-east-1",
                price_usd=1.0,
                unit="per hour",
                metadata="invalid"  # Should be dict, not string
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("metadata",) for error in errors)


class TestServiceEntryHelperMethods:
    """Test helper methods for ServiceEntry."""
    
    def test_get_metadata_field_returns_value(self):
        """Test get_metadata_field returns existing field value."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour",
            metadata={"vcpu": 2, "memory_gb": 4.0}
        )
        
        assert entry.get_metadata_field("vcpu") == 2
        assert entry.get_metadata_field("memory_gb") == 4.0
    
    def test_get_metadata_field_returns_default_for_missing_field(self):
        """Test get_metadata_field returns default for missing field."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour",
            metadata={"vcpu": 2}
        )
        
        assert entry.get_metadata_field("nonexistent", "N/A") == "N/A"
        assert entry.get_metadata_field("missing", 0) == 0
    
    def test_get_metadata_field_returns_default_when_metadata_is_none(self):
        """Test get_metadata_field returns default when metadata is None."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour"
        )
        
        assert entry.get_metadata_field("vcpu", 0) == 0
    
    def test_calculate_monthly_cost_for_hourly_service(self):
        """Test calculate_monthly_cost for hourly-priced services."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=0.10,
            unit="per hour"
        )
        
        # Default 730 hours/month
        assert entry.calculate_monthly_cost() == 73.0
        
        # Custom usage hours
        assert entry.calculate_monthly_cost(500) == 50.0
    
    def test_calculate_monthly_cost_for_non_hourly_service(self):
        """Test calculate_monthly_cost for non-hourly services."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Storage",
            region="us-east-1",
            price_usd=0.023,
            unit="per GB-month"
        )
        
        # For non-hourly units, returns base price (rounded to 2 decimals)
        assert entry.calculate_monthly_cost() == 0.02
    
    def test_to_dict_returns_dictionary(self):
        """Test to_dict returns dictionary representation."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour",
            metadata={"vcpu": 2}
        )
        
        result = entry.to_dict()
        
        assert isinstance(result, dict)
        assert result["provider_id"] == "aws"
        assert result["service_id"] == "test"
        assert result["service_name"] == "Test Service"
        assert result["metadata"]["vcpu"] == 2
    
    def test_str_representation(self):
        """Test __str__ returns readable string."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="EC2 t3.medium",
            category="Compute (VMs)",
            region="us-east-1",
            price_usd=0.0416,
            unit="per hour"
        )
        
        result = str(entry)
        
        assert "aws" in result
        assert "EC2 t3.medium" in result
        assert "Compute (VMs)" in result
        assert "0.0416" in result
    
    def test_repr_representation(self):
        """Test __repr__ returns detailed string."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour"
        )
        
        result = repr(entry)
        
        assert "ServiceEntry(" in result
        assert "provider_id='aws'" in result
        assert "service_id='test'" in result


class TestServiceEntryEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_zero_price_is_valid(self):
        """Test that zero price is valid (free tier services)."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Free Tier Service",
            category="Compute",
            region="us-east-1",
            price_usd=0.0,
            unit="per hour"
        )
        
        assert entry.price_usd == 0.0
    
    def test_very_small_price_is_valid(self):
        """Test that very small prices are valid."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Storage",
            region="us-east-1",
            price_usd=0.000001,
            unit="per GB"
        )
        
        assert entry.price_usd == 0.000001
    
    def test_maximum_valid_price(self):
        """Test that maximum valid price ($1M) is accepted."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Enterprise Service",
            category="Support",
            region="us-east-1",
            price_usd=1_000_000.0,
            unit="per month"
        )
        
        assert entry.price_usd == 1_000_000.0
    
    def test_provider_id_with_hyphens_is_valid(self):
        """Test that provider_id with hyphens is valid."""
        entry = ServiceEntry(
            provider_id="digital-ocean",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="nyc1",
            price_usd=1.0,
            unit="per hour"
        )
        
        assert entry.provider_id == "digital-ocean"
    
    def test_provider_id_with_underscores_is_valid(self):
        """Test that provider_id with underscores is valid."""
        entry = ServiceEntry(
            provider_id="alibaba_cloud",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="cn-hangzhou",
            price_usd=1.0,
            unit="per hour"
        )
        
        assert entry.provider_id == "alibaba_cloud"
    
    def test_long_service_name_is_valid(self):
        """Test that long service names are accepted."""
        long_name = "A" * 200
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name=long_name,
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour"
        )
        
        assert entry.service_name == long_name
    
    def test_nested_metadata_is_valid(self):
        """Test that nested metadata structures are valid."""
        entry = ServiceEntry(
            provider_id="aws",
            service_id="test",
            service_name="Test Service",
            category="Compute",
            region="us-east-1",
            price_usd=1.0,
            unit="per hour",
            metadata={
                "specs": {
                    "vcpu": 2,
                    "memory_gb": 4.0
                },
                "features": ["ssd", "network-optimized"]
            }
        )
        
        assert entry.metadata["specs"]["vcpu"] == 2
        assert "ssd" in entry.metadata["features"]
    
    def test_whitespace_is_stripped_from_strings(self):
        """Test that whitespace is stripped from string fields."""
        entry = ServiceEntry(
            provider_id="  aws  ",
            service_id="  test  ",
            service_name="  Test Service  ",
            category="  Compute  ",
            region="  us-east-1  ",
            price_usd=1.0,
            unit="  per hour  "
        )
        
        assert entry.provider_id == "aws"
        assert entry.service_id == "test"
        assert entry.service_name == "Test Service"
        assert entry.category == "Compute"
        assert entry.region == "us-east-1"
        assert entry.unit == "per hour"
