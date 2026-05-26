"""
Backend Tests - Task 19.3: End-to-end tests for API routes.
Tests provider selection, service search, and comparison flows.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timezone

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Fixtures ──────────────────────────────────────────────────────────────────

SAMPLE_SERVICES = [
    {
        "provider": "aws",
        "category": "Compute (VMs)",
        "service_name": "EC2 t3.medium",
        "unit": "per hour",
        "price_usd": 0.0416,
        "tier_label": "On-Demand",
        "region": "us-east-1",
        "vcpu": 2,
        "memory_gb": 4.0,
        "metadata": {},
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_fallback": False,
        "is_anomaly": False
    },
    {
        "provider": "azure",
        "category": "Compute (VMs)",
        "service_name": "Azure VM B2s",
        "unit": "per hour",
        "price_usd": 0.0416,
        "tier_label": "Pay-As-You-Go",
        "region": "eastus",
        "vcpu": 2,
        "memory_gb": 4.0,
        "metadata": {},
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_fallback": False,
        "is_anomaly": False
    }
]

SAMPLE_PROVIDERS = [
    {"provider_id": "aws", "provider_name": "Amazon Web Services", "enabled": True, "api_version": "1.0", "rate_limit": 10},
    {"provider_id": "azure", "provider_name": "Microsoft Azure", "enabled": True, "api_version": "1.0", "rate_limit": 20}
]


@pytest.fixture
def client():
    """Create test client with mocked orchestrator."""
    from main import app

    mock_orch = MagicMock()
    mock_orch.get_available_providers.return_value = SAMPLE_PROVIDERS
    mock_orch.fetch_services = AsyncMock(return_value=[
        MagicMock(
            provider=s["provider"],
            category=s["category"],
            service_name=s["service_name"],
            unit=s["unit"],
            price_usd=s["price_usd"],
            tier_label=s["tier_label"],
            region=s["region"],
            vcpu=s.get("vcpu"),
            memory_gb=s.get("memory_gb"),
            storage_gb=None,
            metadata=s.get("metadata", {}),
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False
        )
        for s in SAMPLE_SERVICES
    ])
    mock_orch.get_provider_health = AsyncMock(return_value={
        "aws": {"status": "healthy", "response_time_ms": 120.0, "error": None, "checked_at": datetime.now(timezone.utc).isoformat()},
        "azure": {"status": "healthy", "response_time_ms": 95.0, "error": None, "checked_at": datetime.now(timezone.utc).isoformat()}
    })
    mock_orch.get_cache_stats.return_value = {"hits": 10, "misses": 2, "hit_rate": 83.3, "enabled": True}
    mock_orch.invalidate_cache.return_value = 5

    with patch("routes.providers.get_orchestrator", return_value=mock_orch):
        with TestClient(app) as c:
            yield c


# ── Provider Endpoint Tests ───────────────────────────────────────────────────

class TestProvidersEndpoint:

    def test_get_providers_returns_200(self, client):
        response = client.get("/api/providers")
        assert response.status_code == 200

    def test_get_providers_returns_list(self, client):
        response = client.get("/api/providers")
        data = response.json()
        assert data["status"] == "success"
        assert "providers" in data["data"]
        assert isinstance(data["data"]["providers"], list)

    def test_get_providers_includes_count(self, client):
        response = client.get("/api/providers")
        data = response.json()
        assert "count" in data["data"]
        assert data["data"]["count"] == 2

    def test_get_provider_services_returns_200(self, client):
        response = client.get("/api/providers/aws/services")
        assert response.status_code == 200

    def test_get_provider_services_has_pagination(self, client):
        response = client.get("/api/providers/aws/services")
        data = response.json()
        assert "pagination" in data["data"]
        pagination = data["data"]["pagination"]
        assert "page" in pagination
        assert "total_items" in pagination

    def test_get_provider_services_with_region_filter(self, client):
        response = client.get("/api/providers/aws/services?region=us-east-1")
        assert response.status_code == 200

    def test_get_provider_services_with_search(self, client):
        response = client.get("/api/providers/aws/services?search=EC2")
        assert response.status_code == 200

    def test_get_provider_services_pagination_params(self, client):
        response = client.get("/api/providers/aws/services?page=1&page_size=10")
        assert response.status_code == 200


# ── Search Endpoint Tests ─────────────────────────────────────────────────────

class TestSearchEndpoint:

    def test_search_services_returns_200(self, client):
        response = client.get("/api/services/search?providers=aws,azure")
        assert response.status_code == 200

    def test_search_services_returns_results(self, client):
        response = client.get("/api/services/search?providers=aws")
        data = response.json()
        assert data["status"] == "success"
        assert "services" in data["data"]

    def test_search_with_category_filter(self, client):
        response = client.get("/api/services/search?providers=aws&categories=Compute+%28VMs%29")
        assert response.status_code == 200

    def test_search_with_price_range(self, client):
        response = client.get("/api/services/search?providers=aws&min_price=0.01&max_price=1.0")
        assert response.status_code == 200

    def test_search_with_text_query(self, client):
        response = client.get("/api/services/search?providers=aws&search=EC2")
        assert response.status_code == 200

    def test_search_returns_pagination_info(self, client):
        response = client.get("/api/services/search?providers=aws")
        data = response.json()
        assert "pagination" in data["data"]

    def test_search_returns_filter_info(self, client):
        response = client.get("/api/services/search?providers=aws&search=vm")
        data = response.json()
        assert "filters" in data["data"]


# ── Comparison Endpoint Tests ─────────────────────────────────────────────────

class TestComparisonEndpoint:

    def test_compare_services_returns_200(self, client):
        response = client.post("/api/services/compare", json={"service_ids": [], "providers": ["aws", "azure"]})
        assert response.status_code == 200

    def test_compare_returns_comparison_data(self, client):
        response = client.post("/api/services/compare", json={"service_ids": [], "providers": ["aws", "azure"]})
        data = response.json()
        assert data["status"] == "success"
        assert "comparison" in data["data"]

    def test_compare_includes_cheapest_provider(self, client):
        response = client.post("/api/services/compare", json={"service_ids": [], "providers": ["aws", "azure"]})
        data = response.json()
        comparison = data["data"]["comparison"]
        if comparison:
            assert "cheapest_provider" in comparison[0]


# ── Health Endpoint Tests ─────────────────────────────────────────────────────

class TestHealthEndpoints:

    def test_health_check_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_provider_health_returns_200(self, client):
        response = client.get("/api/health/providers")
        assert response.status_code == 200

    def test_provider_health_returns_status_per_provider(self, client):
        response = client.get("/api/health/providers")
        data = response.json()
        assert data["status"] == "success"
        assert "aws" in data["data"]
        assert data["data"]["aws"]["status"] == "healthy"

    def test_cache_stats_returns_200(self, client):
        response = client.get("/api/stats/cache")
        assert response.status_code == 200

    def test_cache_stats_returns_hit_rate(self, client):
        response = client.get("/api/stats/cache")
        data = response.json()
        assert "hit_rate" in data["data"]


# ── Refresh Endpoint Tests ────────────────────────────────────────────────────

class TestRefreshEndpoint:

    def test_refresh_returns_200(self, client):
        response = client.post("/api/services/refresh?providers=aws")
        assert response.status_code == 200

    def test_refresh_returns_success_status(self, client):
        response = client.post("/api/services/refresh")
        data = response.json()
        assert data["status"] == "success"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
