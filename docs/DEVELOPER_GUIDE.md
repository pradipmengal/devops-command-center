# Multi-Cloud Cost Intelligence Platform — Developer Guide
> Task 22.3

## Architecture Overview

```
devops-command-center/
├── backend/
│   ├── providers/          # Provider plugin system
│   │   ├── base.py         # ProviderPlugin abstract base class
│   │   ├── registry.py     # ProviderRegistry singleton
│   │   ├── aws.py          # AWS provider implementation
│   │   ├── azure.py        # Azure provider implementation
│   │   └── gcp.py          # GCP provider implementation
│   ├── services/           # Business logic layer
│   │   ├── pricing_orchestrator.py  # Parallel provider fetching
│   │   ├── cache_manager.py         # Redis/in-memory caching
│   │   ├── rate_limiter.py          # Per-provider rate limiting
│   │   ├── cost_estimator.py        # Cost calculation engine
│   │   ├── optimization_agent.py    # AI optimization suggestions
│   │   ├── currency_converter.py    # Exchange rate conversion
│   │   └── export_service.py        # CSV/JSON export
│   ├── routes/             # FastAPI route handlers
│   │   ├── providers.py    # /api/providers, /api/services/*
│   │   ├── cost.py         # /api/cost/*
│   │   ├── optimization.py # /api/optimization/*
│   │   ├── sharing.py      # /api/share/*
│   │   └── currency.py     # /api/currency/*
│   ├── models/
│   │   └── service.py      # ServiceEntry, OptimizationSuggestion, etc.
│   └── tests/              # pytest test suites
├── frontend/
│   └── src/
│       ├── components/multi-cloud/  # All multi-cloud UI components
│       ├── hooks/                   # useComparison, usePagination
│       └── pages/
│           └── MultiCloudDashboard.jsx
└── docs/                   # Documentation
```

---

## Adding a New Cloud Provider

### Step 1: Create the provider class

```python
# backend/providers/myprovider.py
from .base import ProviderPlugin
from typing import List, Dict, Any, Optional

class MyProvider(ProviderPlugin):
    def __init__(self):
        super().__init__(
            provider_id="myprovider",
            provider_name="My Cloud Provider",
            api_version="1.0",
            rate_limit=10  # requests per minute
        )

    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Fetch services from your provider's API."""
        # Call your provider's pricing API
        raw_data = await self._fetch_from_api(region)
        
        # Normalize to unified schema
        return [
            {
                "provider": self.provider_id,
                "category": self._map_category(item["service_type"]),
                "service_name": item["name"],
                "unit": "per hour",
                "price_usd": float(item["price"]),
                "tier_label": "On-Demand",
                "region": region or item.get("region"),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": False,
                "is_anomaly": False
            }
            for item in raw_data
        ]

    async def get_pricing_data(self, service_id: str, region=None) -> Dict:
        return {"service_id": service_id, "base_price": 0.0, "pricing_tiers": [], "regional_pricing": {}, "metadata": {}}

    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {"region_id": "us-west-1", "region_name": "US West", "location": "North America"}
        ]

    async def validate_credentials(self, api_key=None, **kwargs) -> bool:
        return True  # or validate your API key

    def _map_category(self, service_type: str) -> str:
        mapping = {
            "compute": "Compute (VMs)",
            "storage": "Object Storage",
            "database": "Relational Database"
        }
        return mapping.get(service_type.lower(), "Other")
```

### Step 2: Auto-discovery handles registration

The `ProviderRegistry.auto_discover_providers()` method automatically finds and registers any class in `backend/providers/` that inherits from `ProviderPlugin`. No manual registration needed.

### Step 3: Add tests

```python
# backend/tests/test_myprovider.py
import pytest
from providers.myprovider import MyProvider

@pytest.mark.asyncio
async def test_get_service_catalog():
    provider = MyProvider()
    catalog = await provider.get_service_catalog()
    assert isinstance(catalog, list)
    # Verify required fields
    for service in catalog:
        assert "provider" in service
        assert "service_name" in service
        assert "price_usd" in service
```

---

## Extending the Pricing Orchestrator

The `PricingOrchestrator` accepts optional `cache_manager` and `rate_limiter` arguments:

```python
from services.pricing_orchestrator import PricingOrchestrator
from services.cache_manager import CacheManager
from services.rate_limiter import RateLimiter

cache = CacheManager(backend='redis', redis_url='redis://localhost:6379', ttl_hours=6)
limiter = RateLimiter(default_max_requests=10, default_window_seconds=60)
limiter.configure_provider('myprovider', max_requests=5, window_seconds=60)

orchestrator = PricingOrchestrator(
    registry=registry,
    cache_manager=cache,
    rate_limiter=limiter
)
```

---

## Adding a New API Route

```python
# backend/routes/myroute.py
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/myfeature", tags=["myfeature"])

@router.get("/data")
async def get_data():
    return {"status": "success", "data": {...}}
```

Register in `main.py`:
```python
from routes import myroute
app.include_router(myroute.router)
```

---

## Adding a New Frontend Component

```jsx
// frontend/src/components/multi-cloud/MyComponent.jsx
import React from 'react';

const MyComponent = ({ data, onAction, className = '' }) => {
  return (
    <div
      className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}
      role="region"
      aria-label="My Component"
    >
      {/* Always include ARIA labels on interactive elements */}
      <button
        onClick={onAction}
        aria-label="Perform action"
        className="focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Action
      </button>
    </div>
  );
};

export default MyComponent;
```

Export from `index.js`:
```js
export { default as MyComponent } from './MyComponent';
```

---

## Running Tests

### Backend
```bash
cd backend
# All tests
python -m pytest -v

# Specific test file
python -m pytest tests/test_providers.py -v

# With coverage
python -m pytest --cov=. --cov-report=html
```

### Frontend
```bash
cd frontend
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Environment Variables

See `docs/DEPLOYMENT.md` for the full list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `None` (uses in-memory) |
| `CACHE_TTL_HOURS` | Cache TTL in hours | `6` |
| `AWS_RATE_LIMIT` | AWS requests/minute | `10` |
| `AZURE_RATE_LIMIT` | Azure requests/minute | `20` |
| `GCP_RATE_LIMIT` | GCP requests/minute | `15` |

---

## Code Style

- **Python**: Follow PEP 8, use type hints, write docstrings for all public methods
- **React**: Functional components with hooks, JSDoc comments, ARIA attributes on all interactive elements
- **Tests**: Aim for 80% coverage on backend, 70% on frontend
- **Naming**: `snake_case` for Python, `camelCase` for JS/JSX, `PascalCase` for React components

---

## Deployment

See `docs/DEPLOYMENT.md` for Docker and production deployment instructions.
