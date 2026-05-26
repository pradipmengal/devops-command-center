# DevOps Command Center — Documentation

An enterprise-grade, self-hosted DevOps platform with **22 tools**, AI-powered features, a visual infrastructure designer, a Docker Intelligence Center, and a live FinOps cost dashboard.

---

## Quick Start

```bash
# With Docker
docker-compose up
# Open http://localhost:3000

# Without Docker — Terminal 1 (Backend)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Without Docker — Terminal 2 (Frontend)
cd frontend
npm install
npm run dev
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| State Management | Zustand (with localStorage persistence) |
| Code Editors | Monaco Editor (`@monaco-editor/react`) |
| Graph / Flow | ReactFlow |
| Backend | Python, FastAPI, Pydantic |
| AI | OpenAI, Google Gemini, Ollama (local) — SSE streaming |
| Live Pricing | httpx async HTTP client, Azure Retail Prices API, AWS Pricing JSON, GCP Pricing JSON |
| Deploy | Docker, Docker Compose, nginx |

---

## Project Structure

```
devops-command-center/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── routes/                    # One file per feature (18 route files)
│   │   ├── ai.py                  # AI streaming helpers + chat/error/docker endpoints
│   │   ├── cloud_pricing.py       # Live cloud pricing endpoints
│   │   ├── docker_intelligence.py # Docker Intelligence Center endpoints
│   │   └── ...                    # 15 other tool routes
│   ├── services/
│   │   └── cloud_pricing_sync.py  # Live pricing sync (Azure/AWS/GCP) with TTL cache
│   └── tests/                     # pytest + Hypothesis property-based tests
├── frontend/
│   ├── src/
│   │   ├── pages/                 # One page per tool (22 pages)
│   │   ├── components/            # Shared + feature-specific UI components
│   │   │   └── docker-intelligence/  # Docker Intelligence Center components
│   │   ├── hooks/                 # useAIStream, useAIRequest
│   │   ├── context/               # AISettingsContext
│   │   ├── store/                 # Zustand stores (Docker Intelligence, FinOps Dashboard)
│   │   ├── data/                  # Cloud cost dataset + utility functions
│   │   └── terraform-builder/     # Visual builder (self-contained)
│   └── package.json
└── docker-compose.yml
```

---

## All Features

### ✨ AI Features

| Feature | Route | Description |
|---------|-------|-------------|
| **Error Explainer** | `/ai-error` | AI diagnoses errors with root cause and fix steps |
| **Dockerfile Optimizer** | `/ai-docker` | AI reviews and optimizes Dockerfiles with inline suggestions |
| **DevOps Chat** | `/ai-chat` | Multi-turn conversational AI for DevOps Q&A |
| **Docker Intelligence Center** | `/docker-intelligence` | Enterprise AI-powered Docker operations cockpit (see below) |

---

### 🐳 Docker Intelligence Center (`/docker-intelligence`)

An enterprise-grade AI-native Docker operations cockpit combining Docker Desktop, Grafana, Warp Terminal, and Kubernetes Lens into a single experience.

**9 integrated modules:**

| Module | Description |
|--------|-------------|
| **Dockerfile Workspace** | Monaco Editor with 8 AI toolbar actions (Optimize, Secure, Multi-stage, Reduce Size, Explain, Troubleshoot, Generate Compose, Scan Security) |
| **AI Analysis Dashboard** | 8 animated metric cards — Security Score, Optimization Score, Layer Efficiency, Build Performance, Image Size, Vulnerability Count, Risk Level, Cache Efficiency |
| **Findings Panel** | AI-detected issues with severity badges (Critical/High/Medium/Low), affected lines, explanations, and one-click Apply Fix |
| **Layer Visualizer** | Interactive ReactFlow diagram of Docker image layers with heatmap mode (size-based coloring) and cache hit/miss indicators |
| **Security Intelligence** | CVE table with severity sorting, fix-availability filter, and AI-streamed vulnerability explanations |
| **AI Assistant Panel** | Persistent Docker-aware conversational AI with suggested prompts, Markdown rendering, and streaming responses |
| **Container Runtime Monitor** | Live container table with CPU/memory/restart/health status, log viewer, and AI anomaly detection |
| **Docker Compose Generator** | Select from 8 services (PostgreSQL, MySQL, Redis, MongoDB, Nginx, RabbitMQ, Elasticsearch, Kafka) and stream a production-ready `docker-compose.yml` |
| **Streaming Terminal** | Bottom-dock terminal with `explain:` prefix for AI command explanations and Docker autocomplete |

**AI endpoints (all SSE streaming):**
- `POST /docker-intelligence/analyze` — quality metrics
- `POST /docker-intelligence/optimize` — general / multi-stage / reduce-size modes
- `POST /docker-intelligence/security-scan` — CVE and vulnerability analysis
- `POST /docker-intelligence/explain` — Docker Q&A with Dockerfile context
- `POST /docker-intelligence/troubleshoot` — build/runtime error diagnosis
- `POST /docker-intelligence/compose` — docker-compose.yml generation
- `POST /docker-intelligence/layers` — layer-by-layer analysis
- `GET /docker-intelligence/containers` — mock container runtime data

---

### 💰 Cloud Cost FinOps Dashboard (`/cloud-cost`)

An enterprise FinOps analytics platform with live pricing data fetched from cloud provider APIs.

**Live pricing sources (no API keys required):**
- **Azure** — Azure Retail Prices API (`prices.azure.com`)
- **AWS** — AWS EC2 Pricing JSON (`pricing.us-east-1.amazonaws.com`)
- **GCP** — GCP Pricing Calculator JSON (`cloudpricingcalculator.appspot.com`)
- 1-hour in-memory cache with per-provider fallback to static reference data

**Dashboard modules:**

| Module | Description |
|--------|-------------|
| **KPI Metric Cards** | 4 animated cards — Total Services, Cheapest Provider, Priciest Category, Avg Service Cost |
| **Chart Suite** | 4 chart types in tabs: Bar (provider comparison), Pie (category breakdown), Heatmap (intensity grid), Trend (time series with forecast) |
| **Cost Forecasting** | Linear regression forecast for next 3 periods with dashed line; adjustable budget threshold indicator |
| **Savings Widget** | Top-5 provider-switch savings opportunities with amount and percentage |
| **Leaderboard** | Top-10 most expensive services with gold/silver/bronze rank badges and relative bar indicators |
| **Anomaly Detection** | Statistical outlier detection (2σ threshold per category) with warning badges |
| **Drill-Down Analytics** | Click any category to expand inline per-service detail with cheapest/most-expensive highlights |
| **AI Insights Panel** | Collapsible AI panel with shortcut prompts (spending spikes, reserved instances, idle resources, unusual patterns) |
| **Enhanced Filters** | Real-time search, region filter (US East/West, EU West, Asia Pacific with price multipliers), provider toggles, category checklist |
| **Export** | CSV download (with region-adjusted prices) and PDF via browser print |
| **Compact / Expanded Mode** | Toggle between full-size and condensed layouts (persisted to localStorage) |
| **Sync Prices** | Manual refresh button to force-fetch latest prices from all three providers |

**27 service categories covered:**
Compute (VMs), Managed Kubernetes, Object Storage, Managed Databases, Container Registry, Load Balancers, Serverless Functions, CDN, VPC/Networking, Networking Egress, Managed Cache, Messaging & Queues, Managed Kafka/Streaming, Block Storage, Monitoring & Logging, Secret Management, Data Warehousing, DNS, Email/Notifications, API Gateway, Container Orchestration (Serverless), Identity & Access (IAM), CI/CD Pipeline, Artifact/Package Registry, Machine Learning Platform, Backup & Disaster Recovery, File Storage (NFS/SMB)

**Live pricing endpoints:**
- `GET /cloud-pricing/prices` — cached live prices (falls back to static)
- `POST /cloud-pricing/sync` — force-invalidate cache and re-fetch
- `GET /cloud-pricing/status` — cache state and last sync time

---

### 🏗️ Infrastructure Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Docker Generator** | `/docker` | Generate production Dockerfiles for 18 app types |
| **Kubernetes Validator** | `/k8s` | Validate K8s YAML with best-practice suggestions |
| **Terraform Snippets** | `/terraform` | Generate HCL for 8 AWS resource types |
| **CI/CD Generator** | `/cicd` | GitHub Actions, GitLab CI, Jenkins pipelines |
| **Visual Builder** | `/terraform-builder` | Full-screen drag & drop Terraform/Ansible designer |

---

### 🔐 Security Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Base64** | `/base64` | Encode / decode Base64 |
| **JWT Decoder** | `/jwt` | Decode JWT tokens, inspect claims, check expiry |
| **Hash Generator** | `/hash` | MD5, SHA-1, SHA-256, SHA-512 |

---

### 🔀 Data & Format Tools

| Tool | Route | Description |
|------|-------|-------------|
| **JSON ↔ YAML** | `/converter` | Bidirectional conversion with validation |
| **Regex Tester** | `/regex` | Test patterns with flags and capture groups |

---

### 🌐 Network Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Subnet Calculator** | `/subnet` | CIDR to network/broadcast/hosts/usable range |
| **curl Builder** | `/curl` | Build curl commands from a form UI |

---

### 🛠️ Utility Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Cron Builder** | `/cron` | Build cron expressions with human-readable descriptions |
| **Timestamp Converter** | `/timestamp` | Unix ↔ human-readable date conversion |
| **UUID Generator** | `/uuid` | Generate and validate v1, v4, v5 UUIDs |
| **.gitignore Generator** | `/gitignore` | Merge templates for 14 languages and tools |

---

## AI Configuration

Configure via the ⚙️ button in the sidebar footer. Your API key is stored in `localStorage` — never sent to any server other than the provider you configure.

| Provider | Base URL | Free Tier | Recommended Models |
|----------|----------|-----------|-------------------|
| **Google Gemini** | `https://generativelanguage.googleapis.com` | ✅ Yes | `gemini-2.0-flash`, `gemini-2.0-flash-lite` |
| **OpenAI** | `https://api.openai.com/v1` | ❌ No | `gpt-4o-mini`, `gpt-4o` |
| **Ollama (local)** | `http://localhost:11434/v1` | ✅ Free | `qwen2.5-coder:3b`, `llama3`, `mistral` |

