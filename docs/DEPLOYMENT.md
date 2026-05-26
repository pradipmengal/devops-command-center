# Deployment Guide
> Task 23.1-23.3

## Quick Start (Development)

### Option 1: Run directly

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

### Option 2: Docker Compose (Recommended)

```bash
# Copy and configure environment
cp .env.example .env

# Start all services (backend + frontend + Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | None (in-memory) | Redis connection string |
| `CACHE_TTL_HOURS` | No | 6 | Cache TTL in hours |
| `AWS_RATE_LIMIT` | No | 10 | AWS requests/minute |
| `AZURE_RATE_LIMIT` | No | 20 | Azure requests/minute |
| `GCP_RATE_LIMIT` | No | 15 | GCP requests/minute |
| `ALLOWED_ORIGINS` | No | localhost | CORS allowed origins |
| `EXCHANGE_RATE_API_KEY` | No | None | For live exchange rates |

---

## Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Provider health
curl http://localhost:8000/api/health/providers

# Cache stats
curl http://localhost:8000/api/stats/cache
```

---

## Running Tests

```bash
# Backend tests (97 tests)
cd backend
python -m pytest -v

# Frontend build check
cd frontend
npm run build
```

---

## Production Notes

1. Set `DEBUG=false` in production
2. Use Redis for caching (`REDIS_URL=redis://your-redis:6379`)
3. Configure proper `ALLOWED_ORIGINS` for your domain
4. Use a reverse proxy (nginx) in front of both services
5. Enable HTTPS via your reverse proxy or load balancer
