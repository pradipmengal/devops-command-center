"""
Docker Intelligence Center — FastAPI router.

All SSE streaming helpers are imported from routes/ai.py — nothing is duplicated.
"""

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse, HTMLResponse
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
    get_openai_client,
    get_extra_options,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/docker-intelligence", tags=["docker-intelligence"])

# ── Docker client helper ──────────────────────────────────────────────────────

def _get_docker_client():
    """Return a connected Docker client or None."""
    if not _DOCKER_AVAILABLE:
        return None
    try:
        client = _docker.from_env()
        client.ping()
        return client
    except Exception:
        return None

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
When given live container runtime data (CPU, memory, health, logs), use it to answer questions about running containers — reference specific containers by name and their metrics.

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

    # Inject live container runtime context into system prompt
    system_prompt = EXPLAIN_SYSTEM_PROMPT
    container_context = _get_container_runtime_context()
    if container_context:
        system_prompt += (
            "\n\n## Live Container Runtime Data\n"
            "Below is the current state of all containers on the host. "
            "Use this data to answer questions about running containers — "
            "their resource usage, health status, ports, networks, and recent log output.\n\n"
            + container_context
        )

    messages = [{"role": "system", "content": system_prompt}]

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


# ── Real Docker daemon integration ─────────────────────────────────────────────

try:
    import docker as _docker
    _DOCKER_AVAILABLE = True
except ImportError:
    _DOCKER_AVAILABLE = False


def _parse_container_port(port_str: str) -> str:
    """Convert '80/tcp' or '80/udp' to just '80'."""
    return port_str.split("/")[0]


def _cpu_percent_from_stats(stats: dict) -> float:
    """Calculate CPU percentage from a single docker stats snapshot."""
    if not stats:
        return 0.0
    cpu_stats = stats.get("cpu_stats", {})
    precpu_stats = stats.get("precpu_stats", {})
    cpu_usage = cpu_stats.get("cpu_usage", {})
    precpu_usage = precpu_stats.get("cpu_usage", {})

    cpu_delta = cpu_usage.get("total_usage", 0) - precpu_usage.get("total_usage", 0)
    system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)

    if system_delta <= 0 or cpu_delta < 0:
        return 0.0

    num_cpus = cpu_stats.get("online_cpus", 1)
    return round((cpu_delta / system_delta) * num_cpus * 100.0, 1)


def _memory_from_stats(stats: dict) -> tuple[int, int]:
    """Return (used_mb, limit_mb) from docker stats."""
    if not stats:
        return (0, 0)
    mem = stats.get("memory_stats", {})
    used = mem.get("usage", 0)
    limit = mem.get("limit", 0)
    return (int(used / (1024 * 1024)), int(limit / (1024 * 1024)))


def _get_container_runtime_context() -> Optional[str]:
    """Return a formatted summary of running containers for AI context, or None."""
    client = _get_docker_client()
    if client is None:
        return None

    try:
        containers = client.containers.list(all=True)
    except Exception:
        return None

    if not containers:
        return None

    lines = ["Container Runtime Summary (live data from Docker daemon):"]
    for c in containers:
        try:
            inspect_data = c.attrs
        except Exception:
            continue

        state = inspect_data.get("State", {}) or {}

        try:
            stats = c.stats(stream=False)
        except Exception:
            stats = None

        cpu_percent = _cpu_percent_from_stats(stats)
        mem_used_mb, mem_limit_mb = _memory_from_stats(stats)
        memory_usage = f"{mem_used_mb}MB / {mem_limit_mb}MB" if mem_limit_mb else "—"

        health = state.get("Health", {}).get("Status")
        health_status = DOCKER_HEALTH_MAP.get(health, "none")
        if health_status == "none":
            status = state.get("Status", "")
            if status == "running":
                health_status = "healthy"
            elif status in ("exited", "dead"):
                health_status = "unhealthy"
            elif status in ("paused", "restarting"):
                health_status = "starting"

        restart_count = state.get("RestartCount", 0)
        status_text = state.get("Status", "unknown")
        image_tag = c.image.tags[0] if c.image and c.image.tags else (c.image.short_id if c.image else "—")

        # Ports
        port_mappings = []
        net_settings = inspect_data.get("NetworkSettings", {}) or {}
        ports = net_settings.get("Ports", {}) or {}
        for container_port, host_bindings in ports.items():
            if host_bindings:
                for binding in host_bindings:
                    host_port = binding.get("HostPort", "")
                    port_mappings.append(f"{host_port}:{_parse_container_port(container_port)}")
        port_str = ", ".join(port_mappings) if port_mappings else "none"

        # Networks
        networks = list((net_settings.get("Networks", {}) or {}).keys())
        net_str = ", ".join(networks) if networks else "none"

        # Last log line
        last_log = ""
        try:
            raw = c.logs(tail=1, timestamps=True).decode("utf-8", errors="replace").strip()
            if raw:
                last_log = raw.split("\n")[-1][:200]
        except Exception:
            pass

        line = (
            f'- name="{c.name}" image="{image_tag}" status="{status_text}" '
            f'cpu={cpu_percent}% mem="{memory_usage}" '
            f'health="{health_status}" restart_count={restart_count}'
        )
        if port_str != "none":
            line += f" ports=[{port_str}]"
        if net_str != "none":
            line += f" networks=[{net_str}]"
        if last_log:
            line += f'\n  last_log: "{last_log}"'
        lines.append(line)

    return "\n".join(lines)