**Streaming:** All AI responses stream token-by-token via Server-Sent Events (SSE). A blinking cursor shows while generating. TTFT (time-to-first-token) badge appears after the first token arrives.

**For Docker (Ollama):** Use `http://host.docker.internal:11434/v1` instead of `localhost`.

---

## Terraform Visual Builder (`/terraform-builder`)

Full-screen drag & drop infrastructure designer — runs outside the main sidebar layout.

- **Providers:** AWS (60+ resources), Azure, GCP, Ansible
- **Canvas:** ReactFlow with zoom, pan, minimap, snap-to-grid, connection validation
- **Right panels:** Generated HCL code (Monaco Editor), Cost estimate, Security audit, Diff view
- **Blueprints:** Pre-built architecture templates (3-tier web app, EKS cluster, serverless, etc.)
- **Export:** Download as `.tf` files or ZIP archive

---

## API Reference

### Response Envelope

All endpoints return a consistent JSON envelope:

```json
{ "status": "success", "data": { ... } }
{ "status": "error",   "data": { "message": "..." } }
```

HTTP status codes: `200` (success or domain error) · `422` (validation error) · `500` (server error)

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/ai/providers` | List supported AI providers and models |
| `POST` | `/ai/test-connection` | Test AI provider connectivity |
| `POST` | `/ai/chat` | Streaming DevOps chat |
| `POST` | `/ai/explain-error` | Streaming error explanation |
| `POST` | `/ai/optimize-dockerfile` | Streaming Dockerfile optimization |
| `POST` | `/docker-intelligence/analyze` | Streaming Dockerfile analysis |
| `POST` | `/docker-intelligence/optimize` | Streaming optimization (general/multistage/reduce-size) |
| `POST` | `/docker-intelligence/security-scan` | Streaming security scan |
| `POST` | `/docker-intelligence/explain` | Streaming Docker Q&A |
| `POST` | `/docker-intelligence/troubleshoot` | Streaming troubleshooting |
| `POST` | `/docker-intelligence/compose` | Streaming Compose generation |
| `POST` | `/docker-intelligence/layers` | Streaming layer analysis |
| `GET` | `/docker-intelligence/containers` | Mock container runtime data |
| `GET` | `/cloud-pricing/prices` | Live cloud pricing (cached) |
| `POST` | `/cloud-pricing/sync` | Force-refresh live pricing |
| `GET` | `/cloud-pricing/status` | Pricing cache status |

Full interactive API docs: `http://localhost:8000/docs`

