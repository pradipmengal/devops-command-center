"""
Docker Intelligence Center — FastAPI router.

All SSE streaming helpers are imported from routes/ai.py — nothing is duplicated.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from routes.ai import (
    make_stream_response,
    stream_openai,
    stream_gemini,
    stream_opencode,
    is_gemini,
    is_opencode,
    get_max_tokens,
)

router = APIRouter(prefix="/docker-intelligence", tags=["docker-intelligence"])

# ── Pydantic models ───────────────────────────────────────────────────────────

class DockerIntelligenceBase(BaseModel):
    api_key: str
    model: str
    base_url: Optional[str] = "https://api.openai.com/v1"
    provider: Optional[str] = None


class DockerAnalyzeRequest(DockerIntelligenceBase):
    dockerfile: str


class DockerOptimizeRequest(DockerIntelligenceBase):
    dockerfile: str
    mode: Optional[str] = "general"  # general | multistage | reduce-size


class DockerExplainRequest(DockerIntelligenceBase):
    question: str
    dockerfile: Optional[str] = ""
    history: Optional[list] = []


class DockerComposeRequest(DockerIntelligenceBase):
    services: list[str]


class DockerTroubleshootRequest(DockerIntelligenceBase):
    dockerfile: str
    error_context: Optional[str] = ""


class DockerLayersRequest(DockerIntelligenceBase):
    dockerfile: str


class DockerSecurityScanRequest(DockerIntelligenceBase):
    dockerfile: str


# ── System prompts ────────────────────────────────────────────────────────────

ANALYZE_SYSTEM_PROMPT = """You are a senior Docker expert and DevOps architect.
Analyze the provided Dockerfile and return a structured JSON-like assessment with these exact fields:
- securityScore (0-100): overall security posture
- optimizationScore (0-100): build optimization quality
- layerEfficiency (0-100): layer caching and ordering efficiency
- buildPerformance (0-100): estimated build speed score
- imageSizeEstimate: estimated final image size (e.g. "~180MB")
- vulnerabilityCount: estimated number of vulnerabilities (integer)
- riskLevel: one of "Critical", "High", "Medium", "Low"
- cacheEfficiency (0-100): how well cache layers are utilized

After the JSON block, provide a brief summary of the top 3 issues found.
Be concise and accurate. Base scores on actual Dockerfile content."""

OPTIMIZE_SYSTEM_PROMPT = """You are a Docker optimization expert.
Analyze the Dockerfile and provide an optimized version.

Respond with:
## Optimized Dockerfile
```dockerfile
(complete optimized Dockerfile)
```

## Key Optimizations
(bullet list of changes made and why)

## Expected Improvements
(size reduction, build time, security improvements)

Focus on: layer ordering, multi-stage builds, cache efficiency, minimal base images, security hardening."""

MULTISTAGE_SYSTEM_PROMPT = """You are a Docker multi-stage build expert.
Convert the provided Dockerfile to use multi-stage builds for maximum size reduction.

Respond with:
## Multi-Stage Dockerfile
```dockerfile
(complete multi-stage Dockerfile)
```

## Stage Breakdown
(explain each stage and its purpose)

## Size Reduction Estimate
(estimated final image size vs original)"""

REDUCE_SIZE_SYSTEM_PROMPT = """You are a Docker image size optimization expert.
Minimize the final image size of this Dockerfile as aggressively as possible.

Respond with:
## Size-Optimized Dockerfile
```dockerfile
(complete optimized Dockerfile)
```

## Size Reduction Techniques Applied
(bullet list of techniques used)

## Estimated Size Reduction
(before/after size estimates)"""

SECURITY_SCAN_SYSTEM_PROMPT = """You are a Docker security expert and container security auditor.
Perform a comprehensive security scan of this Dockerfile.

Respond with a structured security report:

## Security Summary
(overall risk level and critical findings count)

