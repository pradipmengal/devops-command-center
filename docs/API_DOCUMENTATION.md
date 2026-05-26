# Multi-Cloud Cost Intelligence Platform — API Documentation
> Task 22.1

## Base URL
```
http://localhost:8000
```

---

## Authentication
All endpoints are currently public. API key support can be added per provider via the `validate_credentials` method.

---

## Endpoints

### Providers

#### `GET /api/providers`
Returns all registered cloud providers with metadata.

**Response:**
```json
{
  "status": "success",
  "data": {
    "providers": [
      {
        "provider_id": "aws",
        "provider_name": "Amazon Web Services",
        "enabled": true,
        "api_version": "1.0",
        "rate_limit": 10
      }
    ],
    "count": 3
  }
}
```

---

#### `GET /api/providers/{provider_id}/services`
Fetch paginated service catalog for a specific provider.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `region` | string | null | Filter by region (e.g. `us-east-1`) |
| `category` | string | null | Filter by category |
| `search` | string | null | Search term |
| `page` | int | 1 | Page number |
| `page_size` | int | 100 | Items per page (max 500) |

**Response:**
```json
{
  "status": "success",
  "data": {
    "provider_id": "aws",
    "services": [...],
    "pagination": {
      "page": 1,
      "page_size": 100,
      "total_items": 247,
      "total_pages": 3
    }
  }
}
```

---

#### `GET /api/services/search`
Search services across multiple providers.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `providers` | string | Comma-separated provider IDs |
| `regions` | string | Comma-separated regions |
| `categories` | string | Comma-separated categories |
| `search` | string | Search term |
| `min_price` | float | Minimum price filter |
| `max_price` | float | Maximum price filter |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Example:**
```
GET /api/services/search?providers=aws,azure&categories=Compute+%28VMs%29&search=medium&min_price=0.01&max_price=1.0
```

---

#### `POST /api/services/compare`
Compare services side-by-side across providers.

**Request Body:**
```json
{
  "service_ids": [],
  "providers": ["aws", "azure", "gcp"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "comparison": [
      {
        "category": "Compute (VMs)",
        "cheapest_provider": "aws",
        "cheapest_price": 0.0416,
        "services": [
          {
            "provider": "aws",
            "service_name": "EC2 t3.medium",
            "price_usd": 0.0416,
            "is_cheapest": true,
            "price_difference": 0,
            "price_difference_pct": 0
          }
        ]
      }
    ],
    "total_categories": 5
  }
}
```

---

### Cost Estimation

#### `POST /api/cost/estimate`
Estimate costs based on usage parameters.

**Request Body:**
```json
{
  "providers": ["aws", "azure"],
  "categories": ["Compute (VMs)"],
  "compute_hours": 730,
  "storage_gb": 100,
  "network_egress_gb": 50,
  "api_calls": 1000000,
  "data_transfer_gb": 20
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "estimates": [...],
    "totals": {
      "hourly": 0.0416,
      "daily": 0.9984,
      "monthly": 30.37,
      "annual": 364.44
    },
    "by_provider": {
      "aws": { "count": 5, "monthly_cost": 150.20, "annual_cost": 1802.40 }
    },
    "by_category": {
      "Compute (VMs)": { "count": 3, "monthly_cost": 90.10, "annual_cost": 1081.20 }
    },
    "service_count": 8
  }
}
```

---

### AI Optimization

#### `POST /api/optimization/analyze`
Analyze services and return AI-powered optimization suggestions.

**Request Body:**
```json
{
  "providers": ["aws", "azure"],
  "categories": ["Compute (VMs)"],
  "compute_hours": 730
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "suggestions": [
      {
        "suggestion_id": "ri-abc123",
        "category": "Reserved Instances",
        "current_provider": "aws",
        "current_cost": 100.00,
        "optimized_cost": 65.00,
        "savings_amount": 35.00,
        "savings_percentage": 35.0,
        "action_steps": ["Purchase 1-year reserved instance"],
        "affected_services": ["EC2 t3.medium"],
        "confidence_score": 0.85
      }
    ],
    "suggestion_count": 4,
    "total_potential_savings_monthly": 142.50,
    "total_potential_savings_annual": 1710.00
  }
}
```

---

### Health & Monitoring

#### `GET /health`
Basic health check.

**Response:** `{ "status": "ok", "version": "2.0.0" }`

#### `GET /api/health/providers`
Check health of all provider APIs.

**Response:**
```json
{
  "status": "success",
  "data": {
    "aws": { "status": "healthy", "response_time_ms": 120.5, "error": null },
    "azure": { "status": "healthy", "response_time_ms": 95.2, "error": null }
  }
}
```

#### `GET /api/stats/cache`
Cache performance statistics.

#### `GET /api/stats/rate-limit`
Rate limiting statistics per provider.

---

### Currency

#### `GET /api/currency/rates`
Get current exchange rates (USD base).

#### `GET /api/currency/convert?amount=100&from_currency=USD&to_currency=EUR`
Convert a price between currencies.

---

### Sharing

#### `POST /api/share/create`
Create a shareable link for comparison state.

**Request Body:**
```json
{ "state": { "providers": ["aws"], "services": [...] }, "title": "My Comparison" }
```

**Response:**
```json
{ "status": "success", "data": { "share_id": "abc123", "share_url": "/shared/abc123", "expires_at": "..." } }
```

#### `GET /api/share/{share_id}`
Retrieve shared state by ID.

---

## Error Responses

All errors follow this format:
```json
{
  "status": "error",
  "message": "Description of what went wrong"
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 200 | Success |
| 404 | Resource not found |
| 410 | Share link expired |
| 500 | Internal server error |

---

## Interactive Docs
FastAPI auto-generates interactive documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
