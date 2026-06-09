# Docker Intelligence — AI Integration Context

## Project Overview

**DevOps Command Center** — A full-stack application with a Python (FastAPI) backend and React (TypeScript) frontend. The Docker Intelligence Center is the core AI-powered feature for Dockerfile analysis, container management, security scanning, log analysis, and cost optimization.

---

## AI Provider Architecture

### Supported Providers (Backend: `backend/routes/ai.py`)

| Provider | SDK/Library | Streaming Method | Auth |
|----------|------------|-----------------|------|
| **OpenAI** | `openai` Python SDK | `stream_openai()` — native streaming | API key |
| **Google Gemini** | `google-generativeai` | `stream_gemini()` — Gemini streaming API | API key |
| **Ollama (local)** | OpenAI-compatible SDK at `localhost:11434/v1` | `stream_openai()` | None |
| **OpenCode (local)** | `httpx` REST API | `stream_opencode()` — session-based, simulated streaming | None |

### Provider Detection Logic

```python
def is_gemini(model: str, base_url: str) -> bool:
    return model.lower().startswith("gemini") or "generativelanguage.googleapis.com" in (base_url or "")

def is_local(base_url: str) -> bool:
    return any(h in (base_url or "") for h in ["localhost", "127.0.0.1", "host.docker.internal"])

def is_opencode(provider: str) -> bool:
    return (provider or "").lower() == "opencode"
```

### Routing Pattern

```python
if is_opencode(request.provider):
    return make_stream_response(stream_opencode, request.base_url, messages)
if is_gemini(request.model, request.base_url):
    return make_stream_response(stream_gemini, request.api_key, request.model, messages)
return make_stream_response(stream_openai, request.api_key, request.model, request.base_url, messages)
```

### Frontend Provider Config (`frontend/src/context/AISettingsContext.tsx`)

- Provider configuration stored in **localStorage** (never sent to server)
- **PROVIDER_GROUPS**: 5 groups — Google Gemini (4 models), OpenAI (3 models), Ollama (4 presets), OpenCode (1 preset), Custom
- **AIGate** component: blocks UI until AI is configured

### Backend Dependencies (`backend/requirements.txt`)

```
openai>=1.30.0
google-generativeai>=0.8.0
docker>=7.1.0
httpx>=0.27.0
```

---

## AI-Powered Docker Endpoints

All endpoints are in `backend/routes/docker_intelligence.py` (1706 lines).

### Dockerfile Analysis & Optimization

| Endpoint | Method | AI System Prompt | Purpose |
|----------|--------|-----------------|---------|
| `/docker-intelligence/analyze` | POST | `ANALYZE_SYSTEM_PROMPT` | Structured JSON: security score, optimization score, layer efficiency, build performance, image size estimate, vulnerability count, risk level, cache efficiency |
| `/docker-intelligence/optimize` | POST | `OPTIMIZE_SYSTEM_PROMPT` / `MULTISTAGE_SYSTEM_PROMPT` / `REDUCE_SIZE_SYSTEM_PROMPT` | 3 modes: `general`, `multistage`, `reduce-size` |
| `/docker-intelligence/security-scan` | POST | `SECURITY_SCAN_SYSTEM_PROMPT` | CVE-style security report with severity levels |
| `/docker-intelligence/explain` | POST | `EXPLAIN_SYSTEM_PROMPT` | Context-aware Q&A — injects Dockerfile + live container data |
| `/docker-intelligence/troubleshoot` | POST | `TROUBLESHOOT_SYSTEM_PROMPT` | Diagnoses build failures and runtime errors |
| `/docker-intelligence/compose` | POST | `COMPOSE_SYSTEM_PROMPT` | Generates production-ready docker-compose.yml |
| `/docker-intelligence/layers` | POST | `LAYERS_SYSTEM_PROMPT` | Layer-by-layer Dockerfile breakdown |
| `/docker-intelligence/analyze-logs` | POST | `LOG_ANALYSIS_SYSTEM_PROMPT` | AI log analysis for specific containers |

### Container Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/docker-intelligence/ai-container-action` | POST | Natural language → Docker CLI command |
| `/container-stats/{container_id}` | GET (SSE) | Real-time stats stream every 2s |
| `/docker-intelligence/terminal` | POST | Predefined Docker commands with real daemon data |
| `/containers` | GET | List all containers |

### AI Container Control Flow

1. First tries **direct pattern matching** (faster) for: "how many containers", "list running", "start/stop/restart", "is X healthy?"
2. Falls back to **AI** with live container/image context injected into system prompt
3. AI returns JSON: `{"command": "docker ...", "explanation": "..."}`
4. Command is **executed** via `subprocess.run()`
5. Output returned to frontend

```
AI_CONTAINER_SYSTEM_PROMPT = """Convert Docker requests to CLI commands. Always output a docker command.
Available containers: {container_list}
Available images: {image_list}
Respond with ONLY valid JSON: {{"command": "docker ...", "explanation": "..."}}
"""
```

### Live Docker Context Injection

```python
def _get_container_runtime_context() -> Optional[str]:
    """Return a formatted summary of running containers for AI context, or None."""
    client = _get_docker_client()
    containers = client.containers.list(all=True)
    # For each container, collects: CPU%, memory, health, ports, networks, last log line
    # Formatted as text and injected into the AI system prompt
```

The AI receives real-time awareness of all running containers — CPU usage, memory consumption, health status, port mappings, network membership, and recent log output.

---

## Specialized System Prompts (15 total)

| Prompt | File | Purpose |
|--------|------|---------|
| `ERROR_SYSTEM_PROMPT` | `ai.py` | Senior DevOps error analysis |
| `DOCKER_SYSTEM_PROMPT` | `ai.py` | Dockerfile optimization (simpler) |
| `CHAT_SYSTEM_PROMPT` | `ai.py` | General DevOps + FinOps Q&A |
| `COST_CHAT_SYSTEM_PROMPT` | `ai.py` | Cloud cost optimization with provider comparison |
| `ANALYZE_SYSTEM_PROMPT` | `docker_intelligence.py` | Structured JSON assessment |
| `OPTIMIZE_SYSTEM_PROMPT` | `docker_intelligence.py` | General Dockerfile optimization |
| `MULTISTAGE_SYSTEM_PROMPT` | `docker_intelligence.py` | Multi-stage build conversion |
| `REDUCE_SIZE_SYSTEM_PROMPT` | `docker_intelligence.py` | Aggressive size reduction |
| `SECURITY_SCAN_SYSTEM_PROMPT` | `docker_intelligence.py` | CVE-style security audit |
| `EXPLAIN_SYSTEM_PROMPT` | `docker_intelligence.py` | Context-aware Docker Q&A (injects live container data) |
| `TROUBLESHOOT_SYSTEM_PROMPT` | `docker_intelligence.py` | Build failure diagnosis |
| `COMPOSE_SYSTEM_PROMPT` | `docker_intelligence.py` | Production docker-compose generation |
| `LAYERS_SYSTEM_PROMPT` | `docker_intelligence.py` | Layer-by-layer analysis |
| `LOG_ANALYSIS_SYSTEM_PROMPT` | `docker_intelligence.py` | Container log diagnostics |
| `AI_CONTAINER_SYSTEM_PROMPT` | `docker_intelligence.py` | Natural language → Docker CLI command translation |

---

## SSE Streaming Format

### Backend Response Format

```
data: {"chunk": "text"}\n\n    # Streaming token
data: {"done": true}\n\n       # Stream complete
data: {"error": "message"}\n\n # Error
```

### Frontend Hooks

- **`useAIStream.ts`** (205 lines) — SSE parsing, tracks: `streaming`, `streamedText`, `elapsed`, `statusMsg`, `streamError`, `firstTokenTime` (TTFT), AbortController for cancellation
- **`useAIRequest.ts`** (124 lines) — Non-streaming variant with 180s timeout for local models

---

## Frontend Architecture

### Main Page: `frontend/src/pages/DockerIntelligencePage.tsx` (313 lines)

Two-tab layout wrapped in `AIGate`:
- **Workspace tab**: Monaco Editor + Analysis Dashboard + Findings + Layer Visualizer + AI Assistant
- **Runtime tab**: Container Monitor + Streaming Terminal + AI Container Control

### Components (12 files in `components/docker-intelligence/`)