DOCKER_HEALTH_MAP = {
    "healthy": "healthy",
    "unhealthy": "unhealthy",
    "starting": "starting",
    None: "none",
}


@router.get("/containers")
async def get_containers():
    """Return real container runtime data from the host Docker daemon.

    Falls back to mock data if Docker is not available or the daemon is unreachable.
    """
    client = _get_docker_client()
    if client is None:
        logger.warning("docker-intelligence: Docker unavailable, using mock data")
        return _get_mock_containers()

    try:
        containers = client.containers.list(all=True)
    except Exception as exc:
        return {"status": "error", "source": "docker", "data": [], "debug": f"list failed: {exc}"}

    result = []
    for c in containers:
        try:
            inspect_data = c.attrs
        except Exception as exc:
            continue

        state = inspect_data.get("State", {}) or {}

        # Stats snapshot (non-streaming)
        try:
            stats = c.stats(stream=False)
        except Exception:
            stats = None

        cpu_percent = _cpu_percent_from_stats(stats)
        mem_used_mb, mem_limit_mb = _memory_from_stats(stats)
        memory_usage = f"{mem_used_mb}MB / {mem_limit_mb}MB" if mem_limit_mb else "—"

        health = state.get("Health", {}).get("Status")
        health_status = DOCKER_HEALTH_MAP.get(health, "none")
        if health_status == "none":
            status = state.get("Status", "")
            if status == "running":
                health_status = "healthy"
            elif status in ("exited", "dead"):
                health_status = "unhealthy"
            elif status in ("paused", "restarting"):
                health_status = "starting"

        restart_count = state.get("RestartCount", 0)

        # Ports
        port_mappings = []
        net_settings = inspect_data.get("NetworkSettings", {}) or {}
        ports = net_settings.get("Ports", {}) or {}
        for container_port, host_bindings in ports.items():
            if host_bindings:
                for binding in host_bindings:
                    host_port = binding.get("HostPort", "")
                    port_mappings.append(f"{host_port}:{_parse_container_port(container_port)}")

        # Networks
        networks = list((net_settings.get("Networks", {}) or {}).keys())

        # Volumes
        volumes = []
        for mount in inspect_data.get("Mounts", []) or []:
            src = mount.get("Source", "")
            dst = mount.get("Destination", "")
            if src and dst:
                volumes.append(f"{src}:{dst}")

        # Logs (last 5 lines)
        try:
            raw = c.logs(tail=5, timestamps=True).decode("utf-8", errors="replace").strip()
            log_lines = raw.split("\n") if raw else []
        except Exception:
            log_lines = []

        image_tag = c.image.tags[0] if c.image and c.image.tags else (c.image.short_id if c.image else "—")

        result.append({
            "id": c.id[:12],
            "fullId": c.id,
            "name": c.name,
            "status": state.get("Status", "unknown"),
            "image": image_tag,
            "cpuPercent": cpu_percent,
            "memoryUsage": memory_usage,
            "restartCount": restart_count,
            "healthStatus": health_status,
            "ports": port_mappings,
            "networks": networks,
            "volumes": volumes,
            "logs": log_lines,
        })

    return {"status": "success", "source": "docker", "data": result, "debug": {"listed": len(containers), "returned": len(result)}}


# ── Container actions ──────────────────────────────────────────────────────────

