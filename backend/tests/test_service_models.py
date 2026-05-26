"""
Unit tests for unified service data models.

Tests the ServiceEntry, Provider, OptimizationSuggestion, CostScenario,
and HealthStatus models to ensure proper validation, serialization, and behavior.
"""

import pytest
from datetime import datetime, timezone
from backend.models.service import (
    ServiceEntry,
    Provider,
    OptimizationSuggestion,
    CostScenario,
    HealthStatus,
    PricingTier,
    ServiceCategory
)


class TestServiceEntry:
    """Test cases for ServiceEntry model."""
    
    def test_create_service_entry_with_required_fields(self):
        """Test creating a ServiceEntry with only required fields."""
        entry = ServiceEntry(
            provider="aws",
            category=ServiceCategory.COMPUTE_VMS,
            service_name="EC2 t3.medium",
            unit="per hour",
            price_usd=0.0416,
            tier_label=PricingTier.ON_DEMAND
        )
        
        assert entry.provider == "aws"
        assert entry.category == ServiceCategory.COMPUTE_VMS
        assert entry.service_name == "EC2 t3.medium"
        assert entry.unit == "per hour"
        assert entry.price_usd == 0.0416
        assert entry.tier_label == PricingTier.ON_DEMAND
        assert entry.region is None
        assert entry.vcpu is None
        assert entry.is_fallback is False
        assert entry.is_anomaly is False
        assert isinstance(entry.fetched_at, datetime)
        assert isinstance(entry.metadata, dict)
    
    def test_create_service_entry_with_all_fields(self):
        """Test creating a ServiceEntry with all fields populated."""
        fetched_time = datetime.now(timezone.utc)
        entry = ServiceEntry(
            provider="azure",
            category=ServiceCategory.COMPUTE_VMS,
            service_name="Azure VM B2s",
            unit="per hour",
            price_usd=0.0416,
            tier_label=PricingTier.ON_DEMAND,
            region="eastus",
            vcpu=2,
            memory_gb=4.0,
            storage_gb=100.0,
            network_egress_gb=10.0,
            iops=3000,
            api_calls_per_month=1000000,
            metadata={"family": "B-series", "burstable": True},
            fetched_at=fetched_time,
            is_fallback=True,
            is_anomaly=False
        )
        
        assert entry.provider == "azure"
        assert entry.region == "eastus"
        assert entry.vcpu == 2
        assert entry.memory_gb == 4.0
        assert entry.storage_gb == 100.0
        assert entry.network_egress_gb == 10.0
        assert entry.iops == 3000
        assert entry.api_calls_per_month == 1000000
        assert entry.metadata == {"family": "B-series", "burstable": True}
        assert entry.fetched_at == fetched_time
        assert entry.is_fallback is True
    
    def test_service_entry_validation_empty_provider(self):
        """Test that empty provider raises ValueError."""
        with pytest.raises(ValueError, match="provider cannot be empty"):
            ServiceEntry(
                provider="",
                category=ServiceCategory.COMPUTE_VMS,
                service_name="Test Service",
                unit="per hour",
                price_usd=1.0,
                tier_label=PricingTier.ON_DEMAND
            )
    
    def test_service_entry_validation_empty_service_name(self):
        """Test that empty service_name raises ValueError."""
        with pytest.raises(ValueError, match="service_name cannot be empty"):
            ServiceEntry(
                provider="aws",
                category=ServiceCategory.COMPUTE_VMS,
                service_name="",
                unit="per hour",
                price_usd=1.0,
                tier_label=PricingTier.ON_DEMAND
            )
    
    def test_service_entry_validation_empty_unit(self):
        """Test that empty unit raises ValueError."""
        with pytest.raises(ValueError, match="unit cannot be empty"):
            ServiceEntry(
                provider="aws",
                category=ServiceCategory.COMPUTE_VMS,
                service_name="Test Service",
                unit="",
                price_usd=1.0,
                tier_label=PricingTier.ON_DEMAND
            )
    
    def test_service_entry_validation_negative_price(self):
        """Test that negative price_usd raises ValueError."""
        with pytest.raises(ValueError, match="price_usd cannot be negative"):
            ServiceEntry(
                provider="aws",
                category=ServiceCategory.COMPUTE_VMS,
                service_name="Test Service",
                unit="per hour",
                price_usd=-1.0,
                tier_label=PricingTier.ON_DEMAND
            )
    
    def test_service_entry_to_dict(self):
        """Test converting ServiceEntry to dictionary."""
        entry = ServiceEntry(
            provider="gcp",
            category=ServiceCategory.OBJECT_STORAGE,
            service_name="Cloud Storage Standard",
            unit="per GB-month",
            price_usd=0.020,
            tier_label=PricingTier.ON_DEMAND,
            region="us-central1",
            storage_gb=1000.0,
            metadata={"storage_class": "STANDARD"}
        )
        
        result = entry.to_dict()
        
        assert result["provider"] == "gcp"
        assert result["category"] == ServiceCategory.OBJECT_STORAGE
        assert result["service_name"] == "Cloud Storage Standard"
        assert result["unit"] == "per GB-month"
        assert result["price_usd"] == 0.020
        assert result["tier_label"] == PricingTier.ON_DEMAND
        assert result["region"] == "us-central1"
        assert result["storage_gb"] == 1000.0
        assert result["metadata"] == {"storage_class": "STANDARD"}
        assert result["is_fallback"] is False
        assert result["is_anomaly"] is False
        assert isinstance(result["fetched_at"], str)
    
    def test_service_entry_from_dict(self):
        """Test creating ServiceEntry from dictionary."""
        data = {
            "provider": "aws",
            "category": ServiceCategory.COMPUTE_VMS,
            "service_name": "EC2 t3.large",
            "unit": "per hour",
            "price_usd": 0.0832,
            "tier_label": PricingTier.ON_DEMAND,
            "region": "us-west-2",
            "vcpu": 2,
            "memory_gb": 8.0,
            "fetched_at": "2024-01-15T10:30:00+00:00",
            "is_fallback": False,
            "is_anomaly": False,
            "metadata": {}
        }
        
        entry = ServiceEntry.from_dict(data)
        
        assert entry.provider == "aws"
        assert entry.service_name == "EC2 t3.large"
        assert entry.price_usd == 0.0832
        assert entry.vcpu == 2
        assert entry.memory_gb == 8.0
        assert isinstance(entry.fetched_at, datetime)
    
    def test_calculate_monthly_cost_hourly_pricing(self):
        """Test monthly cost calculation for hourly-priced services."""
        entry = ServiceEntry(
            provider="aws",
            category=ServiceCategory.COMPUTE_VMS,
            service_name="EC2 t3.medium",
            unit="per hour",
            price_usd=0.0416,
            tier_label=PricingTier.ON_DEMAND
        )
        
        # Default 730 hours per month
        monthly_cost = entry.calculate_monthly_cost()
        assert monthly_cost == pytest.approx(0.0416 * 730, rel=1e-6)
        
        # Custom usage hours
        monthly_cost_custom = entry.calculate_monthly_cost(usage_hours=500)
        assert monthly_cost_custom == pytest.approx(0.0416 * 500, rel=1e-6)
    
    def test_calculate_monthly_cost_monthly_pricing(self):
        """Test monthly cost calculation for monthly-priced services."""
        entry = ServiceEntry(
            provider="azure",
            category=ServiceCategory.RELATIONAL_DATABASE,
            service_name="SQL Database S1",
            unit="per month",
            price_usd=30.0,
            tier_label=PricingTier.ON_DEMAND
        )
        
        monthly_cost = entry.calculate_monthly_cost()
        assert monthly_cost == 30.0
    
    def test_calculate_monthly_cost_storage_pricing(self):
        """Test monthly cost calculation for storage-based pricing."""
        entry = ServiceEntry(
            provider="gcp",
            category=ServiceCategory.OBJECT_STORAGE,
            service_name="Cloud Storage",
            unit="per GB-month",
            price_usd=0.020,
            tier_label=PricingTier.ON_DEMAND,
            storage_gb=1000.0
        )
        
        monthly_cost = entry.calculate_monthly_cost()
        assert monthly_cost == pytest.approx(0.020 * 1000.0, rel=1e-6)
    
    def test_service_entry_repr(self):
        """Test string representation of ServiceEntry."""
        entry = ServiceEntry(
            provider="aws",
            category=ServiceCategory.COMPUTE_VMS,
            service_name="EC2 t3.medium",
            unit="per hour",
            price_usd=0.0416,
            tier_label=PricingTier.ON_DEMAND
        )
        
        repr_str = repr(entry)
        assert "ServiceEntry" in repr_str
        assert "provider='aws'" in repr_str
        assert "service_name='EC2 t3.medium'" in repr_str
        assert "price_usd=0.0416" in repr_str


