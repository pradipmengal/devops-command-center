"""
Cost Estimation API Routes - Task 10.2
POST /api/cost/estimate
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.cost_estimator import CostEstimator, UsageParameters
from services.pricing_orchestrator import PricingOrchestrator
from providers.registry import ProviderRegistry

router = APIRouter(prefix="/cost", tags=["cost"])

_estimator = CostEstimator()


def get_orchestrator():
    registry = ProviderRegistry.get_instance()
    if registry.get_provider_count() == 0:
        registry.auto_discover_providers()
    return PricingOrchestrator(registry=registry)


class EstimateRequest(BaseModel):
    providers: List[str]
    categories: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    compute_hours: float = 730
    storage_gb: float = 0
    network_egress_gb: float = 0
    api_calls: int = 0
    data_transfer_gb: float = 0


@router.post("/estimate")
async def estimate_cost(request: EstimateRequest):
    """
    Estimate costs for selected services based on usage parameters.
    
    Returns hourly, daily, monthly, and annual cost estimates
    broken down by provider and category.
    """
    try:
        orchestrator = get_orchestrator()

        services = await orchestrator.fetch_services(
            provider_ids=request.providers,
            regions=request.regions,
            categories=request.categories
        )

        if not services:
            return {
                "status": "success",
                "data": {
                    "estimates": [],
                    "totals": {"hourly": 0, "daily": 0, "monthly": 0, "annual": 0},
                    "by_provider": {},
                    "by_category": {},
                    "service_count": 0
                }
            }

        usage_params = UsageParameters(
            compute_hours=request.compute_hours,
            storage_gb=request.storage_gb,
            network_egress_gb=request.network_egress_gb,
            api_calls=request.api_calls,
            data_transfer_gb=request.data_transfer_gb
        )

        result = _estimator.estimate_multiple(services, usage_params)

        return {"status": "success", "data": result}

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


@router.post("/compare")
async def compare_provider_costs(request: EstimateRequest):
    """Compare costs across providers for similar services."""
    try:
        orchestrator = get_orchestrator()

        services = await orchestrator.fetch_services(
            provider_ids=request.providers,
            regions=request.regions,
            categories=request.categories
        )

        usage_params = UsageParameters(
            compute_hours=request.compute_hours,
            storage_gb=request.storage_gb,
            network_egress_gb=request.network_egress_gb,
            api_calls=request.api_calls,
            data_transfer_gb=request.data_transfer_gb
        )

        result = _estimator.compare_providers(services, usage_params)

        return {"status": "success", "data": result}

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )
