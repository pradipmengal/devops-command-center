# ⚙️ DevOps Command Center

A production-ready, single-page web application that bundles **15 commonly used DevOps utilities** into one clean, dark-mode interface. Built with a React frontend and a FastAPI backend, deployed with Docker Compose in a single command.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Running Without Docker](#running-without-docker)
- [API Reference](#api-reference)
- [Tech Stack](#tech-stack)
- [Testing](#testing)
- [How Each Tool Works](#how-each-tool-works)
- [Adding a New Tool](#adding-a-new-tool)

---

## Overview

DevOps Command Center is a self-hosted utility dashboard. Every tool runs entirely on your local machine — no data is sent to external servers. You fill in a form, the frontend sends a request to the local FastAPI backend, and the result is displayed instantly with a copy-to-clipboard button.

```
Browser → React (port 3000) → nginx proxy → FastAPI (port 8000)
```

---

## Features

### 🏗️ Infrastructure
| Tool | Description |
|------|-------------|
| **Dockerfile Generator** | Generate production-ready Dockerfiles for 18 app types (Node.js, Python, Java, Go, Rust, Rails, PHP, Django, FastAPI, .NET, React, Next.js, Vue, Angular, Python ML, PySpark, Deno, Bun) |
| **Kubernetes YAML Validator** | Parse and validate K8s manifests using PyYAML, with best-practice suggestions (missing labels, resource limits, replicas) |
| **Terraform Snippet Generator** | Generate HCL snippets for 8 AWS resources (EC2, S3, RDS, VPC, IAM Role, Lambda, ECS, Security Group) |
| **CI/CD Pipeline Generator** | Generate complete pipeline files for GitHub Actions, GitLab CI, or Jenkins across 6 languages |

### 🔐 Security & Encoding
| Tool | Description |
|------|-------------|
| **Base64 Encoder/Decoder** | Encode text to Base64 or decode Base64 back to UTF-8 |
| **JWT Decoder** | Decode JWT header and payload, check expiry, display claims — no secret needed |
| **Hash Generator** | Generate MD5, SHA-1, SHA-224, SHA-256, SHA-384, SHA-512 hashes |

### 📄 Data & Format
| Tool | Description |
|------|-------------|
| **JSON ↔ YAML Converter** | Bidirectional conversion with full syntax validation |
| **Regex Tester** | Test patterns, view all matches, capture groups, named groups, with i/m/s flags |

### 🌐 Network
| Tool | Description |
|------|-------------|
| **IP Subnet Calculator** | Calculate network address, broadcast, usable hosts, masks, and IP class from CIDR |
| **curl Command Builder** | Build complete curl commands from a form — method, headers, body, auth, flags |

### ⚡ Utilities
| Tool | Description |
|------|-------------|
| **Cron Expression Builder** | Build cron expressions from individual fields with quick presets and human-readable descriptions |
| **Unix Timestamp Converter** | Convert between Unix timestamps and human-readable dates across 8 timezones |
| **UUID Generator & Validator** | Generate v1, v4, or v5 UUIDs in bulk (up to 20), or validate an existing UUID |
| **.gitignore Generator** | Generate merged, deduplicated .gitignore files from 14 templates (languages, frameworks, OS, tools) |

---

## Architecture

```
devops-command-center/
│
├── docker-compose.yml          ← Orchestrates both services
│
├── backend/                    ← FastAPI Python service (port 8000)
│   ├── main.py                 ← App factory, CORS, router registration
│   ├── models.py               ← Pydantic request/response models
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routes/                 ← One file per tool
│       ├── docker.py           POST /docker/generate
│       ├── k8s.py              POST /k8s/validate
│       ├── terraform.py        POST /terraform/generate
│       ├── utils.py            POST /utils/base64
│       ├── cron.py             POST /cron/build
│       ├── jwt.py              POST /jwt/decode
│       ├── hash.py             POST /hash/generate
│       ├── converter.py        POST /converter/convert
│       ├── regex.py            POST /regex/test
│       ├── timestamp.py        POST /timestamp/convert
│       ├── subnet.py           POST /subnet/calculate
│       ├── gitignore.py        POST /gitignore/generate
│       ├── curl.py             POST /curl/build
│       ├── uuid.py             POST /uuid/generate, /uuid/validate
│       └── cicd.py             POST /cicd/generate
│
└── frontend/                   ← React + Vite + Tailwind CSS (port 3000)
    ├── nginx.conf              ← Serves static files, proxies /api/* to backend
    ├── Dockerfile              ← Multi-stage: node:18 build → nginx:alpine serve
    ├── src/
    │   ├── App.jsx             ← Layout shell + React Router routes
    │   ├── main.jsx            ← Entry point
    │   ├── index.css           ← Tailwind directives + custom utilities
    │   ├── components/
    │   │   ├── Sidebar.jsx     ← Collapsible navigation with tool groups
    │   │   ├── OutputPanel.jsx ← Shared output display (loading/error/content)
    │   │   ├── CopyButton.jsx  ← Clipboard copy with confirmation
    │   │   ├── LoadingSpinner.jsx
    │   │   └── PageHeader.jsx  ← Consistent page title/description
    │   └── pages/              ← One file per tool page
    │       ├── HomePage.jsx    ← Dashboard with tool grid
    │       ├── DockerPage.jsx
    │       ├── K8sPage.jsx
    │       ├── TerraformPage.jsx
    │       ├── Base64Page.jsx
    │       ├── CronPage.jsx
    │       ├── JwtPage.jsx
    │       ├── HashPage.jsx
    │       ├── ConverterPage.jsx
    │       ├── RegexPage.jsx
    │       ├── TimestampPage.jsx
    │       ├── SubnetPage.jsx
    │       ├── GitignorePage.jsx
    │       ├── CurlPage.jsx
    │       ├── UuidPage.jsx
    │       └── CicdPage.jsx
```

### Request Flow

```
User fills form
    ↓
React page calls axios.post('/api/<endpoint>', payload)
    ↓
nginx receives request on port 3000
    ↓
nginx proxies /api/* → http://backend:8000/* (strips /api prefix)
    ↓
FastAPI route handler validates input with Pydantic
    ↓
Route logic runs (generate/validate/convert)
    ↓
Returns { "status": "success" | "error", "data": { ... } }
    ↓
React displays result in OutputPanel with Copy button
```

### API Response Envelope

Every endpoint returns the same JSON shape:

```json
// Success
{ "status": "success", "data": { ... } }

// Error
{ "status": "error", "data": { "message": "..." } }
```

HTTP status codes:
- `200` — success or domain-level error (e.g. invalid YAML)
- `422` — validation error (unsupported type, out-of-range value)
- `500` — unhandled server exception

---

## Project Structure

```
devops-command-center/
├── README.md
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── models.py
│   ├── routes/          (15 route files)
│   └── tests/           (5 test files, 110 tests)
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── components/  (5 components + tests)
        └── pages/       (16 pages)
```

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Clone or download the project

```bash
git clone <repo-url>
cd devops-command-center
```

### 2. Build the images

```bash
docker-compose build
```

This builds two images:
- `devops-command-center-backend` — Python 3.10-slim with FastAPI
- `devops-command-center-frontend` — Node 18 build → nginx:alpine

### 3. Start the application

```bash
docker-compose up
```

Or run in the background:

```bash
docker-compose up -d
```

### 4. Open in browser

```
http://localhost:3000
```

The backend API is also directly accessible at:

```
http://localhost:8000
http://localhost:8000/docs    ← Swagger UI (interactive API docs)
http://localhost:8000/redoc   ← ReDoc API docs
```

### 5. Stop the application

```bash
docker-compose down
```

---

## Running Without Docker

### Backend

**Requirements:** Python 3.10+

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at `http://localhost:8000`.

### Frontend

**Requirements:** Node.js 18+

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server (proxies /api/* to localhost:8000)
npm run dev
```

The frontend will be available at `http://localhost:5173` (Vite default).

> **Note:** The Vite dev server is pre-configured to proxy `/api/*` requests to `http://localhost:8000` — see `vite.config.js`.

---

## API Reference

All endpoints accept and return `application/json`.

### Health Check

```
GET /health
→ { "status": "ok" }
```

---

### Dockerfile Generator

```
POST /docker/generate
Body: { "app_type": "nodejs" }
```

Supported `app_type` values:
`nodejs`, `python`, `java`, `go`, `rust`, `rails`, `php`, `django`, `fastapi`, `dotnet`, `react`, `nextjs`, `vue`, `angular`, `python_ml`, `pyspark`, `deno`, `bun`

```json
// Response
{
  "status": "success",
  "data": { "dockerfile": "FROM node:20-alpine\n..." }
}
```

---

### Kubernetes YAML Validator

```
POST /k8s/validate
Body: { "yaml_content": "apiVersion: apps/v1\nkind: Deployment\n..." }
```

```json
// Valid YAML
{ "status": "success", "data": { "valid": true, "suggestions": ["..."] } }

// Invalid YAML
{ "status": "error", "data": { "valid": false, "error": "mapping values are not allowed here" } }
```

---

### Terraform Snippet Generator

```
POST /terraform/generate
Body: { "resource_type": "ec2" }
```

Supported `resource_type` values:
`ec2`, `s3`, `rds`, `vpc`, `iam_role`, `lambda`, `ecs`, `security_group`

```json
{ "status": "success", "data": { "snippet": "provider \"aws\" {\n..." } }
```

---

### Base64 Encoder/Decoder

```
POST /utils/base64
Body: { "text": "hello world", "mode": "encode" }
       { "text": "aGVsbG8gd29ybGQ=", "mode": "decode" }
```

```json
{ "status": "success", "data": { "result": "aGVsbG8gd29ybGQ=" } }
```

---

### Cron Expression Builder

```
POST /cron/build
Body: { "minute": "0", "hour": "9", "day": "*", "month": "*", "weekday": "1" }
```

```json
{
  "status": "success",
  "data": {
    "expression": "0 9 * * 1",
    "description": "At minute 0, at hour 9, every day of month, every month, at weekday 1"
  }
}
```

---

### JWT Decoder

```
POST /jwt/decode
Body: { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

```json
{
  "status": "success",
  "data": {
    "header": { "alg": "HS256", "typ": "JWT" },
    "payload": { "sub": "1234567890", "name": "John Doe" },
    "signature": "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "is_expired": false,
    "expires_in_seconds": 3600
  }
}
```

---

### Hash Generator

```
POST /hash/generate
Body: { "text": "hello world", "algorithm": "sha256" }
```

Supported algorithms: `md5`, `sha1`, `sha224`, `sha256`, `sha384`, `sha512`

```json
{
  "status": "success",
  "data": { "hash": "b94d27b9934d3e08...", "algorithm": "sha256", "input_length": 11 }
}
```

---

### JSON ↔ YAML Converter

```
POST /converter/convert
Body: { "content": "{\"name\": \"test\"}", "from_format": "json" }
       { "content": "name: test", "from_format": "yaml" }
```

```json
{ "status": "success", "data": { "result": "name: test\n", "from_format": "json", "to_format": "yaml" } }
```

---

### Regex Tester

```
POST /regex/test
Body: { "pattern": "\\d+", "test_string": "abc 123 def 456", "flags": ["i"] }
```

```json
{
  "status": "success",
  "data": {
    "is_match": true,
    "match_count": 2,
    "matches": [
      { "match": "123", "start": 4, "end": 7, "groups": [], "named_groups": {} },
      { "match": "456", "start": 12, "end": 15, "groups": [], "named_groups": {} }
    ],
    "flags_applied": []
  }
}
```

---

### Unix Timestamp Converter

```
POST /timestamp/convert
Body: { "value": "1700000000", "mode": "to_date" }
       { "value": "2024-01-15 12:00:00", "mode": "to_timestamp" }
```

```json
{
  "status": "success",
  "data": {
    "unix_timestamp": 1700000000,
    "utc": "2023-11-14 22:13:20 UTC",
    "iso8601": "2023-11-14T22:13:20+00:00",
    "relative": "5 months ago",
    "timezones": { "UTC": "2023-11-14 22:13:20 UTC", "US/Eastern": "..." }
  }
}
```

---

### IP Subnet Calculator

```
POST /subnet/calculate
Body: { "cidr": "192.168.1.0/24" }
```

```json
{
  "status": "success",
  "data": {
    "cidr": "192.168.1.0/24",
    "network_address": "192.168.1.0",
    "broadcast_address": "192.168.1.255",
    "subnet_mask": "255.255.255.0",
    "wildcard_mask": "0.0.0.255",
    "prefix_length": 24,
    "total_addresses": 256,
    "usable_hosts": 254,
    "first_host": "192.168.1.1",
    "last_host": "192.168.1.254",
    "ip_class": "C",
    "is_private": true,
    "is_loopback": false
  }
}
```

---

### .gitignore Generator

```
POST /gitignore/generate
Body: { "types": ["node", "python", "vscode", "macos"] }
```

Supported types: `node`, `python`, `java`, `go`, `rust`, `dotnet`, `react`, `terraform`, `macos`, `windows`, `linux`, `jetbrains`, `vscode`, `docker`

```json
{ "status": "success", "data": { "gitignore": "# Node.js\nnode_modules/\n...", "types_included": ["node", "python"] } }
```

---

### curl Command Builder

```
POST /curl/build
Body: {
  "method": "POST",
  "url": "https://api.example.com/users",
  "headers": { "Accept": "application/json" },
  "body": "{\"name\": \"test\"}",
  "auth_type": "bearer",
  "auth_value": "my-token",
  "follow_redirects": true,
  "verbose": false
}
```

```json
{
  "status": "success",
  "data": {
    "command": "curl \\\n  -L \\\n  -X POST \\\n  -H \"Authorization: Bearer my-token\" \\\n  ...",
    "method": "POST",
    "url": "https://api.example.com/users"
  }
}
```

---

### UUID Generator

```
POST /uuid/generate
Body: { "version": 4, "count": 5 }

POST /uuid/validate
Body: { "value": "550e8400-e29b-41d4-a716-446655440000" }
```

```json
// Generate
{ "status": "success", "data": { "uuids": ["..."], "version": 4, "count": 5 } }

// Validate
{ "status": "success", "data": { "is_valid": true, "version": 4, "value": "550e8400-..." } }
```

---

### CI/CD Pipeline Generator

```
POST /cicd/generate
Body: {
  "platform": "github_actions",
  "language": "nodejs",
  "steps": ["lint", "test", "build", "docker"],
  "docker_image": "myorg/my-app",
  "deploy_target": "kubernetes"
}
```

Supported platforms: `github_actions`, `gitlab_ci`, `jenkins`
Supported languages: `nodejs`, `python`, `java`, `go`, `rust`, `dotnet`
Supported steps: `lint`, `test`, `build`, `docker`, `deploy`

```json
{
  "status": "success",
  "data": {
    "pipeline": "name: CI/CD Pipeline\n\non:\n  push:\n...",
    "platform": "github_actions",
    "language": "nodejs",
    "filename": ".github/workflows/pipeline.yml"
  }
}
```

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.10+ | Runtime |
| FastAPI | 0.111.0 | Web framework |
| Uvicorn | 0.29.0 | ASGI server |
| Pydantic | 2.7.1 | Request/response validation |
| PyYAML | 6.0.1 | YAML parsing |
| pytest | 8.2.0 | Testing |
| Hypothesis | 6.100.1 | Property-based testing |
| httpx | 0.27.0 | HTTP client for tests |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| Vite | 5.3.3 | Build tool + dev server |
| Tailwind CSS | 3.4.6 | Styling |
| Axios | 1.7.2 | HTTP client |
| React Router | 6.24.0 | Client-side routing |
| Vitest | 1.6.0 | Test runner |
| React Testing Library | 16.0.0 | Component testing |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-service orchestration |
| nginx | Static file serving + API proxy |

---

## Testing

### Run all backend tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

**110 tests** covering:
- All 18 Dockerfile types (valid + invalid + multi-stage + non-root user)
- All 8 Terraform resource types (valid + invalid + provider block)
- K8s YAML validation (valid, invalid, all 3 suggestion types)
- Base64 encode/decode (valid, invalid, round-trip)
- Cron field validation (all 5 fields, ranges, wildcards)
- JWT, Hash, Converter, Regex, Timestamp, Subnet, Gitignore, curl, UUID, CI/CD

### Run all frontend tests

```bash
cd frontend
npm install
npm test
```

**10 tests** covering:
- `OutputPanel` — loading, error, content, copy button, placeholder states
- `CopyButton` — render, clipboard write, "Copied!" confirmation
- `Sidebar` — all navigation links, app title

### Test a specific backend file

```bash
python -m pytest tests/test_docker.py -v
python -m pytest tests/test_terraform.py -v
```

---

## How Each Tool Works

### Dockerfile Generator
The backend stores pre-written Dockerfile templates as Python string constants in `routes/docker.py`. When a request arrives, it normalizes the `app_type` to lowercase, looks it up in the `DOCKERFILES` dict, and returns the string. No generation happens at runtime — templates are hand-crafted with production best practices (non-root users, multi-stage builds, layer caching).

### Kubernetes YAML Validator
Uses `yaml.safe_load()` to parse the input. If parsing fails, returns the PyYAML error message. If it succeeds, runs a series of checks on the parsed dict: looks for `metadata.labels`, checks `kind == "Deployment"` for `spec.replicas` and container resource limits. Returns a list of suggestion strings.

### Terraform Snippet Generator
Same template approach as Dockerfile Generator. Each resource type maps to a hand-written HCL string with placeholder values and best-practice defaults (encryption, versioning, tags).

### Base64 Encoder/Decoder
Uses Python's built-in `base64` module. Encode: `base64.b64encode(text.encode()).decode()`. Decode: `base64.b64decode(text, validate=True).decode("utf-8")` — the `validate=True` flag rejects non-Base64 characters and returns a 422 error.

### Cron Expression Builder
Validates each field against its allowed range (`minute` 0–59, `hour` 0–23, etc.) or accepts `"*"`. Assembles the expression by joining the five fields with spaces. Builds a human-readable description by mapping each field to a phrase ("every minute", "at hour 9", etc.).

### JWT Decoder
Splits the token on `.` to get three parts. Base64-decodes the header and payload (adding `==` padding as needed). Parses both as JSON. Checks the `exp` claim against the current time to determine expiry. The signature is returned as-is — verification requires the secret, which is intentionally not supported.

### Hash Generator
Uses Python's `hashlib.new(algorithm, text.encode("utf-8")).hexdigest()`. Supports all algorithms available in the standard library.

### JSON ↔ YAML Converter
JSON→YAML: `json.loads()` then `yaml.dump()`. YAML→JSON: `yaml.safe_load()` then `json.dumps(indent=2)`. Errors from either parser are caught and returned as 422 responses.

### Regex Tester
Compiles the pattern with `re.compile(pattern, flags)`. Uses `finditer()` to collect all matches with their positions, groups, and named groups. Returns `is_match` (bool), `match_count` (int), and the full `matches` list.

### Unix Timestamp Converter
`to_date`: `datetime.fromtimestamp(int(value), tz=timezone.utc)` then formats for each timezone using `timedelta` offsets. `to_timestamp`: tries a list of common date format strings with `strptime`, then converts to UTC and calls `.timestamp()`.

### IP Subnet Calculator
Uses Python's built-in `ipaddress.IPv4Network(cidr, strict=False)`. Extracts all properties from the network object. Calculates the wildcard mask by XOR-ing the subnet mask integer with `0xFFFFFFFF`.

### .gitignore Generator
Stores 14 template strings in a dict. For each requested type, splits the template into lines and deduplicates non-comment lines across all selected types. Joins the sections and returns the merged result.

### curl Command Builder
Builds a list of command parts in order: flags (`-v`, `-k`, `-L`), method (`-X`), auth header, custom headers, body, URL. Joins them with ` \\\n  ` for readable multi-line output. Auto-detects JSON body and adds `Content-Type: application/json` if not already set.

### UUID Generator & Validator
Generate: uses Python's `uuid.uuid1()`, `uuid.uuid4()`, or `uuid.uuid5(NAMESPACE_DNS, name)`. Validate: matches against the standard UUID regex pattern and extracts the version digit from position 14.

### CI/CD Pipeline Generator
Three generator functions (`_github_actions`, `_gitlab_ci`, `_jenkins`), each building a pipeline string by conditionally appending stage blocks based on the selected steps. Language-specific setup steps (e.g. `actions/setup-node@v4`) are stored in dicts keyed by language.

---

## Adding a New Tool

1. **Create the backend route** in `backend/routes/mytool.py`:

```python
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/mytool", tags=["mytool"])

class MyToolRequest(BaseModel):
    input_field: str

@router.post("/action")
async def my_action(request: MyToolRequest):
    # your logic here
    return {
        "status": "success",
        "data": { "result": "..." }
    }
```

2. **Register the router** in `backend/main.py`:

```python
from routes import mytool
app.include_router(mytool.router)
```

3. **Create the frontend page** in `frontend/src/pages/MyToolPage.jsx`:

```jsx
import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

export default function MyToolPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/mytool/action', { input_field: input })
      if (data.status === 'success') setResult(data.data.result)
      else setError(data.data?.message ?? 'Error')
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔧" title="My Tool" description="What this tool does." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Input</label>
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Processing...' : 'Run'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
```

4. **Add the route and sidebar entry** in `App.jsx` and `Sidebar.jsx`.

5. **Write tests** in `backend/tests/test_mytool.py`.

---

## Environment Variables

The application works out of the box with no environment variables required. For production deployments you may want to set:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `8000` | Port the FastAPI server listens on |
| `FRONTEND_PORT` | `3000` | Port nginx listens on |

To use custom ports, update `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "9000:8000"   # host:container
  frontend:
    ports:
      - "4000:3000"
```

---

## License

MIT — free to use, modify, and distribute.