| Component | File | AI Features |
|-----------|------|-------------|
| **DockerfileWorkspace** | `DockerfileWorkspace.tsx` (309 lines) | Monaco editor with 8 AI action buttons: Optimize, Secure, Multi-stage, Reduce Size, Explain, Troubleshoot, Gen Compose, Scan Security. Side-by-side diff for optimized Dockerfiles |
| **AIAssistantPanel** | `AIAssistantPanel.tsx` (290 lines) | Persistent Docker-aware chat with suggested prompts. Sends Dockerfile + history to `/explain` |
| **AIContainerControl** | `AIContainerControl.tsx` (175 lines) | Natural language container management |
| **AILogAnalysis** | `AILogAnalysis.tsx` (351 lines) | Fetches container logs (SDK → CLI fallback), classifies log levels, sends to AI |
| **AnalysisDashboard** | `AnalysisDashboard.tsx` | AI-derived quality metrics |
| **FindingsPanel** | `FindingsPanel.tsx` | AI-detected issues with severity + fix suggestions |
| **LayerVisualizer** | `LayerVisualizer.tsx` | Visual layer breakdown |
| **SecurityDashboard** | `SecurityDashboard.tsx` (186 lines) | CVE table with AI explanation on click |
| **RuntimeMonitor** | `RuntimeMonitor.tsx` | Real-time monitoring, polls `/containers` every 10s |
| **ContainerStatsPanel** | `ContainerStatsPanel.tsx` | Real-time stats charts via SSE |
| **ComposeGenerator** | `ComposeGenerator.tsx` | Service picker → AI-generated docker-compose.yml |
| **StreamingTerminal** | `StreamingTerminal.tsx` | Docker command terminal |

### State Management: `frontend/src/store/useDockerIntelligenceStore.ts` (185 lines)

Zustand store:
- **Persisted**: `dockerfileContent`, `chatHistory`
- **Transient**: `analysisResults`, `findings`, `layers`, `securityReport`, `containers`, `composeOutput`, `terminalHistory`, `logAnalysisResults`

---

## Key Files Reference

```
backend/
├── routes/
│   ├── ai.py                          # 611 lines — Multi-provider AI routing + SSE streaming
│   └── docker_intelligence.py         # 1706 lines — All Docker AI endpoints
├── requirements.txt                   # openai, google-generativeai, docker, httpx

frontend/src/
├── context/
│   └── AISettingsContext.tsx           # 242 lines — Provider config, localStorage, AIGate
├── hooks/
│   ├── useAIStream.ts                 # 205 lines — SSE streaming hook
│   └── useAIRequest.ts               # 124 lines — Non-streaming AI hook
├── store/
│   └── useDockerIntelligenceStore.ts  # 185 lines — Zustand state
├── pages/
│   ├── DockerIntelligencePage.tsx     # 313 lines — Main page (2 tabs)
│   ├── AiErrorPage.tsx                # Standalone error explainer
│   ├── AiDockerPage.tsx               # Standalone Dockerfile optimizer
│   └── AiChatPage.tsx                 # General DevOps AI chat
└── components/docker-intelligence/
    ├── DockerfileWorkspace.tsx         # 309 lines — Monaco + 8 AI buttons
    ├── AIAssistantPanel.tsx            # 290 lines — Docker-aware chat
    ├── AIContainerControl.tsx          # 175 lines — NL → Docker commands
    ├── AILogAnalysis.tsx               # 351 lines — Log diagnostics
    ├── AnalysisDashboard.tsx           # Quality metrics
    ├── FindingsPanel.tsx               # Issues + fixes
    ├── LayerVisualizer.tsx             # Layer breakdown
    ├── SecurityDashboard.tsx           # 186 lines — CVE table + AI explain
    ├── RuntimeMonitor.tsx              # Container monitoring
    ├── ContainerStatsPanel.tsx         # SSE stats charts
    ├── ComposeGenerator.tsx            # docker-compose generator
    └── StreamingTerminal.tsx           # Docker terminal
```

---

## Design Decisions

1. **All AI calls are streaming (SSE)** — tokens appear word-by-word
2. **Multi-provider abstraction** — same endpoints work with any provider; detection is automatic
3. **Live Docker context injection** — AI receives real container stats, health, ports, networks, and logs
4. **Hybrid AI + direct execution** — pattern matching first, AI fallback
5. **Client-side API key storage** — keys in localStorage, never sent to backend
6. **Graceful degradation** — mock data when Docker daemon unavailable; fallback UI for Monaco
7. **Local model optimized** — separate token limits, temperatures, and timeouts for local vs cloud