class TestProvider:
    """Test cases for Provider model."""
    
    def test_create_provider(self):
        """Test creating a Provider instance."""
        provider = Provider(
            provider_id="aws",
            display_name="Amazon Web Services",
            icon_url="/assets/provider-logos/aws.svg",
            api_base_url="https://pricing.us-east-1.amazonaws.com/",
            auth_type="none",
            enabled=True,
            brand_color="#FF9900"
        )
        
        assert provider.provider_id == "aws"
        assert provider.display_name == "Amazon Web Services"
        assert provider.icon_url == "/assets/provider-logos/aws.svg"
        assert provider.auth_type == "none"
        assert provider.enabled is True
        assert provider.brand_color == "#FF9900"
    
    def test_provider_to_dict(self):
        """Test converting Provider to dictionary."""
        provider = Provider(
            provider_id="azure",
            display_name="Microsoft Azure",
            icon_url="/assets/provider-logos/azure.svg",
            api_base_url="https://prices.azure.com/api/retail/prices",
            auth_type="none",
            enabled=True,
            brand_color="#0078D4"
        )
        
        result = provider.to_dict()
        
        assert result["provider_id"] == "azure"
        assert result["display_name"] == "Microsoft Azure"
        assert result["auth_type"] == "none"
        assert result["enabled"] is True
    
    def test_provider_from_dict(self):
        """Test creating Provider from dictionary."""
        data = {
            "provider_id": "gcp",
            "display_name": "Google Cloud Platform",
            "icon_url": "/assets/provider-logos/gcp.svg",
            "api_base_url": "https://cloudpricingcalculator.appspot.com/",
            "auth_type": "none",
            "enabled": True,
            "brand_color": "#4285F4"
        }
        
        provider = Provider.from_dict(data)
        
        assert provider.provider_id == "gcp"
        assert provider.display_name == "Google Cloud Platform"
        assert provider.brand_color == "#4285F4"


