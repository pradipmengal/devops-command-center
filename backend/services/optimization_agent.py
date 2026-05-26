"""
Optimization Agent - AI-powered cost optimization recommendations. Task 12.1
"""

import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from models.service import ServiceEntry, OptimizationSuggestion

logger = logging.getLogger(__name__)


class OptimizationAgent:
    """
    Analyzes service catalog and generates cost optimization recommendations.
    
    Identifies opportunities for:
    - Reserved instance savings (>20% discount)
    - Right-sizing (over-provisioned resources)
    - Cross-provider migration (>$50/month savings)
    - Spot/preemptible instance usage
    """

    RESERVED_DISCOUNT = 0.35   # 35% average reserved instance discount
    SPOT_DISCOUNT = 0.70       # 70% average spot instance discount
    MIN_CROSS_PROVIDER_SAVINGS = 50.0  # Minimum $50/month to recommend migration

    def analyze(
        self,
        services: List[ServiceEntry],
        usage_hours: float = 730
    ) -> List[OptimizationSuggestion]:
        """
        Generate optimization suggestions from service catalog.
        
        Args:
            services: List of ServiceEntry objects
            usage_hours: Monthly usage hours (default 730)
        
        Returns:
            List of OptimizationSuggestion objects ranked by savings
        """
        suggestions = []

        suggestions.extend(self._find_reserved_instance_opportunities(services, usage_hours))
        suggestions.extend(self._find_spot_instance_opportunities(services, usage_hours))
        suggestions.extend(self._find_cross_provider_opportunities(services, usage_hours))
        suggestions.extend(self._find_right_sizing_opportunities(services, usage_hours))

        # Sort by savings amount descending
        suggestions.sort(key=lambda s: s.savings_amount, reverse=True)

        logger.info(f"Generated {len(suggestions)} optimization suggestions")
        return suggestions

    def _find_reserved_instance_opportunities(
        self,
        services: List[ServiceEntry],
        usage_hours: float
    ) -> List[OptimizationSuggestion]:
        """Identify compute services where reserved instances save >20%."""
        suggestions = []

        compute_services = [
            s for s in services
            if 'compute' in s.category.lower() or 'vm' in s.category.lower()
            if s.tier_label in ('On-Demand', 'Pay-As-You-Go')
        ]

        for service in compute_services:
            current_monthly = service.price_usd * usage_hours
            reserved_monthly = current_monthly * (1 - self.RESERVED_DISCOUNT)
            savings = current_monthly - reserved_monthly

            if savings > 10:  # Only suggest if saves >$10/month
                suggestions.append(OptimizationSuggestion(
                    suggestion_id=f"ri-{uuid.uuid4().hex[:8]}",
                    category="Reserved Instances",
                    current_provider=service.provider,
                    current_cost=round(current_monthly, 2),
                    optimized_cost=round(reserved_monthly, 2),
                    savings_amount=round(savings, 2),
                    savings_percentage=round(self.RESERVED_DISCOUNT * 100, 1),
                    action_steps=[
                        f"Purchase 1-year reserved instance for {service.service_name}",
                        "Commit to consistent usage to maximize savings",
                        "Review reservation utilization monthly"
                    ],
                    affected_services=[service.service_name],
                    confidence_score=0.85,
                    recommended_provider=service.provider
                ))

        return suggestions

    def _find_spot_instance_opportunities(
        self,
        services: List[ServiceEntry],
        usage_hours: float
    ) -> List[OptimizationSuggestion]:
        """Identify workloads suitable for spot/preemptible instances."""
        suggestions = []

        compute_services = [
            s for s in services
            if 'compute' in s.category.lower()
            if s.tier_label == 'On-Demand'
        ]

        for service in compute_services:
            current_monthly = service.price_usd * usage_hours
            spot_monthly = current_monthly * (1 - self.SPOT_DISCOUNT)
            savings = current_monthly - spot_monthly

            if savings > 20:
                suggestions.append(OptimizationSuggestion(
                    suggestion_id=f"spot-{uuid.uuid4().hex[:8]}",
                    category="Spot Instances",
                    current_provider=service.provider,
                    current_cost=round(current_monthly, 2),
                    optimized_cost=round(spot_monthly, 2),
                    savings_amount=round(savings, 2),
                    savings_percentage=round(self.SPOT_DISCOUNT * 100, 1),
                    action_steps=[
                        f"Migrate fault-tolerant workloads to spot instances",
                        "Implement checkpointing for long-running jobs",
                        "Use spot instance interruption handlers"
                    ],
                    affected_services=[service.service_name],
                    confidence_score=0.70,
                    recommended_provider=service.provider
                ))

        return suggestions

    def _find_cross_provider_opportunities(
        self,
        services: List[ServiceEntry],
        usage_hours: float
    ) -> List[OptimizationSuggestion]:
        """Identify services where switching providers saves >$50/month."""
        suggestions = []

        # Group by category
        by_category: Dict[str, List[ServiceEntry]] = {}
        for service in services:
            cat = service.category
            by_category.setdefault(cat, []).append(service)

        for category, cat_services in by_category.items():
            if len(cat_services) < 2:
                continue

            # Find cheapest and most expensive in category
            def monthly_cost(s):
                if 'hour' in s.unit.lower():
                    return s.price_usd * usage_hours
                return s.price_usd

            sorted_services = sorted(cat_services, key=monthly_cost)
            cheapest = sorted_services[0]
            most_expensive = sorted_services[-1]

            cheapest_monthly = monthly_cost(cheapest)
            expensive_monthly = monthly_cost(most_expensive)
            savings = expensive_monthly - cheapest_monthly

            if savings >= self.MIN_CROSS_PROVIDER_SAVINGS and cheapest.provider != most_expensive.provider:
                savings_pct = (savings / expensive_monthly * 100) if expensive_monthly > 0 else 0

                suggestions.append(OptimizationSuggestion(
                    suggestion_id=f"cross-{uuid.uuid4().hex[:8]}",
                    category="Cross-Provider Migration",
                    current_provider=most_expensive.provider,
                    current_cost=round(expensive_monthly, 2),
                    optimized_cost=round(cheapest_monthly, 2),
                    savings_amount=round(savings, 2),
                    savings_percentage=round(savings_pct, 1),
                    action_steps=[
                        f"Evaluate {cheapest.provider.upper()} {cheapest.service_name} as alternative",
                        f"Run proof-of-concept migration for {category}",
                        "Assess data transfer costs and migration complexity",
                        "Plan phased migration to minimize risk"
                    ],
                    affected_services=[most_expensive.service_name, cheapest.service_name],
                    confidence_score=0.75,
                    recommended_provider=cheapest.provider
                ))

        return suggestions

    def _find_right_sizing_opportunities(
        self,
        services: List[ServiceEntry],
        usage_hours: float
    ) -> List[OptimizationSuggestion]:
        """Identify over-provisioned compute resources."""
        suggestions = []

        # Find compute services with high vCPU counts
        large_compute = [
            s for s in services
            if s.vcpu and s.vcpu >= 8
            if 'compute' in s.category.lower()
        ]

        for service in large_compute:
            current_monthly = service.price_usd * usage_hours
            # Assume 50% right-sizing savings
            optimized_monthly = current_monthly * 0.5
            savings = current_monthly - optimized_monthly

            if savings > 30:
                suggestions.append(OptimizationSuggestion(
                    suggestion_id=f"rs-{uuid.uuid4().hex[:8]}",
                    category="Right-Sizing",
                    current_provider=service.provider,
                    current_cost=round(current_monthly, 2),
                    optimized_cost=round(optimized_monthly, 2),
                    savings_amount=round(savings, 2),
                    savings_percentage=50.0,
                    action_steps=[
                        f"Monitor CPU/memory utilization for {service.service_name}",
                        "Downsize to smaller instance if utilization <40%",
                        "Use auto-scaling to match demand dynamically"
                    ],
                    affected_services=[service.service_name],
                    confidence_score=0.60,
                    recommended_provider=service.provider
                ))

        return suggestions
