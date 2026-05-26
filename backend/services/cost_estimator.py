"""
Cost Estimator - Calculates estimated costs based on usage parameters.

This module implements cost estimation logic for multi-cloud services,
calculating monthly and annual costs based on user-provided usage parameters.

Requirements:
    - Requirement 10.1: Cost calculation engine
    - Requirement 10.2: Usage parameter handling
    - Requirement 10.3: Multi-service cost aggregation
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from dataclasses import dataclass, field

import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from models.service import ServiceEntry


logger = logging.getLogger(__name__)


@dataclass
class UsageParameters:
    """Usage parameters for cost estimation."""
    compute_hours: float = 730  # Hours per month (24 * 30.42)
    storage_gb: float = 0
    network_egress_gb: float = 0
    api_calls: int = 0
    data_transfer_gb: float = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'compute_hours': self.compute_hours,
            'storage_gb': self.storage_gb,
            'network_egress_gb': self.network_egress_gb,
            'api_calls': self.api_calls,
            'data_transfer_gb': self.data_transfer_gb
        }


@dataclass
class CostEstimate:
    """Cost estimate result."""
    service: ServiceEntry
    usage_params: UsageParameters
    hourly_cost: float
    daily_cost: float
    monthly_cost: float
    annual_cost: float
    breakdown: Dict[str, float] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'service': {
                'provider': self.service.provider,
                'service_name': self.service.service_name,
                'category': self.service.category,
                'price_usd': self.service.price_usd,
                'unit': self.service.unit,
                'tier_label': self.service.tier_label
            },
            'usage_params': self.usage_params.to_dict(),
            'costs': {
                'hourly': round(self.hourly_cost, 6),
                'daily': round(self.daily_cost, 4),
                'monthly': round(self.monthly_cost, 2),
                'annual': round(self.annual_cost, 2)
            },
            'breakdown': {k: round(v, 4) for k, v in self.breakdown.items()}
        }


class CostEstimator:
    """
    Calculates estimated costs for cloud services based on usage parameters.
    
    The CostEstimator takes service pricing data and usage parameters to
    calculate hourly, daily, monthly, and annual cost estimates.
    
    Features:
        - Multiple pricing unit support (per hour, per GB, per month, etc.)
        - Usage parameter-based calculations
        - Cost breakdown by component
        - Multi-service aggregation
    
    Requirements:
        - Requirement 10.1: Cost calculation engine
        - Requirement 10.2: Usage parameter handling
        - Requirement 10.3: Multi-service cost aggregation
    
    Usage:
        >>> estimator = CostEstimator()
        >>> params = UsageParameters(compute_hours=730, storage_gb=100)
        >>> estimate = estimator.estimate_cost(service, params)
        >>> print(f"Monthly cost: ${estimate.monthly_cost:.2f}")
    """
    
    def __init__(self):
        """Initialize the cost estimator."""
        logger.info("CostEstimator initialized")
    
    def estimate_cost(
        self,
        service: ServiceEntry,
        usage_params: UsageParameters
    ) -> CostEstimate:
        """
        Estimate cost for a single service.
        
        Args:
            service: ServiceEntry with pricing information
            usage_params: Usage parameters for calculation
        
        Returns:
            CostEstimate with hourly, daily, monthly, and annual costs
        
        Example:
            >>> service = ServiceEntry(...)
            >>> params = UsageParameters(compute_hours=730)
            >>> estimate = estimator.estimate_cost(service, params)
        """
        unit = service.unit.lower()
        base_price = service.price_usd
        breakdown = {}
        
        # Calculate based on pricing unit
        if 'hour' in unit:
            # Per-hour pricing (e.g., compute instances)
            hourly_cost = base_price
            breakdown['compute'] = hourly_cost * usage_params.compute_hours
            
        elif 'gb' in unit and 'month' in unit:
            # Per GB-month pricing (e.g., storage)
            monthly_cost_per_gb = base_price
            hourly_cost = (monthly_cost_per_gb * usage_params.storage_gb) / 730
            breakdown['storage'] = monthly_cost_per_gb * usage_params.storage_gb
            
        elif 'gb' in unit and 'hour' not in unit and 'month' not in unit:
            # Per GB pricing (e.g., data transfer)
            cost_per_gb = base_price
            total_gb = usage_params.network_egress_gb + usage_params.data_transfer_gb
            hourly_cost = (cost_per_gb * total_gb) / 730
            breakdown['data_transfer'] = cost_per_gb * total_gb
            
        elif 'request' in unit or 'call' in unit:
            # Per request/call pricing (e.g., API calls)
            cost_per_call = base_price
            hourly_cost = (cost_per_call * usage_params.api_calls) / 730
            breakdown['api_calls'] = cost_per_call * usage_params.api_calls
            
        elif 'month' in unit:
            # Per month pricing (flat rate)
            monthly_cost = base_price
            hourly_cost = monthly_cost / 730
            breakdown['monthly_fee'] = monthly_cost
            
        else:
            # Default: assume monthly pricing
            logger.warning(f"Unknown pricing unit '{unit}', assuming monthly pricing")
            monthly_cost = base_price
            hourly_cost = monthly_cost / 730
            breakdown['base'] = monthly_cost
        
        # Calculate all time periods
        daily_cost = hourly_cost * 24
        monthly_cost = hourly_cost * 730  # Average hours per month
        annual_cost = monthly_cost * 12
        
        return CostEstimate(
            service=service,
            usage_params=usage_params,
            hourly_cost=hourly_cost,
            daily_cost=daily_cost,
            monthly_cost=monthly_cost,
            annual_cost=annual_cost,
            breakdown=breakdown
        )
    
    def estimate_multiple(
        self,
        services: List[ServiceEntry],
        usage_params: UsageParameters
    ) -> Dict[str, Any]:
        """
        Estimate costs for multiple services and aggregate.
        
        Args:
            services: List of ServiceEntry objects
            usage_params: Usage parameters for calculation
        
        Returns:
            Dictionary with individual estimates and totals
        
        Example:
            >>> services = [service1, service2, service3]
            >>> params = UsageParameters(compute_hours=730, storage_gb=100)
            >>> result = estimator.estimate_multiple(services, params)
            >>> print(f"Total monthly: ${result['totals']['monthly']:.2f}")
        """
        estimates = []
        
        for service in services:
            try:
                estimate = self.estimate_cost(service, usage_params)
                estimates.append(estimate)
            except Exception as e:
                logger.error(f"Failed to estimate cost for {service.service_name}: {e}")
                continue
        
        # Calculate totals
        total_hourly = sum(e.hourly_cost for e in estimates)
        total_daily = sum(e.daily_cost for e in estimates)
        total_monthly = sum(e.monthly_cost for e in estimates)
        total_annual = sum(e.annual_cost for e in estimates)
        
        # Group by provider
        by_provider = {}
        for estimate in estimates:
            provider = estimate.service.provider
            if provider not in by_provider:
                by_provider[provider] = {
                    'count': 0,
                    'monthly_cost': 0,
                    'annual_cost': 0
                }
            by_provider[provider]['count'] += 1
            by_provider[provider]['monthly_cost'] += estimate.monthly_cost
            by_provider[provider]['annual_cost'] += estimate.annual_cost
        
        # Group by category
        by_category = {}
        for estimate in estimates:
            category = estimate.service.category
            if category not in by_category:
                by_category[category] = {
                    'count': 0,
                    'monthly_cost': 0,
                    'annual_cost': 0
                }
            by_category[category]['count'] += 1
            by_category[category]['monthly_cost'] += estimate.monthly_cost
            by_category[category]['annual_cost'] += estimate.annual_cost
        
        return {
            'estimates': [e.to_dict() for e in estimates],
            'totals': {
                'hourly': round(total_hourly, 6),
                'daily': round(total_daily, 4),
                'monthly': round(total_monthly, 2),
                'annual': round(total_annual, 2)
            },
            'by_provider': {
                k: {
                    'count': v['count'],
                    'monthly_cost': round(v['monthly_cost'], 2),
                    'annual_cost': round(v['annual_cost'], 2)
                }
                for k, v in by_provider.items()
            },
            'by_category': {
                k: {
                    'count': v['count'],
                    'monthly_cost': round(v['monthly_cost'], 2),
                    'annual_cost': round(v['annual_cost'], 2)
                }
                for k, v in by_category.items()
            },
            'service_count': len(estimates),
            'usage_params': usage_params.to_dict(),
            'estimated_at': datetime.now(timezone.utc).isoformat()
        }
    
    def compare_providers(
        self,
        services: List[ServiceEntry],
        usage_params: UsageParameters
    ) -> Dict[str, Any]:
        """
        Compare costs across providers for similar services.
        
        Args:
            services: List of ServiceEntry objects from different providers
            usage_params: Usage parameters for calculation
        
        Returns:
            Dictionary with provider comparison and savings analysis
        """
        estimates = []
        
        for service in services:
            try:
                estimate = self.estimate_cost(service, usage_params)
                estimates.append(estimate)
            except Exception as e:
                logger.error(f"Failed to estimate cost for {service.service_name}: {e}")
                continue
        
        if not estimates:
            return {
                'error': 'No valid estimates generated',
                'estimates': []
            }
        
        # Find cheapest and most expensive
        cheapest = min(estimates, key=lambda e: e.monthly_cost)
        most_expensive = max(estimates, key=lambda e: e.monthly_cost)
        
        # Calculate savings
        potential_savings_monthly = most_expensive.monthly_cost - cheapest.monthly_cost
        potential_savings_annual = potential_savings_monthly * 12
        savings_percentage = (potential_savings_monthly / most_expensive.monthly_cost * 100) if most_expensive.monthly_cost > 0 else 0
        
        return {
            'estimates': [e.to_dict() for e in estimates],
            'cheapest': {
                'provider': cheapest.service.provider,
                'service_name': cheapest.service.service_name,
                'monthly_cost': round(cheapest.monthly_cost, 2),
                'annual_cost': round(cheapest.annual_cost, 2)
            },
            'most_expensive': {
                'provider': most_expensive.service.provider,
                'service_name': most_expensive.service.service_name,
                'monthly_cost': round(most_expensive.monthly_cost, 2),
                'annual_cost': round(most_expensive.annual_cost, 2)
            },
            'savings': {
                'monthly': round(potential_savings_monthly, 2),
                'annual': round(potential_savings_annual, 2),
                'percentage': round(savings_percentage, 2)
            },
            'usage_params': usage_params.to_dict(),
            'estimated_at': datetime.now(timezone.utc).isoformat()
        }
    
    def __repr__(self) -> str:
        """String representation of cost estimator."""
        return "CostEstimator()"