class TestOptimizationSuggestion:
    """Test cases for OptimizationSuggestion model."""
    
    def test_create_optimization_suggestion(self):
        """Test creating an OptimizationSuggestion instance."""
        suggestion = OptimizationSuggestion(
            suggestion_id="opt-001",
            category="Reserved Instances",
            current_provider="aws",
            current_cost=1000.0,
            optimized_cost=650.0,
            savings_amount=350.0,
            savings_percentage=35.0,
            action_steps=["Purchase 1-year reserved instance", "Migrate workload"],
            affected_services=["EC2 t3.medium"],
            confidence_score=0.92
        )
        
        assert suggestion.suggestion_id == "opt-001"
        assert suggestion.category == "Reserved Instances"
        assert suggestion.current_provider == "aws"
        assert suggestion.current_cost == 1000.0
        assert suggestion.optimized_cost == 650.0
        assert suggestion.savings_amount == 350.0
        assert suggestion.savings_percentage == 35.0
        assert len(suggestion.action_steps) == 2
        assert len(suggestion.affected_services) == 1
        assert suggestion.confidence_score == 0.92
        assert isinstance(suggestion.created_at, datetime)
    
    def test_optimization_suggestion_validation_confidence_score_too_high(self):
        """Test that confidence_score > 1.0 raises ValueError."""
        with pytest.raises(ValueError, match="confidence_score must be between 0.0 and 1.0"):
            OptimizationSuggestion(
                suggestion_id="opt-001",
                category="Test",
                current_provider="aws",
                current_cost=100.0,
                optimized_cost=80.0,
                savings_amount=20.0,
                savings_percentage=20.0,
                action_steps=["Step 1"],
                affected_services=["Service 1"],
                confidence_score=1.5
            )
    
    def test_optimization_suggestion_validation_confidence_score_negative(self):
        """Test that negative confidence_score raises ValueError."""
        with pytest.raises(ValueError, match="confidence_score must be between 0.0 and 1.0"):
            OptimizationSuggestion(
                suggestion_id="opt-001",
                category="Test",
                current_provider="aws",
                current_cost=100.0,
                optimized_cost=80.0,
                savings_amount=20.0,
                savings_percentage=20.0,
                action_steps=["Step 1"],
                affected_services=["Service 1"],
                confidence_score=-0.1
            )
    
    def test_optimization_suggestion_validation_negative_savings(self):
        """Test that negative savings_amount raises ValueError."""
        with pytest.raises(ValueError, match="savings_amount cannot be negative"):
            OptimizationSuggestion(
                suggestion_id="opt-001",
                category="Test",
                current_provider="aws",
                current_cost=100.0,
                optimized_cost=80.0,
                savings_amount=-20.0,
                savings_percentage=20.0,
                action_steps=["Step 1"],
                affected_services=["Service 1"],
                confidence_score=0.9
            )
    
    def test_optimization_suggestion_to_dict(self):
        """Test converting OptimizationSuggestion to dictionary."""
        suggestion = OptimizationSuggestion(
            suggestion_id="opt-002",
            category="Cross-Provider Migration",
            current_provider="aws",
            recommended_provider="gcp",
            current_cost=500.0,
            optimized_cost=400.0,
            savings_amount=100.0,
            savings_percentage=20.0,
            action_steps=["Migrate to GCP", "Update DNS"],
            affected_services=["EC2 t3.large"],
            confidence_score=0.85
        )
        
        result = suggestion.to_dict()
        
        assert result["suggestion_id"] == "opt-002"
        assert result["category"] == "Cross-Provider Migration"
        assert result["current_provider"] == "aws"
        assert result["recommended_provider"] == "gcp"
        assert result["savings_amount"] == 100.0
        assert isinstance(result["created_at"], str)
    
    def test_optimization_suggestion_from_dict(self):
        """Test creating OptimizationSuggestion from dictionary."""
        data = {
            "suggestion_id": "opt-003",
            "category": "Right-Sizing",
            "current_provider": "azure",
            "current_cost": 800.0,
            "optimized_cost": 600.0,
            "savings_amount": 200.0,
            "savings_percentage": 25.0,
            "action_steps": ["Downsize VM"],
            "affected_services": ["Azure VM D4s"],
            "confidence_score": 0.88,
            "created_at": "2024-01-15T10:30:00+00:00"
        }
        
        suggestion = OptimizationSuggestion.from_dict(data)
        
        assert suggestion.suggestion_id == "opt-003"
        assert suggestion.category == "Right-Sizing"
        assert suggestion.savings_amount == 200.0
        assert isinstance(suggestion.created_at, datetime)