@router.post("/containers/{container_id}/start")
async def start_container(container_id: str):
    client = _get_docker_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})
    try:
        container = client.containers.get(container_id)
        container.start()
        return {"status": "success", "message": f"Container {container_id} started"}
    except _docker.errors.NotFound:
        return JSONResponse(status_code=404, content={"status": "error", "message": f"Container {container_id} not found"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


@router.post("/containers/{container_id}/stop")
async def stop_container(container_id: str):
    client = _get_docker_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})
    try:
        container = client.containers.get(container_id)
        container.stop()
        return {"status": "success", "message": f"Container {container_id} stopped"}
    except _docker.errors.NotFound:
        return JSONResponse(status_code=404, content={"status": "error", "message": f"Container {container_id} not found"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


@router.post("/containers/{container_id}/restart")
async def restart_container(container_id: str):
    client = _get_docker_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})
    try:
        container = client.containers.get(container_id)
        container.restart()
        return {"status": "success", "message": f"Container {container_id} restarted"}
    except _docker.errors.NotFound:
        return JSONResponse(status_code=404, content={"status": "error", "message": f"Container {container_id} not found"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


# ── Terminal ───────────────────────────────────────────────────────────────────

def _format_docker_ps(containers):
    lines = ["CONTAINER ID   IMAGE                           COMMAND                  CREATED        STATUS                  PORTS"]
    for c in containers:
        cid = c.id[:12]
        img = (c.image.tags[0] if c.image.tags else c.image.short_id)[:32] if c.image else "—"
        cmd = (c.attrs.get("Config", {}).get("Cmd") or ["—"])[0][:20] if c.attrs.get("Config", {}).get("Cmd") else "—"
        created = c.attrs.get("Created", "")[8:19] if c.attrs.get("Created") else "—"
        status = c.status[:20] if c.status else "—"
        ports = []
        net_settings = c.attrs.get("NetworkSettings", {}) or {}
        for cp, bindings in (net_settings.get("Ports", {}) or {}).items():
            if bindings:
                for b in bindings:
                    ports.append(f"{b.get('HostPort', '')}->{cp.split('/')[0]}")
            else:
                ports.append(cp.split("/")[0])
        port_str = (", ".join(ports))[:20] if ports else "—"
        lines.append(f"{cid:<12}  {img:<32}  {cmd:<20}  {created:<12}  {status:<20}  {port_str}")
    return "\n".join(lines) if len(lines) > 1 else "(no containers)"


def _format_docker_images(client):
    lines = ["REPOSITORY               TAG                 IMAGE ID            CREATED             SIZE"]
    for img in client.images.list():
        for tag in img.tags or ["<none>:<none>"]:
            repo, tag_name = tag.split(":") if ":" in tag else (tag, "<none>")
            created = img.attrs.get("Created", "")[:19] if img.attrs.get("Created") else "—"
            size = img.attrs.get("Size", 0)
            size_str = f"{size / 1024 / 1024:.1f}MB" if size > 0 else "—"
            lines.append(f"{repo:<22}  {tag_name:<18}  {img.short_id:<18}  {created:<18}  {size_str}")
    return "\n".join(lines) if len(lines) > 1 else "(no images)"


def _format_docker_stats(containers):
    lines = ["CONTAINER ID   NAME              CPU %     MEM USAGE / LIMIT     MEM %     NET I/O"]
    for c in containers:
        try:
            stats = c.stats(stream=False)
            cpu = stats.get("cpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0)
            precpu = stats.get("precpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0)
            sys_cpu = stats.get("cpu_stats", {}).get("system_cpu_usage", 0)
            presys_cpu = stats.get("precpu_stats", {}).get("system_cpu_usage", 0)
            cpu_delta = cpu - precpu
            sys_delta = sys_cpu - presys_cpu
            cpu_pct = round((cpu_delta / sys_delta) * 100, 2) if sys_delta > 0 else 0
            mem = stats.get("memory_stats", {})
            used = mem.get("usage", 0)
            limit = mem.get("limit", 1)
            mem_pct = round(used / limit * 100, 1)
            used_str = f"{used / 1024 / 1024:.0f}MiB" if used else "—"
            limit_str = f"{limit / 1024 / 1024:.0f}MiB" if limit else "—"
            net = stats.get("networks", {})
            rx = sum(n.get("rx_bytes", 0) for n in net.values())
            tx = sum(n.get("tx_bytes", 0) for n in net.values())
            net_str = f"{rx / 1024:.0f}B / {tx / 1024:.0f}B" if rx or tx else "—"
            lines.append(f"{c.id[:12]:<14}  {c.name:<15}  {cpu_pct:<7.2f}  {used_str:<10} / {limit_str:<10}  {mem_pct:<7.1f}  {net_str}")
        except Exception:
            lines.append(f"{c.id[:12]:<14}  {c.name:<15}  {'—':>7}  {'—':<10} / {'—':<10}  {'—':>7}  {'—'}")
    return "\n".join(lines) if len(lines) > 1 else "(no running containers)"


@router.post("/terminal")
async def run_terminal_command(payload: dict):
    cmd = payload.get("command", "").strip().lower()
    if not cmd:
        return {"status": "error", "output": "No command provided"}

    client = _get_docker_client()
    if client is None:
        return {"status": "error", "output": "Docker daemon not available"}

    try:
        if cmd == "docker ps":
            containers = client.containers.list(all=True)
            return {"status": "success", "output": _format_docker_ps(containers)}

        if cmd == "docker images":
            return {"status": "success", "output": _format_docker_images(client)}

        if cmd == "docker stats" or cmd == "docker stats --no-stream":
            containers = client.containers.list(all=False)
            return {"status": "success", "output": _format_docker_stats(containers)}

        if cmd == "docker version":
            info = client.version()
            lines = [
                f"Client: Docker Engine - Community",
                f" Version:           {info.get('Version', '—')}",
                f" API version:       {info.get('ApiVersion', '—')}",
                f" Go version:        {info.get('GoVersion', '—')}",
                f" OS/Arch:           {info.get('Os', '—')}/{info.get('Arch', '—')}",
            ]
            return {"status": "success", "output": "\n".join(lines)}

        if cmd == "docker info":
            info = client.info()
            lines = [
                f"Containers:         {info.get('Containers', 0)}",
                f" Running:           {info.get('ContainersRunning', 0)}",
                f" Paused:            {info.get('ContainersPaused', 0)}",
                f" Stopped:           {info.get('ContainersStopped', 0)}",
                f" Images:            {info.get('Images', 0)}",
                f" Server Version:    {info.get('ServerVersion', '—')}",
                f" Storage Driver:    {info.get('Driver', '—')}",
                f" Logging Driver:    {info.get('LoggingDriver', '—')}",
                f" Kernel Version:    {info.get('KernelVersion', '—')}",
                f" Operating System:  {info.get('OperatingSystem', '—')}",
                f" OSType:            {info.get('OSType', '—')}",
                f" Architecture:      {info.get('Architecture', '—')}",
                f" CPUs:              {info.get('NCPU', 0)}",
                f" Total Memory:      {info.get('MemTotal', 0) / 1024 / 1024:.0f}MiB",
                f" Docker Root Dir:   {info.get('DockerRootDir', '—')}",
            ]
            return {"status": "success", "output": "\n".join(lines)}

        if cmd == "docker network ls":
            networks = client.networks.list()
            lines = ["NETWORK ID     NAME              DRIVER              SCOPE"]
            for n in networks:
                lines.append(f"{n.id[:12]:<14}  {n.name:<17}  {n.attrs.get('Driver', '—'):<18}  {n.attrs.get('Scope', '—')}")
            return {"status": "success", "output": "\n".join(lines)}

        if cmd == "docker volume ls":
            volumes = client.volumes.list()
            lines = ["VOLUME NAME       DRIVER              SCOPE"]
            for v in volumes:
                lines.append(f"{v.name:<17}  {v.attrs.get('Driver', '—'):<18}  {'local'}")
            return {"status": "success", "output": "\n".join(lines)}

        if cmd in ("help", "docker help"):
            lines = [
                "Available commands:",
                "",
                "  docker ps              List all containers (running & stopped)",
                "  docker images          List images",
                "  docker stats           Show running container resource usage",
                "  docker version         Show Docker version info",
                "  docker info            Show system-wide Docker info",
                "  docker network ls      List networks",
                "  docker volume ls       List volumes",
                "",
                '  explain: <command>     Get AI explanation of any Docker command',
            ]
            return {"status": "success", "output": "\n".join(lines)}

        return {"status": "error", "output": f"Unknown command: {cmd}. Type 'help' for available commands."}
    except Exception as exc:
        return {"status": "error", "output": str(exc)}


# ── AI Container Control ───────────────────────────────────────────────────────

AI_CONTAINER_SYSTEM_PROMPT = """Convert Docker requests to CLI commands. Always output a docker command.

Available containers:
{container_list}

Available images:
{image_list}

Respond with ONLY valid JSON: {{"command": "docker ...", "explanation": "..."}}

Rules:
- For ANY Docker request (start, stop, restart, status, health, count, logs, inspect, images, info, exec), generate a docker command
- NEVER leave command empty. NEVER refuse
- Use container names from the available list

Examples:
{{"command": "docker ps -q", "explanation": "Count running containers"}}
{{"command": "docker inspect apache --format '{{.State.Health.Status}}'", "explanation": "Check apache health"}}
{{"command": "docker stop apache", "explanation": "Stop apache"}}
{{"command": "docker start apache", "explanation": "Start apache"}}
{{"command": "docker restart apache", "explanation": "Restart apache"}}
{{"command": "docker ps -a", "explanation": "List all containers"}}
{{"command": "docker images", "explanation": "List images"}}
{{"command": "docker logs nginx --tail 50", "explanation": "Show nginx logs"}}
{{"command": "docker stats --no-stream", "explanation": "Show container stats"}}"""


def _call_ai_sync(api_key: str, model: str, base_url: str, provider: str, messages: list, max_tokens: int = 600) -> str:
    """Non-streaming AI call that returns the full response text."""
    import json as _json

    if is_opencode(provider):
        import httpx
        prompt = ""
        for m in messages:
            role = m.get("role", "")
            content = m.get("content", "")
            if role == "system":
                prompt = f"[System]: {content}\n\n" + prompt
            elif role == "user":
                prompt += f"[User]: {content}\n\n"
            elif role == "assistant":
                prompt += f"[Assistant]: {content}\n\n"
        with httpx.Client(timeout=60.0) as client:
            from routes.ai import _opencode_create_session, _opencode_send_message
            session_id = _opencode_create_session(client, base_url)
            return _opencode_send_message(client, base_url, session_id, prompt)

    if is_gemini(model, base_url):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        system_prompt = ""
        user_msg = ""
        for m in messages:
            if m.get("role") == "system":
                system_prompt = m.get("content", "")
            elif m.get("role") == "user":
                user_msg = m.get("content", "")
        gemini_model = genai.GenerativeModel(
            model_name=model,
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.0,
                max_output_tokens=max_tokens,
            ),
        )
        response = gemini_model.generate_content(user_msg)
        return response.text

    # OpenAI-compatible (also covers Ollama)
    client = get_openai_client(api_key, base_url)
    extra = get_extra_options(base_url, model)
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.0,
        max_tokens=max_tokens,
        extra_body=extra,
    )
    return response.choices[0].message.content


def _extract_json(text: str):
    """Extract the first top-level JSON object from text, handling nested braces."""
    import json, re
    text = re.sub(r'```(?:json)?\s*', '', text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
        if depth == 0:
            try:
                return json.loads(text[start:i+1])
            except json.JSONDecodeError:
                return None
    return None


_DEBUG_AI_CONFIG = None


@router.get("/debug-ai-config")
async def debug_ai_config():
    global _DEBUG_AI_CONFIG
    # If config was already received, return it
    if _DEBUG_AI_CONFIG:
        return _DEBUG_AI_CONFIG
    # Serve a page that reads localStorage and sends it back
    return HTMLResponse("""<!DOCTYPE html>
<html><body>
<script>
try {
    const raw = localStorage.getItem('devops_ai_settings');
    if (raw) {
        const data = JSON.parse(raw);
        fetch('/docker-intelligence/debug-ai-config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        }).then(function(r) {
            return r.text();
        }).then(function(t) {
            document.body.innerHTML = '<h2>Config received!</h2><pre>' + t + '</pre>';
        });
    } else {
        document.body.innerHTML = '<h2>No AI config found in localStorage</h2>';
    }
} catch(e) {
    document.body.innerHTML = '<h2>Error: ' + e.message + '</h2>';
}
</script></body></html>""")


@router.post("/debug-ai-config")
async def debug_ai_config_post(payload: dict):
    global _DEBUG_AI_CONFIG
    _DEBUG_AI_CONFIG = payload
    return {"status": "ok", "config": payload}


def _match_container(term: str, all_containers: list):
    """Find containers matching a term (name or ID prefix, case-insensitive)."""
    term = term.lower()
    exact = [c for c in all_containers if c.name.lower() == term or c.id.lower() == term or c.id[:12].lower() == term]
    if exact:
        return exact[0], None
    partial = [c for c in all_containers if term in c.name.lower() or term in c.id[:12].lower()]
    if len(partial) == 1:
        return partial[0], None
    if len(partial) > 1:
        names = ", ".join(f"`{c.name}`" for c in partial)
        return None, {"status": "success", "message": f"🔍 Multiple containers match \"{term}\": {names}. Please be more specific.", "data": "multiple_matches"}
    return None, None


def _words_contain(phrase: str, word: str) -> bool:
    """Check if word is in phrase as a whole word or substring of any token."""
    phrase_lower = phrase.lower()
    if word in phrase_lower.split():
        return True
    for w in phrase_lower.split():
        if len(word) >= 4 and word in w:
            return True
    return False


def _has_token_prefix(words: list, prefix: str) -> bool:
    """Check if any word in the list starts with the given prefix."""
    return any(w.startswith(prefix) for w in words)


def _extract_action(words: list) -> str:
    """Extract docker action from words: start, stop, restart."""
    for w in words:
        if w in ('start', 'stop', 'restart'):
            return w
    return ''


def _get_docker_status(container) -> str:
    """Get the Docker container status string."""
    return (container.attrs.get("State", {}) or {}).get("Status", container.status)


def _get_containers(client):
    """Safely get container list, returning (list, error_response)."""
    try:
        return list(client.containers.list(all=True)), None
    except Exception as exc:
        return None, {"status": "error", "message": f"❌ Failed to list containers: {exc}"}


def _handle_container_query(instruction: str, client) -> Optional[dict]:
    """Handle common container queries using flexible keyword matching.
    Returns a response dict if matched, or None to fall through to AI."""
    instr = instruction.lower().strip()
    words = instr.split()

    # ── How many containers [status] — handled first, fastest path ──
    if 'how many' in instr:
        all_c, err = _get_containers(client)
        if err:
            return err
        for s in ('running', 'stopped', 'exited', 'paused'):
            if _words_contain(instr, s):
                sc = [c for c in all_c if c.status == s]
                names = "\n".join(f"  - `{c.name}` ({c.id[:12]})" for c in sc) if sc else "  (none)"
                return {"status": "success", "message": f"📊 **{s.title()} Containers ({len(sc)})**\n\n{names}", "data": f"{s}={len(sc)}"}
        total = len(all_c)
        running = sum(1 for c in all_c if c.status == 'running')
        stopped = sum(1 for c in all_c if c.status in ('exited', 'stopped'))
        return {"status": "success", "message": f"📊 **Container Summary**\n\n- Total: **{total}**\n- Running: **{running}**\n- Stopped: **{stopped}**\n- Other: **{total - running - stopped}**", "data": f"total={total} running={running} stopped={stopped}"}

    # ── List / Show / Which containers [status] ──
    has_list_kw = any(w in words for w in ['list', 'which', 'show', 'display'])
    if (has_list_kw and 'container' in instr) or instr in ('containers', 'container'):
        all_c, err = _get_containers(client)
        if err:
            return err
        status_filter = 'running'
        for s in ('running', 'stopped', 'exited', 'paused', 'all'):
            if _words_contain(instr, s):
                status_filter = s
                break
        filtered = all_c if status_filter == 'all' else [c for c in all_c if c.status == status_filter]
        if not filtered:
            return {"status": "success", "message": f"ℹ️ No containers are **{status_filter}**.", "data": "none"}
        lines = [f"📋 **{status_filter.title()} Containers ({len(filtered)})**"]
        for c in filtered:
            img = c.image.tags[0] if c.image and c.image.tags else (c.image.short_id if c.image else '—')
            lines.append(f"  - `{c.name}` (ID: `{c.id[:12]}`, Image: `{img}`, Status: **{c.status}**)")
        return {"status": "success", "message": "\n".join(lines), "data": "\n".join(c.name for c in filtered)}

    # ── Action commands (start / stop / restart) ──
    action = _extract_action(words)
    if action:
        all_c, err = _get_containers(client)
        if err:
            return err
        target = None
        for c in all_c:
            if c.name.lower() in instr or c.id[:12].lower() in instr:
                target = c
                break
        if target:
            if action == 'start': target.start()
            elif action == 'stop': target.stop()
            elif action == 'restart': target.restart()
            return {"status": "success", "message": f"✅ Container `{target.name}` {action}ed.", "data": f"{action}ed {target.name}"}
        if _has_token_prefix(words, 'all'):
            for c in all_c:
                try:
                    if action == 'start' and c.status != 'running': c.start()
                    elif action == 'stop' and c.status == 'running': c.stop()
                    elif action == 'restart': c.restart()
                except: pass
            return {"status": "success", "message": f"✅ {action.title()} all containers.", "data": f"{action}ed all"}
        return {"status": "error", "message": f"❌ No container found in your request. Try: \"{action} <container_name>\""}

    # ── Is <name> (healthy|running|up|alive|stopped) ──
    if instr.startswith('is '):
        rest = instr[3:].strip()
        if rest.startswith('is '):
            rest = rest[3:].strip()
        state_keywords = ('healthy', 'running', 'stopped', 'paused', 'up', 'alive', 'down', 'dead', 'exited')
        found_state = None
        found_state_pos = -1
        for sk in state_keywords:
            pos = rest.find(sk)
            if pos != -1 and (found_state is None or pos < found_state_pos):
                found_state = sk
                found_state_pos = pos
        if found_state:
            target_name = rest[:found_state_pos].strip()
            if found_state in ('up', 'alive'):
                found_state = 'running'
            if not target_name:
                return {"status": "error", "message": "❌ Please specify a container name (e.g. \"is apache healthy\")."}
            all_c, err = _get_containers(client)
            if err:
                return err
            container, cerr = _match_container(target_name, {c.name.lower(): c for c in all_c}, all_c)
            if cerr:
                return cerr
            if not container:
                return {"status": "error", "message": f"❌ No container found matching \"{target_name}\"."}
            if found_state == 'healthy':
                try:
                    health = container.attrs.get("State", {}).get("Health", {})
                    if health:
                        hs = health.get("Status", "none")
                        icon = "✅" if hs == "healthy" else "⚠️"
                        return {"status": "success", "message": f"{icon} Container `{container.name}` health: **{hs}**.", "data": f"{container.name}: health={hs}"}
                    else:
                        return {"status": "success", "message": f"ℹ️ Container `{container.name}` is **{_get_docker_status(container)}** (no health check).", "data": f"{container.name}: status={_get_docker_status(container)}"}
                except Exception:
                    return {"status": "success", "message": f"ℹ️ Container `{container.name}` is **{_get_docker_status(container)}**.", "data": f"{container.name}: status={_get_docker_status(container)}"}
            else:
                actual = _get_docker_status(container)
                return {"status": "success", "message": f"{'✅' if actual == found_state else '❌'} Container `{container.name}` is **{actual}** (requested: **{found_state}**).", "data": f"{container.name}: status={actual}"}

    # ── Status / state of <name> ──
    if 'status' in words or 'state' in words:
        all_c, err = _get_containers(client)
        if err:
            return err
        for c in all_c:
            if c.name.lower() in instr or c.id[:12].lower() in instr:
                img = c.image.tags[0] if c.image and c.image.tags else '—'
                return {"status": "success", "message": f"📋 **Container: `{c.name}`**\n- ID: `{c.id[:12]}`\n- Image: `{img}`\n- Status: **{_get_docker_status(c)}**\n- Created: {c.attrs.get('Created', '—')[:19]}", "data": f"{c.name}: id={c.id[:12]} status={_get_docker_status(c)}"}

    return None


@router.post("/ai-container-action")
async def ai_container_action(payload: dict):
    instruction = payload.get("instruction", "").strip()
    api_key = payload.get("api_key", "")
    model = payload.get("model", "")
    base_url = payload.get("base_url", "https://api.openai.com/v1")
    provider = payload.get("provider", "openai")

    if not instruction:
        return {"status": "error", "message": "No instruction provided"}
    if not api_key or not model:
        return {"status": "error", "message": "AI not configured. Please set up AI settings first."}

    client = _get_docker_client()
    if client is None:
        return {"status": "error", "message": "Docker daemon not available"}

    # Try to handle common queries directly without AI
    direct_result = _handle_container_query(instruction, client)
    if direct_result is not None:
        return direct_result

    # Build rich container context for the AI
    container_context = _get_container_runtime_context()
    if container_context is None:
        all_containers = client.containers.list(all=True)
        container_lines = []
        for c in all_containers:
            img_tag = c.image.tags[0] if c.image.tags else "(untagged)"
            container_lines.append(
                f'  - name="{c.name}" id="{c.id[:12]}" image="{img_tag}" status="{c.status}"'
            )
        container_context = "\n".join(container_lines) if container_lines else "  (none)"

    all_images = client.images.list()
    image_lines = []
    for img in all_images:
        tags = ", ".join(img.tags) if img.tags else "(untagged)"
        image_lines.append(f'  - tags="{tags}" id="{img.id[:12]}" size={img.attrs.get("Size", 0) / 1e6:.1f}MB')
    image_context = "\n".join(image_lines) if image_lines else "  (none)"

    sys_prompt = AI_CONTAINER_SYSTEM_PROMPT.format(container_list=container_context, image_list=image_context)
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": instruction},
    ]

    # Call AI to determine the Docker command
    try:
        ai_text = _call_ai_sync(api_key, model, base_url, provider, messages, max_tokens=300)
    except Exception as exc:
        return {"status": "error", "message": f"AI call failed: {exc}"}

    # Try to extract JSON from AI response
    import re as _re
    parsed = _extract_json(ai_text)
    docker_command = ""
    explanation = ""

    if parsed:
        docker_command = (parsed.get("command") or "").strip()
        explanation = parsed.get("explanation") or parsed.get("message") or ""

    # If no valid JSON or empty command, try to extract docker command from free text
    if not docker_command:
        # Look for docker command patterns in the AI text
        cmd_match = _re.search(r'(?:docker\s+\S[^"\n]*)', ai_text)
        if cmd_match:
            docker_command = cmd_match.group(0).strip().rstrip('.')
            explanation = "Extracted from AI response"

    # If still no command, try simple extraction: any line starting with "docker"
    if not docker_command:
        for line in ai_text.split('\n'):
            line = line.strip().strip('`').strip()
            if line.startswith('docker '):
                docker_command = line.rstrip('.')
                explanation = "Extracted from AI response"
                break

    if not docker_command:
        return {"status": "error", "message": f"AI couldn't determine a command. Try rephrasing.\n\nAI said: {ai_text[:300]}"}

    # Execute the Docker command via subprocess
    import shlex
    import subprocess

    try:
        args = shlex.split(docker_command)
    except Exception as exc:
        return {"status": "error", "message": f"Invalid command syntax: {exc}"}

    if not args or args[0] != "docker":
        return {"status": "error", "message": f"Only 'docker' commands are allowed, got: {args[0] if args else '(empty)'}"}

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout or ""
        error_output = result.stderr or ""
        if result.returncode != 0:
            msg = f"❌ Command failed (exit {result.returncode})"
            if error_output:
                msg += f":\n```\n{error_output[:2000]}\n```"
            return {"status": "error", "message": msg, "data": error_output[:2000]}
        trimmed = output.strip()[:10000]
        return {
            "status": "success",
            "message": f"✅ {explanation}\n\n```\n{trimmed}\n```",
            "data": trimmed,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 60 seconds."}
    except Exception as exc:
        return {"status": "error", "message": f"Failed to execute command: {exc}"}


# ── Mock fallback ──────────────────────────────────────────────────────────────

def _get_mock_containers():
    """Hardcoded mock data used when Docker daemon is unreachable."""
    logger.warning("docker-intelligence: serving mock container data")
    containers = [
        {
            "id": "a1b2c3d4e5f6",
            "fullId": "a1b2c3d4e5f6abcdef01",
            "name": "web-server",
            "status": "running",
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
            "fullId": "b2c3d4e5f6a1b2c3d4e5f6",
            "name": "api-service",
            "status": "running",
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
            "fullId": "c3d4e5f6a1b2c3d4e5f6a1",
            "name": "redis-cache",
            "status": "running",
            "image": "redis:7.2-alpine",
            "cpuPercent": 0.8,
            "memoryUsage": "64MB / 256MB",
            "restartCount": 5,
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
            "fullId": "d4e5f6a1b2c3d4e5f6a1b2",
            "name": "postgres-db",
            "status": "running",
            "image": "postgres:16-alpine",
            "cpuPercent": 5.2,
            "memoryUsage": "512MB / 2GB",
            "restartCount": 0,
            "healthStatus": "unhealthy",
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
            "fullId": "e5f6a1b2c3d4e5f6a1b2c3",
            "name": "worker-queue",
            "status": "running",
            "image": "python:3.11-slim",
            "cpuPercent": 45.3,
            "memoryUsage": "384MB / 1GB",
            "restartCount": 8,
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
    return {"status": "success", "source": "mock", "data": containers}


# ── container-logs-cli (fallback log fetcher) ──────────────────────────────────

@router.post("/container-logs-cli")
async def container_logs_cli(payload: dict):
    """Fetch container logs via docker SDK — fallback used by AILogAnalysis."""
    container_id = (payload.get("container_id") or "").strip()
    tail = int(payload.get("tail") or 100)

    if not container_id:
        return JSONResponse(status_code=422, content={"status": "error", "message": "container_id required"})

    client = _get_docker_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})

    try:
        container = client.containers.get(container_id)
        raw = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace").strip()
        lines = raw.split("\n") if raw else []
        return {"status": "success", "data": lines}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


# ── container-stats SSE stream ──────────────────────────────────────────────────

import asyncio
import json as _json_mod
from fastapi.responses import StreamingResponse


@router.get("/container-stats/{container_id}")
async def container_stats_stream(container_id: str):
    """SSE stream of live container stats (CPU, memory, network, block I/O)."""
    client = _get_docker_client()
    if client is None:
        async def _err():
            yield 'data: {"error": "Docker daemon unavailable"}\n\n'
        return StreamingResponse(_err(), media_type="text/event-stream")

    async def _generate():
        import time
        try:
            container = client.containers.get(container_id)
        except Exception as exc:
            yield f'data: {{"error": "{str(exc)}"}}\n\n'
            return

        prev_net_rx = prev_net_tx = prev_blk_r = prev_blk_w = 0

        for _ in range(120):  # ~2 min window, ~1s per sample
            try:
                stats = await asyncio.to_thread(container.stats, stream=False)
            except Exception:
                break

            cpu = _cpu_percent_from_stats(stats)
            mem_used, mem_limit = _memory_from_stats(stats)

            # Network delta
            net = stats.get("networks") or {}
            net_rx = sum(n.get("rx_bytes", 0) for n in net.values())
            net_tx = sum(n.get("tx_bytes", 0) for n in net.values())

            # Block I/O delta
            bio = stats.get("blkio_stats", {}).get("io_service_bytes_recursive") or []
            blk_r = sum(b.get("value", 0) for b in bio if b.get("op", "").lower() == "read")
            blk_w = sum(b.get("value", 0) for b in bio if b.get("op", "").lower() == "write")

            point = {
                "cpu": cpu,
                "mem_used_mb": mem_used,
                "mem_limit_mb": mem_limit,
                "net_rx_bytes": max(0, net_rx - prev_net_rx),
                "net_tx_bytes": max(0, net_tx - prev_net_tx),
                "blk_read_bytes": max(0, blk_r - prev_blk_r),
                "blk_write_bytes": max(0, blk_w - prev_blk_w),
                "timestamp": time.strftime("%H:%M:%S"),
            }

            prev_net_rx, prev_net_tx = net_rx, net_tx
            prev_blk_r, prev_blk_w = blk_r, blk_w

            yield f"data: {_json_mod.dumps(point)}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(_generate(), media_type="text/event-stream")



# ── container-logs-cli ─────────────────────────────────────────────────────────

@router.post("/container-logs-cli")
async def container_logs_cli(payload: dict):
    """Fetch container logs via Docker SDK (fallback for AILogAnalysis)."""
    container_id = (payload.get("container_id") or "").strip()
    tail = int(payload.get("tail") or 100)
    if not container_id:
        return JSONResponse(status_code=422, content={"status": "error", "message": "container_id required"})
    client = _get_docker_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})
    try:
        c = client.containers.get(container_id)
        raw = c.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace").strip()
        return {"status": "success", "data": raw.split("\n") if raw else []}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


# ── container-stats SSE stream ─────────────────────────────────────────────────

import asyncio as _asyncio
import json as _json_mod
from fastapi.responses import StreamingResponse


@router.get("/container-stats/{container_id}")
async def container_stats_stream(container_id: str):
    """Server-Sent Events stream of live container stats for ContainerStatsPanel."""
    client = _get_docker_client()
    if client is None:
        async def _err():
            yield 'data: {"error":"Docker daemon unavailable"}\n\n'
        return StreamingResponse(_err(), media_type="text/event-stream")

    async def _generate():
        import time
        try:
            container = client.containers.get(container_id)
        except Exception as exc:
            yield f'data: {{"error":"{exc}"}}\n\n'
            return

        prev = {"rx": 0, "tx": 0, "br": 0, "bw": 0}
        for _ in range(120):
            try:
                s = await _asyncio.to_thread(container.stats, stream=False)
            except Exception:
                break
            cpu = _cpu_percent_from_stats(s)
            mu, ml = _memory_from_stats(s)
            net = s.get("networks") or {}
            rx = sum(n.get("rx_bytes", 0) for n in net.values())
            tx = sum(n.get("tx_bytes", 0) for n in net.values())
            bio = s.get("blkio_stats", {}).get("io_service_bytes_recursive") or []
            br = sum(b.get("value", 0) for b in bio if b.get("op", "").lower() == "read")
            bw = sum(b.get("value", 0) for b in bio if b.get("op", "").lower() == "write")
            point = {
                "cpu": cpu, "mem_used_mb": mu, "mem_limit_mb": ml,
                "net_rx_bytes": max(0, rx - prev["rx"]),
                "net_tx_bytes": max(0, tx - prev["tx"]),
                "blk_read_bytes": max(0, br - prev["br"]),
                "blk_write_bytes": max(0, bw - prev["bw"]),
                "timestamp": time.strftime("%H:%M:%S"),
            }
            prev = {"rx": rx, "tx": tx, "br": br, "bw": bw}
            yield f"data: {_json_mod.dumps(point)}\n\n"
            await _asyncio.sleep(2)

    return StreamingResponse(_generate(), media_type="text/event-stream")