## Vulnerabilities Found
For each issue, provide:
- CVE ID (if applicable, otherwise use DOCKER-SEC-XXX format)
- Severity: Critical/High/Medium/Low
- Package/Component affected
- Description
- Recommended fix

## Security Score
(0-100 score with justification)

## Remediation Priority
(ordered list of fixes by priority)

Check for: root user, latest tags, exposed secrets, insecure permissions, missing HEALTHCHECK, ADD vs COPY misuse, apt cache not cleaned, unnecessary packages."""

EXPLAIN_SYSTEM_PROMPT = """You are a Docker expert and DevOps educator.
Answer questions about Dockerfiles, docker-compose, container runtime, image optimization, and Docker best practices.

When given a Dockerfile as context, reference specific lines and instructions in your answers.
Provide clear, actionable explanations with code examples where helpful.
Use markdown formatting with code blocks for Dockerfile snippets and commands."""

TROUBLESHOOT_SYSTEM_PROMPT = """You are a Docker troubleshooting expert.
Diagnose and fix Docker build failures, runtime errors, and configuration issues.

Respond with:
## Problem Diagnosis
(what is causing the issue)

## Root Cause
(technical explanation)

## Fix
```dockerfile
(corrected Dockerfile section or full Dockerfile)
```

## Prevention
(how to avoid this issue in future)

Be specific about line numbers and instruction names when referencing the Dockerfile."""

COMPOSE_SYSTEM_PROMPT = """You are a Docker Compose expert.
Generate a production-ready docker-compose.yml for the requested services.

Requirements:
- Use specific version tags (not 'latest')
- Include named volumes for persistent data
- Define a custom network for service isolation
- Add environment variables with sensible defaults
- Include health checks where appropriate
- Add restart policies
- Include resource limits comments
- Add .env file references for secrets

Respond with ONLY the docker-compose.yml content in a code block, then a brief explanation of key decisions."""

LAYERS_SYSTEM_PROMPT = """You are a Docker layer analysis expert.
Analyze the Dockerfile and provide a detailed layer-by-layer breakdown.

For each instruction, provide:
- Instruction type and content
- Estimated size contribution
- Cache behavior (cache-busting or cache-friendly)
- Optimization suggestions

Respond with:
## Layer Analysis
(table or structured list of each layer)

## Cache Optimization Opportunities
(specific reordering suggestions)