class TestCostScenario:
    """Test cases for CostScenario model."""
    
    def test_create_cost_scenario(self):
        """Test creating a CostScenario instance."""
        scenario = CostScenario(
            scenario_id="scenario-001",
            scenario_name="Production Workload",
            description="Estimated costs for production environment",
            providers=["aws", "azure"],
            usage_parameters={"compute_hours": 730, "storage_gb": 1000},
            selected_services=["EC2 t3.medium", "Azure VM B2s"],
            total_cost=1500.0
        )
        
        assert scenario.scenario_id == "scenario-001"
        assert scenario.scenario_name == "Production Workload"
        assert len(scenario.providers) == 2
        assert scenario.usage_parameters["compute_hours"] == 730
        assert scenario.total_cost == 1500.0
        assert isinstance(scenario.created_at, datetime)
    
    def test_cost_scenario_to_dict(self):
        """Test converting CostScenario to dictionary."""
        scenario = CostScenario(
            scenario_id="scenario-002",
            scenario_name="Dev Environment",
            description="Development costs",
            providers=["gcp"],
            usage_parameters={"compute_hours": 500},
            selected_services=["Compute Engine n1-standard-1"],
            total_cost=200.0
        )
        
        result = scenario.to_dict()
        
        assert result["scenario_id"] == "scenario-002"
        assert result["scenario_name"] == "Dev Environment"
        assert result["total_cost"] == 200.0
        assert isinstance(result["created_at"], str)
    
    def test_cost_scenario_from_dict(self):
        """Test creating CostScenario from dictionary."""
        data = {
            "scenario_id": "scenario-003",
            "scenario_name": "Test Scenario",
            "description": "Test description",
            "created_at": "2024-01-15T10:30:00+00:00",
            "providers": ["aws"],
            "usage_parameters": {"compute_hours": 100},
            "selected_services": ["EC2 t3.micro"],
            "total_cost": 50.0
        }
        
        scenario = CostScenario.from_dict(data)
        
        assert scenario.scenario_id == "scenario-003"
        assert scenario.total_cost == 50.0
        assert isinstance(scenario.created_at, datetime)


