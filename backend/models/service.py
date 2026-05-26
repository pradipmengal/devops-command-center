"""
Unified data models for multi-cloud service pricing.

This module defines the unified schema that all provider-specific data is normalized to.
It ensures consistent data structure across AWS, Azure, GCP, and other cloud providers.

Requirements:
    - Requirement 4.1: Unified schema definition
    - Requirement 4.2: Data normalization
    - Requirement 4.3: Metadata preservation
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from enum import Enum


class PricingTier(str, Enum):
    """Standard pricing tier labels across all providers."""
    ON_DEMAND = "On-Demand"
    RESERVED = "Reserved"
    SPOT = "Spot"
    SAVINGS_PLAN = "Savings Plan"
    COMMITTED_USE = "Committed Use"
    PREEMPTIBLE = "Preemptible"
    FREE_TIER = "Free Tier"
    OTHER = "Other"


class ServiceCategory(str, Enum):
    """Logical service categories for provider-agnostic grouping."""
    COMPUTE_VMS = "Compute (VMs)"
    MANAGED_KUBERNETES = "Managed Kubernetes"
    OBJECT_STORAGE = "Object Storage"
    BLOCK_STORAGE = "Block Storage"
    RELATIONAL_DATABASE = "Relational Database"
    NOSQL_DATABASE = "NoSQL Database"
    SERVERLESS_FUNCTIONS = "Serverless Functions"
    LOAD_BALANCERS = "Load Balancers"
    CDN = "CDN"
    DNS = "DNS"
    NETWORKING = "Networking"
    AI_ML = "AI/ML Services"
    ANALYTICS = "Analytics"
    MONITORING = "Monitoring"
    SECURITY = "Security"
    OTHER = "Other"


@dataclass
class ServiceEntry:
    """
    Unified schema for service pricing entries across all cloud providers.
    
    All provider-specific data is normalized to this structure to ensure
    consistent handling in the pricing abstraction layer and frontend UI.
    
    Required Fields:
        provider: Provider ID (e.g., "aws", "azure", "gcp")
        category: Logical category for grouping services
        service_name: Human-readable service name
        unit: Pricing unit (e.g., "per hour", "per GB-month")
        price_usd: Base price in USD
        tier_label: Pricing tier (On-Demand, Reserved, Spot, etc.)
    
    Optional Metadata:
        region: Geographic region (e.g., "us-east-1", "eastus")
        vcpu: Virtual CPU count for compute services
        memory_gb: Memory in GB for compute services
        storage_gb: Storage capacity in GB
        network_egress_gb: Network egress in GB
        iops: I/O operations per second for storage services
        api_calls_per_month: API call limits for serverless services
        metadata: Additional provider-specific data
    
    System Fields:
        fetched_at: Timestamp when data was fetched from provider API
        is_fallback: True if using static fallback data instead of live API
        is_anomaly: True if flagged as statistical outlier
    
    Requirements:
        - Requirement 4.1: Unified schema definition
        - Requirement 4.2: Data normalization
        - Requirement 4.3: Metadata preservation
    
    Example:
        >>> entry = ServiceEntry(
        ...     provider="aws",
        ...     category=ServiceCategory.COMPUTE_VMS,
        ...     service_name="EC2 t3.medium",
        ...     unit="per hour",
        ...     price_usd=0.0416,
        ...     tier_label=PricingTier.ON_DEMAND,
        ...     region="us-east-1",
        ...     vcpu=2,
        ...     memory_gb=4.0
        ... )
    """
    
    # Required fields
    provider: str
    category: str
    service_name: str
    unit: str
    price_usd: float
    tier_label: str
    
    # Optional metadata fields
    region: Optional[str] = None
    vcpu: Optional[int] = None
    memory_gb: Optional[float] = None
    storage_gb: Optional[float] = None
    network_egress_gb: Optional[float] = None
    iops: Optional[int] = None
    api_calls_per_month: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    # System fields
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_fallback: bool = False
    is_anomaly: bool = False
    
    def __post_init__(self):
        """Validate required fields after initialization."""
        if not self.provider:
            raise ValueError("provider cannot be empty")
        
        if not self.service_name:
            raise ValueError("service_name cannot be empty")
        
        if not self.unit:
            raise ValueError("unit cannot be empty")
        
        if self.price_usd < 0:
            raise ValueError(f"price_usd cannot be negative: {self.price_usd}")
        
        # Ensure metadata is a dict
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert ServiceEntry to dictionary for JSON serialization.
        
        Returns:
            Dictionary representation of the service entry
        """
        return {
            "provider": self.provider,
            "category": self.category,
            "service_name": self.service_name,
            "unit": self.unit,
            "price_usd": self.price_usd,
            "tier_label": self.tier_label,
            "region": self.region,
            "vcpu": self.vcpu,
            "memory_gb": self.memory_gb,
            "storage_gb": self.storage_gb,
            "network_egress_gb": self.network_egress_gb,
            "iops": self.iops,
            "api_calls_per_month": self.api_calls_per_month,
            "metadata": self.metadata,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
            "is_fallback": self.is_fallback,
            "is_anomaly": self.is_anomaly
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ServiceEntry':
        """
        Create ServiceEntry from dictionary.
        
        Args:
            data: Dictionary containing service entry data
        
        Returns:
            ServiceEntry instance
        
        Raises:
            ValueError: If required fields are missing or invalid
        """
        # Parse datetime if present
        if 'fetched_at' in data and isinstance(data['fetched_at'], str):
            data['fetched_at'] = datetime.fromisoformat(data['fetched_at'])
        
        return cls(**data)
    
    def calculate_monthly_cost(self, usage_hours: float = 730) -> float:
        """
        Calculate estimated monthly cost based on usage.
        
        Args:
            usage_hours: Number of hours per month (default: 730 = 24*30.42)
        
        Returns:
            Estimated monthly cost in USD
        
        Note:
            This is a simplified calculation. Actual costs may vary based on
            provider-specific pricing models, tiers, and discounts.
        """
        unit_lower = self.unit.lower()
        
        if "hour" in unit_lower:
            return self.price_usd * usage_hours
        elif "gb" in unit_lower and "month" in unit_lower and self.storage_gb:
            # Storage pricing like "per GB-month"
            return self.price_usd * self.storage_gb
        elif "month" in unit_lower:
            return self.price_usd
        else:
            # Default to monthly price
            return self.price_usd
    
    def __repr__(self) -> str:
        """String representation of ServiceEntry."""
        return (
            f"ServiceEntry(provider='{self.provider}', "
            f"category='{self.category}', "
            f"service_name='{self.service_name}', "
            f"price_usd={self.price_usd}, "
            f"tier_label='{self.tier_label}')"
        )


@dataclass
class Provider:
    """
    Provider metadata from registry.
    
    Contains configuration and metadata for a cloud provider including
    display information, API endpoints, and authentication requirements.
    
    Requirements:
        - Requirement 1.2: Provider metadata
        - Requirement 1.4: Provider registry configuration
    
    Example:
        >>> provider = Provider(
        ...     provider_id="aws",
        ...     display_name="Amazon Web Services",
        ...     icon_url="/assets/provider-logos/aws.svg",
        ...     api_base_url="https://pricing.us-east-1.amazonaws.com/",
        ...     auth_type="none",
        ...     enabled=True,
        ...     brand_color="#FF9900"
        ... )
    """
    
    provider_id: str
    display_name: str
    icon_url: str
    api_base_url: str
    auth_type: str  # "none", "api_key", "oauth2"
    enabled: bool
    brand_color: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert Provider to dictionary for JSON serialization."""
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "icon_url": self.icon_url,
            "api_base_url": self.api_base_url,
            "auth_type": self.auth_type,
            "enabled": self.enabled,
            "brand_color": self.brand_color
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Provider':
        """Create Provider from dictionary."""
        return cls(**data)


@dataclass
class OptimizationSuggestion:
    """
    AI-generated cost optimization recommendation.
    
    Represents a single optimization opportunity identified by the AI agent,
    including current state, recommended changes, and estimated savings.
    
    Requirements:
        - Requirement 11.1: AI optimization suggestions
        - Requirement 11.2: Savings estimation
        - Requirement 11.3: Action steps generation
    
    Example:
        >>> suggestion = OptimizationSuggestion(
        ...     suggestion_id="opt-001",
        ...     category="Reserved Instances",
        ...     current_provider="aws",
        ...     current_cost=1000.0,
        ...     optimized_cost=650.0,
        ...     savings_amount=350.0,
        ...     savings_percentage=35.0,
        ...     action_steps=["Purchase 1-year reserved instance", "Migrate workload"],
        ...     affected_services=["EC2 t3.medium"],
        ...     confidence_score=0.92
        ... )
    """
    
    suggestion_id: str
    category: str
    current_provider: str
    current_cost: float
    optimized_cost: float
    savings_amount: float
    savings_percentage: float
    action_steps: List[str]
    affected_services: List[str]
    confidence_score: float
    recommended_provider: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def __post_init__(self):
        """Validate fields after initialization."""
        if not 0.0 <= self.confidence_score <= 1.0:
            raise ValueError(
                f"confidence_score must be between 0.0 and 1.0, got {self.confidence_score}"
            )
        
        if self.savings_amount < 0:
            raise ValueError(f"savings_amount cannot be negative: {self.savings_amount}")
        
        if self.current_cost < 0:
            raise ValueError(f"current_cost cannot be negative: {self.current_cost}")
        
        if self.optimized_cost < 0:
            raise ValueError(f"optimized_cost cannot be negative: {self.optimized_cost}")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert OptimizationSuggestion to dictionary for JSON serialization."""
        return {
            "suggestion_id": self.suggestion_id,
            "category": self.category,
            "current_provider": self.current_provider,
            "current_cost": self.current_cost,
            "recommended_provider": self.recommended_provider,
            "optimized_cost": self.optimized_cost,
            "savings_amount": self.savings_amount,
            "savings_percentage": self.savings_percentage,
            "action_steps": self.action_steps,
            "affected_services": self.affected_services,
            "confidence_score": self.confidence_score,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OptimizationSuggestion':
        """Create OptimizationSuggestion from dictionary."""
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        
        return cls(**data)


@dataclass
class CostScenario:
    """
    Saved cost estimation scenario.
    
    Represents a user-defined cost estimation scenario with selected providers,
    services, and usage parameters for comparison and analysis.
    
    Requirements:
        - Requirement 9.1: Cost scenario saving
        - Requirement 9.2: Scenario comparison
    
    Example:
        >>> scenario = CostScenario(
        ...     scenario_id="scenario-001",
        ...     scenario_name="Production Workload",
        ...     description="Estimated costs for production environment",
        ...     providers=["aws", "azure"],
        ...     usage_parameters={"compute_hours": 730, "storage_gb": 1000},
        ...     selected_services=["EC2 t3.medium", "Azure VM B2s"],
        ...     total_cost=1500.0
        ... )
    """
    
    scenario_id: str
    scenario_name: str
    description: str
    providers: List[str]
    usage_parameters: Dict[str, float]
    selected_services: List[str]
    total_cost: float
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert CostScenario to dictionary for JSON serialization."""
        return {
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "providers": self.providers,
            "usage_parameters": self.usage_parameters,
            "selected_services": self.selected_services,
            "total_cost": self.total_cost
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CostScenario':
        """Create CostScenario from dictionary."""
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        
        return cls(**data)


@dataclass
class HealthStatus:
    """
    Provider API health status.
    
    Tracks the health and availability of provider pricing APIs for
    monitoring and fallback decision-making.
    
    Requirements:
        - Requirement 5.1: Health monitoring
        - Requirement 5.2: Fallback mechanism
    
    Example:
        >>> status = HealthStatus(
        ...     provider_id="aws",
        ...     status="healthy",
        ...     last_success_at=datetime.now(timezone.utc),
        ...     response_time_ms=250.5
        ... )
    """
    
    provider_id: str
    status: str  # "healthy", "degraded", "unavailable"
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_success_at: Optional[datetime] = None
    last_error: Optional[str] = None
    response_time_ms: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert HealthStatus to dictionary for JSON serialization."""
        return {
            "provider_id": self.provider_id,
            "status": self.status,
            "last_success_at": self.last_success_at.isoformat() if self.last_success_at else None,
            "last_error": self.last_error,
            "response_time_ms": self.response_time_ms,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'HealthStatus':
        """Create HealthStatus from dictionary."""
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        
        if 'last_success_at' in data and isinstance(data['last_success_at'], str):
            data['last_success_at'] = datetime.fromisoformat(data['last_success_at'])
        
        return cls(**data)