## Total Size Estimate
(breakdown by layer category)"""


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_ai_stream(request: DockerIntelligenceBase, messages: list):
    """Route to the correct streaming backend based on model/provider."""
    if is_opencode(request.provider):
        return make_stream_response(stream_opencode, request.base_url, messages)
    if is_gemini(request.model, request.base_url):
        return make_stream_response(stream_gemini, request.api_key, request.model, messages)
    return make_stream_response(stream_openai, request.api_key, request.model, request.base_url, messages)


def _validate_dockerfile(dockerfile: str, field_name: str = "dockerfile"):
    """Return a 422 JSONResponse if dockerfile is empty/whitespace, else None."""
    if not dockerfile or not dockerfile.strip():
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": f"{field_name} cannot be empty"}},
        )
    return None


# ── Streaming endpoints ───────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_dockerfile(request: DockerAnalyzeRequest):
    """Analyze a Dockerfile and return quality metrics + findings."""
    err = _validate_dockerfile(request.dockerfile)
    if err:
        return err

    messages = [
        {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze this Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"},
    ]
    return _make_ai_stream(request, messages)


@router.post("/optimize")
async def optimize_dockerfile(request: DockerOptimizeRequest):
    """Optimize a Dockerfile. mode: general | multistage | reduce-size"""
    err = _validate_dockerfile(request.dockerfile)
    if err:
        return err

    mode = (request.mode or "general").lower()
    if mode == "multistage":
        system_prompt = MULTISTAGE_SYSTEM_PROMPT
        user_msg = f"Convert this Dockerfile to use multi-stage builds:\n```dockerfile\n{request.dockerfile}\n```"
    elif mode == "reduce-size":
        system_prompt = REDUCE_SIZE_SYSTEM_PROMPT
        user_msg = f"Minimize the image size of this Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"
    else:
        system_prompt = OPTIMIZE_SYSTEM_PROMPT
        user_msg = f"Optimize this Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg},
    ]
    return _make_ai_stream(request, messages)


@router.post("/security-scan")
async def security_scan(request: DockerSecurityScanRequest):
    """Perform a security scan on a Dockerfile."""
    err = _validate_dockerfile(request.dockerfile)
    if err:
        return err

    messages = [
        {"role": "system", "content": SECURITY_SCAN_SYSTEM_PROMPT},
        {"role": "user", "content": f"Security scan this Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"},
    ]
    return _make_ai_stream(request, messages)


@router.post("/explain")
async def explain_docker(request: DockerExplainRequest):
    """Answer Docker questions with optional Dockerfile context and chat history."""
    if not request.question.strip():
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "question cannot be empty"}},
        )

    messages = [{"role": "system", "content": EXPLAIN_SYSTEM_PROMPT}]

    # Include last 8 messages of history
    for msg in (request.history or [])[-8:]:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            messages.append({"role": msg["role"], "content": msg["content"]})

    # Build user message with optional Dockerfile context
    user_content = request.question
    if request.dockerfile and request.dockerfile.strip():
        user_content = (
            f"Context — current Dockerfile:\n```dockerfile\n{request.dockerfile}\n```\n\n"
            f"Question: {request.question}"
        )

    messages.append({"role": "user", "content": user_content})
    return _make_ai_stream(request, messages)


@router.post("/troubleshoot")
async def troubleshoot_dockerfile(request: DockerTroubleshootRequest):
    """Troubleshoot Docker build/runtime errors."""
    err = _validate_dockerfile(request.dockerfile)
    if err:
        return err

    user_content = f"Troubleshoot this Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"
    if request.error_context and request.error_context.strip():
        user_content += f"\n\nError context:\n```\n{request.error_context}\n```"

    messages = [
        {"role": "system", "content": TROUBLESHOOT_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    return _make_ai_stream(request, messages)


@router.post("/compose")
async def generate_compose(request: DockerComposeRequest):
    """Generate a docker-compose.yml for the selected services."""
    if not request.services:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "At least one service must be selected"}},
        )

    services_list = ", ".join(request.services)
    messages = [
        {"role": "system", "content": COMPOSE_SYSTEM_PROMPT},
        {"role": "user", "content": f"Generate a production-ready docker-compose.yml for these services: {services_list}"},
    ]
    return _make_ai_stream(request, messages)


@router.post("/layers")
async def analyze_layers(request: DockerLayersRequest):
    """Analyze Docker image layers for size and cache behavior."""
    err = _validate_dockerfile(request.dockerfile)
    if err:
        return err

    messages = [
        {"role": "system", "content": LAYERS_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze the layers of this Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"},
    ]
    return _make_ai_stream(request, messages)


# ── Mock container runtime data ───────────────────────────────────────────────

@router.get("/containers")
async def get_containers():
    """Return mock container runtime data for the Runtime Monitor."""
    containers = [
        {
            "id": "a1b2c3d4e5f6",
            "name": "web-server",
            "image": "nginx:1.25-alpine",
            "cpuPercent": 2.4,
            "memoryUsage": "128MB / 512MB",
            "restartCount": 0,
            "healthStatus": "healthy",
            "ports": ["80:80", "443:443"],
            "networks": ["app-network"],
            "volumes": ["/data/www:/var/www/html"],
            "logs": [
                "2024-01-15 10:23:01 172.18.0.1 - GET / HTTP/1.1 200",
                "2024-01-15 10:23:05 172.18.0.1 - GET /api/health HTTP/1.1 200",
                "2024-01-15 10:23:12 172.18.0.1 - GET /static/app.js HTTP/1.1 304",
                "2024-01-15 10:23:18 172.18.0.1 - POST /api/data HTTP/1.1 201",
                "2024-01-15 10:23:25 172.18.0.1 - GET / HTTP/1.1 200",
            ],
        },
        {
            "id": "b2c3d4e5f6a1",
            "name": "api-service",
            "image": "python:3.11-slim",
            "cpuPercent": 15.7,
            "memoryUsage": "256MB / 1GB",
            "restartCount": 1,
            "healthStatus": "healthy",
            "ports": ["8000:8000"],
            "networks": ["app-network", "db-network"],
            "volumes": ["/app/data:/data"],
            "logs": [
                "2024-01-15 10:22:00 INFO     Uvicorn running on http://0.0.0.0:8000",
                "2024-01-15 10:22:01 INFO     Application startup complete.",
                "2024-01-15 10:23:01 INFO     GET /api/health 200 OK",
                "2024-01-15 10:23:10 INFO     POST /api/data 201 Created",
                "2024-01-15 10:23:15 WARNING  High memory usage detected: 256MB",
            ],
        },
        {
            "id": "c3d4e5f6a1b2",
            "name": "redis-cache",
            "image": "redis:7.2-alpine",
            "cpuPercent": 0.8,
            "memoryUsage": "64MB / 256MB",
            "restartCount": 5,  # > 3 — triggers amber warning
            "healthStatus": "healthy",
            "ports": ["6379:6379"],
            "networks": ["db-network"],
            "volumes": ["/data/redis:/data"],
            "logs": [
                "2024-01-15 10:20:00 * Ready to accept connections",
                "2024-01-15 10:20:05 # Connection timeout, restarting...",
                "2024-01-15 10:20:10 * Ready to accept connections",
                "2024-01-15 10:21:00 # OOM command not allowed when used memory > maxmemory",
                "2024-01-15 10:21:05 * Ready to accept connections",
            ],
        },
        {
            "id": "d4e5f6a1b2c3",
            "name": "postgres-db",
            "image": "postgres:16-alpine",
            "cpuPercent": 5.2,
            "memoryUsage": "512MB / 2GB",
            "restartCount": 0,
            "healthStatus": "unhealthy",  # triggers red critical indicator
            "ports": ["5432:5432"],
            "networks": ["db-network"],
            "volumes": ["/data/postgres:/var/lib/postgresql/data"],
            "logs": [
                "2024-01-15 10:15:00 LOG:  database system is ready to accept connections",
                "2024-01-15 10:18:00 FATAL: data directory has wrong ownership",
                "2024-01-15 10:18:01 ERROR: could not open file \"pg_hba.conf\": Permission denied",
                "2024-01-15 10:18:05 LOG:  database system is shut down",
                "2024-01-15 10:18:10 FATAL: pre-existing shared memory block is still in use",
            ],
        },
        {
            "id": "e5f6a1b2c3d4",
            "name": "worker-queue",
            "image": "python:3.11-slim",
            "cpuPercent": 45.3,
            "memoryUsage": "384MB / 1GB",
            "restartCount": 8,  # > 3 — triggers amber warning
            "healthStatus": "starting",
            "ports": [],
            "networks": ["app-network", "db-network"],
            "volumes": ["/app/tasks:/tasks"],
            "logs": [
                "2024-01-15 10:10:00 INFO     Worker starting...",
                "2024-01-15 10:10:05 ERROR    Failed to connect to Redis: Connection refused",
                "2024-01-15 10:10:10 INFO     Retrying connection (attempt 3/5)...",
                "2024-01-15 10:10:15 ERROR    Max retries exceeded. Worker shutting down.",
                "2024-01-15 10:10:20 INFO     Worker restarting...",
            ],
        },
    ]
    return {"status": "success", "data": containers}