---

## Running Tests

```bash
# Backend — pytest + Hypothesis property-based tests
cd backend
python -m pytest tests/ -v

# Frontend — Vitest + fast-check property-based tests
cd frontend
npm test
```

---

## Environment Variables

No environment variables are required for local development.

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `8000` | FastAPI port |
| `FRONTEND_PORT` | `3000` | nginx / Vite port |

---

## Docker

```bash
docker-compose build    # Build all images
docker-compose up       # Start (http://localhost:3000)
docker-compose up -d    # Start in background
docker-compose down     # Stop and remove containers
docker-compose logs -f  # Follow logs
```

Swagger UI: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

---

## Feature Summary

| Category | Count | Features |
|----------|-------|---------|
| AI Features | 4 | Error Explainer, Dockerfile Optimizer, DevOps Chat, Docker Intelligence Center |
| Docker Intelligence | 9 modules | Workspace, Analysis, Findings, Layers, Security, AI Assistant, Runtime Monitor, Compose Generator, Terminal |
| FinOps Dashboard | 11 modules | KPI Cards, 4 Charts, Forecasting, Savings, Leaderboard, Anomaly Detection, Drill-Down, AI Insights, Filters, Export, Sync |
| Infrastructure | 5 | Docker, Kubernetes, Terraform, CI/CD, Visual Builder |
| Security | 3 | Base64, JWT, Hash |
| Data & Format | 2 | JSON↔YAML, Regex |
| Network | 2 | Subnet, curl |
| Utilities | 4 | Cron, Timestamp, UUID, .gitignore |
| **Total** | **22 tools** | |