class TestHealthStatus:
    """Test cases for HealthStatus model."""
    
    def test_create_health_status_healthy(self):
        """Test creating a healthy HealthStatus instance."""
        now = datetime.now(timezone.utc)
        status = HealthStatus(
            provider_id="aws",
            status="healthy",
            last_success_at=now,
            response_time_ms=250.5
        )
        
        assert status.provider_id == "aws"
        assert status.status == "healthy"
        assert status.last_success_at == now
        assert status.response_time_ms == 250.5
        assert status.last_error is None
        assert isinstance(status.updated_at, datetime)
    
    def test_create_health_status_unavailable(self):
        """Test creating an unavailable HealthStatus instance."""
        status = HealthStatus(
            provider_id="azure",
            status="unavailable",
            last_error="Connection timeout"
        )
        
        assert status.provider_id == "azure"
        assert status.status == "unavailable"
        assert status.last_error == "Connection timeout"
        assert status.last_success_at is None
    
    def test_health_status_to_dict(self):
        """Test converting HealthStatus to dictionary."""
        now = datetime.now(timezone.utc)
        status = HealthStatus(
            provider_id="gcp",
            status="degraded",
            last_success_at=now,
            last_error="Slow response",
            response_time_ms=5000.0
        )
        
        result = status.to_dict()
        
        assert result["provider_id"] == "gcp"
        assert result["status"] == "degraded"
        assert result["last_error"] == "Slow response"
        assert result["response_time_ms"] == 5000.0
        assert isinstance(result["updated_at"], str)
        assert isinstance(result["last_success_at"], str)
    
    def test_health_status_from_dict(self):
        """Test creating HealthStatus from dictionary."""
        data = {
            "provider_id": "aws",
            "status": "healthy",
            "last_success_at": "2024-01-15T10:30:00+00:00",
            "last_error": None,
            "response_time_ms": 150.0,
            "updated_at": "2024-01-15T10:30:05+00:00"
        }
        
        status = HealthStatus.from_dict(data)
        
        assert status.provider_id == "aws"
        assert status.status == "healthy"
        assert isinstance(status.last_success_at, datetime)
        assert isinstance(status.updated_at, datetime)
