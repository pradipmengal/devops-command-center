"""
Optimization API Routes - Tasks 12.2, 12.3
POST /api/optimization/analyze
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.optimization_agent import OptimizationAgent
from services.pricing_orchestrator import PricingOrchestrator
from providers.registry import ProviderRegistry

router = APIRouter(prefix="/optimization", tags=["optimization"])

_agent = OptimizationAgent()


def get_orchestrator():
    registry = ProviderRegistry.get_instance()
    if registry.get_provider_count() == 0:
        registry.auto_discover_providers()
    return PricingOrchestrator(registry=registry)


class AnalyzeRequest(BaseModel):
    providers: List[str]
    categories: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    compute_hours: float = 730


@router.post("/analyze")
async def analyze_costs(request: AnalyzeRequest):
    """
    Analyze current service selection and return optimization suggestions.
    
    Returns list of suggestions ranked by potential savings.
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
                    "suggestions": [],
                    "total_potential_savings_monthly": 0,
                    "service_count": 0
                }
            }

        suggestions = _agent.analyze(services, usage_hours=request.compute_hours)

        total_savings = sum(s.savings_amount for s in suggestions)

        return {
            "status": "success",
            "data": {
                "suggestions": [s.to_dict() for s in suggestions],
                "suggestion_count": len(suggestions),
                "total_potential_savings_monthly": round(total_savings, 2),
                "total_potential_savings_annual": round(total_savings * 12, 2),
                "service_count": len(services)
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )
