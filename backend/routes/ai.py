from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter(prefix="/ai", tags=["ai"])

# ── Provider detection ────────────────────────────────────────────────────────

def is_gemini(model: str, base_url: str) -> bool:
    return (
        model.lower().startswith("gemini")
        or "generativelanguage.googleapis.com" in (base_url or "")
    )

def is_local(base_url: str) -> bool:
    return any(h in (base_url or "") for h in ["localhost", "127.0.0.1", "host.docker.internal"])

def is_opencode(provider: str) -> bool:
    return (provider or "").lower() == "opencode"


# ── Token limits ──────────────────────────────────────────────────────────────

def get_max_tokens(base_url: str, model: str) -> int:
    if is_local(base_url):
        return 600
    return 1500


def get_temperature(base_url: str) -> float:
    return 0.0 if is_local(base_url) else 0.2


def get_extra_options(base_url: str, model: str) -> dict:
    if is_local(base_url):
        return {
            "options": {
                "num_ctx": 2048,
                "num_predict": 600,
                "temperature": 0.0,
            },
            "keep_alive": "10m",
        }
    return {}


# ── System prompts ────────────────────────────────────────────────────────────

ERROR_SYSTEM_PROMPT = """You are a senior DevOps engineer. When given an error, respond with:
## What It Means
(1-2 sentences)
## Root Cause
(1 sentence)
## Fix
(2-3 numbered steps)
Be concise. No filler."""

DOCKER_SYSTEM_PROMPT = """You are a Docker expert. Analyze the Dockerfile and respond with:
## Issues Found
(list with 🔴 Critical / 🟡 Warning / 🔵 Suggestion)
## Optimized Dockerfile
(improved version with inline comments)
## Key Changes
(bullet list)
Be concise."""

CHAT_SYSTEM_PROMPT = """You are a senior DevOps and cloud FinOps engineer. Answer questions about Docker, Kubernetes, Terraform, CI/CD, cloud, Linux, and cloud cost optimization.
When answering about cloud costs or pricing:
- Cite specific service names and realistic prices.
- Suggest actionable recommendations: right-sizing, reserved instances, spot/preemptible, commitment discounts, or provider switching.
- Compare AWS, Azure, and GCP objectively when relevant.
- Keep responses concise and structured — bullet points or short numbered lists.
- Do not invent prices; if unsure, speak in general ranges.
For all other DevOps topics, give clear, practical answers with code blocks for commands. Be concise."""

COST_CHAT_SYSTEM_PROMPT = """You are a cloud FinOps and cost optimization expert. When answering questions about cloud costs:
- Cite specific service names and prices from the provided context whenever available.
- Suggest concrete, actionable recommendations such as provider-switching, right-sizing, reserved instances, or commitment-based discounts.
- Compare providers (AWS, Azure, GCP) objectively using the data in context.
- Keep responses concise and structured — use bullet points or short numbered lists.
- If cost context is provided, ground every recommendation in the actual figures shown.
- Do not invent prices; if data is unavailable, say so clearly."""


# ── OpenAI-compatible streaming call ─────────────────────────────────────────

def get_openai_client(api_key: str, base_url: str):
    from openai import OpenAI
    timeout = 180.0 if is_local(base_url) else 60.0
    return OpenAI(
        api_key=api_key,
        base_url=base_url or "https://api.openai.com/v1",
        timeout=timeout,
    )


def stream_openai(api_key: str, model: str, base_url: str, messages: list):
    """Generator that yields SSE chunks from an OpenAI-compatible API."""
    import openai as _openai
    client = get_openai_client(api_key, base_url)
    extra = get_extra_options(base_url, model)
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=get_temperature(base_url),
        max_tokens=get_max_tokens(base_url, model),
        stream=True,
        extra_body=extra,
    )
    try:
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except _openai.AuthenticationError:
        raise Exception("Invalid API key. Check your settings.")
    except _openai.RateLimitError:
        raise Exception("Rate limit exceeded. Please wait and try again.")
    except Exception:
        raise


def call_openai(api_key: str, model: str, base_url: str, messages: list) -> str:
    """Non-streaming call — used for test-connection ping."""
    client = get_openai_client(api_key, base_url)
    extra = get_extra_options(base_url, model)
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        max_tokens=10,
        extra_body=extra,
    )
    return response.choices[0].message.content


# ── OpenCode session-based call ───────────────────────────────────────────────
#
# OpenCode's `serve` command exposes a session-based REST API, NOT an
# OpenAI-compatible /chat/completions endpoint.  The correct flow is:
#   1. POST {base_url}/session          → { "id": "<session_id>", ... }
#   2. POST {base_url}/session/{id}/message
#      body: { "parts": [{ "type": "text", "text": "<prompt>" }] }
#      → { "info": {...}, "parts": [{ "type": "text", "text": "<reply>" }, ...] }
#
# The message endpoint is synchronous (waits for the full response).
# We simulate streaming by yielding the reply in word-sized chunks.

def _opencode_build_prompt(messages: list) -> str:
    """Flatten a messages list into a single prompt string for OpenCode."""
    parts = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            parts.append(f"[System]: {content}")
        elif role == "user":
            parts.append(f"[User]: {content}")
        elif role == "assistant":
            parts.append(f"[Assistant]: {content}")
    return "\n\n".join(parts)


def _opencode_create_session(client, base_url: str) -> str:
    """Create an OpenCode session and return its ID."""
    resp = client.post(
        base_url.rstrip("/") + "/session",
        json={},
        headers={"Content-Type": "application/json"},
        timeout=15.0,
    )
    resp.raise_for_status()
    data = resp.json()
    session_id = data.get("id")
    if not session_id:
        raise Exception(f"OpenCode session creation returned no ID: {data}")
    return session_id


def _opencode_send_message(client, base_url: str, session_id: str, prompt: str) -> str:
    """Send a message to an OpenCode session and return the text reply."""
    url = f"{base_url.rstrip('/')}/session/{session_id}/message"
    payload = {
        "parts": [{"type": "text", "text": prompt}]
    }
    resp = client.post(
        url,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=120.0,
    )
    resp.raise_for_status()
    data = resp.json()
    # Response: { "info": {...}, "parts": [{ "type": "text", "text": "..." }, ...] }
    reply_parts = data.get("parts", [])
    text_chunks = [p.get("text", "") for p in reply_parts if p.get("type") == "text"]
    return "".join(text_chunks) or "OK"


def stream_opencode(base_url: str, messages: list):
    """
    Stream from OpenCode using the session-based API.
    Creates a session, sends the message synchronously, then yields
    the reply in word-sized chunks to simulate streaming.
    """
    import httpx

    prompt = _opencode_build_prompt(messages)

    with httpx.Client(timeout=120.0) as client:
        session_id = _opencode_create_session(client, base_url)
        reply = _opencode_send_message(client, base_url, session_id, prompt)

    # Simulate streaming: yield word by word with a space separator
    words = reply.split(" ")
    for i, word in enumerate(words):
        if i < len(words) - 1:
            yield word + " "
        else:
            yield word


def call_opencode(base_url: str, messages: list) -> str:
    """Non-streaming OpenCode ping for test-connection."""
    import httpx

    prompt = "Reply with: OK"  # lightweight ping — ignore full message history

    with httpx.Client(timeout=15.0) as client:
        session_id = _opencode_create_session(client, base_url)
        return _opencode_send_message(client, base_url, session_id, prompt)


# ── Gemini streaming call ─────────────────────────────────────────────────────

def stream_gemini(api_key: str, model: str, messages: list):
    """Generator that yields text chunks from Gemini."""
    import google.generativeai as genai
    import google.api_core.exceptions
    genai.configure(api_key=api_key)

    system_prompt = None
    history = []
    last_user_msg = ""

    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            system_prompt = content
        elif role == "user":
            if last_user_msg:
                history.append({"role": "user", "parts": [last_user_msg]})
            last_user_msg = content
        elif role == "assistant":
            if last_user_msg:
                history.append({"role": "user", "parts": [last_user_msg]})
                last_user_msg = ""
            history.append({"role": "model", "parts": [content]})

    gemini_model = genai.GenerativeModel(
        model_name=model,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(temperature=0.1, max_output_tokens=1500),
    )
    chat = gemini_model.start_chat(history=history)
    response = chat.send_message(last_user_msg or "Hello", stream=True)
    try:
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except google.api_core.exceptions.PermissionDenied:
        raise Exception("Invalid API key. Check your settings.")
    except google.api_core.exceptions.ResourceExhausted:
        raise Exception("Rate limit exceeded. Please wait and try again.")
    except Exception:
        raise


def call_gemini_sync(api_key: str, model: str, messages: list) -> str:
    """Non-streaming Gemini call — used for test-connection ping."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    gemini_model = genai.GenerativeModel(
        model_name=model,
        generation_config=genai.GenerationConfig(temperature=0, max_output_tokens=10),
    )
    chat = gemini_model.start_chat(history=[])
    response = chat.send_message("Reply with: OK")
    return response.text


# ── SSE streaming response builder ───────────────────────────────────────────

def make_stream_response(generator_fn, *args):
    """
    Wraps a text generator into a StreamingResponse using Server-Sent Events.
    Each chunk is sent as: data: {"chunk": "..."}\n\n
    On completion: data: {"done": true}\n\n
    On error: data: {"error": "..."}\n\n
    """
    def event_stream():
        try:
            for chunk in generator_fn(*args):
                payload = json.dumps({"chunk": chunk})
                yield f"data: {payload}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Pydantic models ───────────────────────────────────────────────────────────

class AIConfig(BaseModel):
    api_key: str
    model: str
    base_url: Optional[str] = "https://api.openai.com/v1"
    provider: Optional[str] = None


class ErrorExplainerRequest(AIConfig):
    error_text: str


class DockerOptimizerRequest(AIConfig):
    dockerfile: str


class ChatRequest(AIConfig):
    message: str
    history: Optional[list] = []


class CostChatRequest(AIConfig):
    message: str
    history: Optional[list] = []
    cost_context: Optional[dict] = None


# ── Streaming endpoints ───────────────────────────────────────────────────────

@router.post("/explain-error")
async def explain_error(request: ErrorExplainerRequest):
    if not request.error_text.strip():
        return JSONResponse(status_code=422,
            content={"status": "error", "data": {"message": "Error text cannot be empty"}})

    messages = [
        {"role": "system", "content": ERROR_SYSTEM_PROMPT},
        {"role": "user", "content": f"Error:\n```\n{request.error_text}\n```"},
    ]

    if is_opencode(request.provider):
        return make_stream_response(stream_opencode, request.base_url, messages)
    if is_gemini(request.model, request.base_url):
        return make_stream_response(stream_gemini, request.api_key, request.model, messages)
    return make_stream_response(stream_openai, request.api_key, request.model, request.base_url, messages)


@router.post("/optimize-dockerfile")
async def optimize_dockerfile(request: DockerOptimizerRequest):
    if not request.dockerfile.strip():
        return JSONResponse(status_code=422,
            content={"status": "error", "data": {"message": "Dockerfile cannot be empty"}})

    messages = [
        {"role": "system", "content": DOCKER_SYSTEM_PROMPT},
        {"role": "user", "content": f"Dockerfile:\n```dockerfile\n{request.dockerfile}\n```"},
    ]

    if is_opencode(request.provider):
        return make_stream_response(stream_opencode, request.base_url, messages)
    if is_gemini(request.model, request.base_url):
        return make_stream_response(stream_gemini, request.api_key, request.model, messages)
    return make_stream_response(stream_openai, request.api_key, request.model, request.base_url, messages)


@router.post("/chat")
async def devops_chat(request: ChatRequest):
    if not request.message.strip():
        return JSONResponse(status_code=422,
            content={"status": "error", "data": {"message": "Message cannot be empty"}})

    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    for msg in (request.history or [])[-8:]:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": request.message})

    if is_opencode(request.provider):
        return make_stream_response(stream_opencode, request.base_url, messages)
    if is_gemini(request.model, request.base_url):
        return make_stream_response(stream_gemini, request.api_key, request.model, messages)
    return make_stream_response(stream_openai, request.api_key, request.model, request.base_url, messages)


@router.post("/cost-chat")
async def cost_chat(request: CostChatRequest):
    if not request.message.strip():
        return JSONResponse(status_code=422,
            content={"status": "error", "data": {"message": "Message cannot be empty"}})

    messages = [{"role": "system", "content": COST_CHAT_SYSTEM_PROMPT}]

    if request.cost_context:
        context_summary = f"Current dashboard context:\n{json.dumps(request.cost_context, indent=2)}"
        messages.append({"role": "system", "content": context_summary})

    for msg in (request.history or [])[-8:]:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": request.message})

    if is_opencode(request.provider):
        return make_stream_response(stream_opencode, request.base_url, messages)
    if is_gemini(request.model, request.base_url):
        return make_stream_response(stream_gemini, request.api_key, request.model, messages)
    return make_stream_response(stream_openai, request.api_key, request.model, request.base_url, messages)


# ── Test connection (non-streaming, fast ping) ────────────────────────────────

class TestConnectionRequest(AIConfig):
    pass


@router.post("/test-connection")
async def test_connection(request: TestConnectionRequest):
    # OpenCode doesn't need an API key
    if not is_opencode(request.provider):
        if not request.api_key.strip():
            return JSONResponse(status_code=422,
                content={"status": "error", "data": {"message": "API key cannot be empty"}})
    if not request.model.strip():
        return JSONResponse(status_code=422,
            content={"status": "error", "data": {"message": "Model name cannot be empty"}})

    try:
        if is_opencode(request.provider):
            # Use raw httpx — bypasses OpenAI SDK parsing issues
            # OpenCode serve runs at root level (127.0.0.1:4096), not /v1
            result = call_opencode(
                request.base_url or "http://127.0.0.1:4096",
                [{"role": "user", "content": "Reply with: OK"}]
            )
        elif is_gemini(request.model, request.base_url):
            result = call_gemini_sync(request.api_key, request.model, [])
        else:
            result = call_openai(
                request.api_key,
                request.model,
                request.base_url,
                [{"role": "user", "content": "Reply with exactly: OK"}]
            )
        return {
            "status": "success",
            "data": {
                "message": f"✅ Connected successfully to {request.model}",
                "model": request.model,
                "response_preview": (result or "")[:100],
            },
        }
    except Exception as e:
        hint = _diagnose_connection_error(str(e), request.base_url, request.model)
        if is_opencode(request.provider):
            hint = (
                "OpenCode server is not running or unreachable.\n"
                "1. Run: opencode serve\n"
                "2. Click '↻ Check' in the OpenCode panel to auto-detect the URL.\n"
                "3. If running in Docker, the URL should be http://host.docker.internal:4096"
            )
        return JSONResponse(status_code=200, content={
            "status": "error",
            "data": {
                "message": f"Connection failed: {str(e)}",
                "hint": hint,
                "model": request.model,
                "base_url": request.base_url,
            },
        })


def _diagnose_connection_error(error: str, base_url: str, model: str) -> str:
    e = error.lower()
    if any(k in e for k in ["connection refused", "connect call failed", "connection error",
                              "failed to connect", "cannot connect", "network is unreachable",
                              "no route to host", "name or service not known"]):
        if "localhost" in (base_url or "") or "127.0.0.1" in (base_url or ""):
            return ("Cannot reach server at localhost. If running inside Docker, use "
                    "http://host.docker.internal:4096 instead.")
        return f"Cannot reach the server at {base_url}. Check the URL and that the service is running."
    if any(k in e for k in ["model not found", "no such model", "pull model", "unknown model",
                              "does not exist"]):
        return f"Model '{model}' not found. Pull it first: ollama pull {model}"
    if any(k in e for k in ["401", "unauthorized", "invalid api key", "incorrect api key"]):
        return "Invalid API key. Double-check your key."
    if any(k in e for k in ["429", "rate limit", "quota exceeded"]):
        return "Rate limit exceeded. Wait a moment and try again."
    if any(k in e for k in ["timeout", "timed out"]):
        return ("Request timed out. The model may be loading. Try again in a few seconds.")
    return ("Check: (1) base URL is correct, (2) service is running, "
            "(3) model name is correct, (4) API key is valid.")


# ── Provider info ─────────────────────────────────────────────────────────────

@router.get("/providers")
async def list_providers():
    return {
        "status": "success",
        "data": {
            "providers": [
                {"name": "OpenAI",        "id": "openai",  "models": ["gpt-4o", "gpt-4o-mini"], "base_url": "https://api.openai.com/v1"},
                {"name": "Google Gemini", "id": "gemini",  "models": ["gemini-2.0-flash", "gemini-1.5-flash"], "base_url": "https://generativelanguage.googleapis.com"},
                {"name": "Ollama",        "id": "ollama",  "models": ["qwen2.5-coder:3b", "llama3", "mistral"], "base_url": "http://localhost:11434/v1"},
                {"name": "OpenCode",      "id": "opencode","models": ["opencode"], "base_url": "http://127.0.0.1:4096"},
            ]
        },
    }


# ── OpenCode status check ─────────────────────────────────────────────────────

OPENCODE_CANDIDATE_URLS = [
    "http://host.docker.internal:4096",  # Docker Desktop (Mac/Windows/Linux)
    "http://localhost:4096",             # native / non-Docker
    "http://172.17.0.1:4096",           # Docker bridge gateway (Linux)
]


async def _probe_opencode_url(client, base: str) -> bool:
    """Return True if opencode serve is reachable at base.
    Uses GET /global/health which returns { "healthy": true } on a live server.
    """
    try:
        resp = await client.get(f"{base}/global/health", timeout=2.0)
        if resp.status_code == 200:
            try:
                return resp.json().get("healthy") is True
            except Exception:
                return False
        return False
    except Exception:
        return False


@router.get("/opencode/status")
async def opencode_status():
    """
    Check if opencode serve is reachable.
    Probes all candidate URLs concurrently and returns the first that responds.

    NOTE: The opencode CLI runs on the HOST machine, not inside the Docker
    container.  We do not attempt to detect it via subprocess — instead we
    report it as running on the host and rely solely on the HTTP health probe
    to determine whether the server is reachable.
    """
    import httpx as _httpx

    # CLI runs on the host — not detectable from inside the container.
    # We always report it as "installed on host" so the UI shows a helpful
    # message rather than a misleading "not found" error.
    installed = True
    version = "runs on host (not detectable from container)"

    # Probe all candidate URLs concurrently (without /v1 suffix)
    running = False
    detected_url = None

    async with _httpx.AsyncClient(follow_redirects=True) as client:
        import asyncio as _asyncio
        results = await _asyncio.gather(
            *[_probe_opencode_url(client, url) for url in OPENCODE_CANDIDATE_URLS],
            return_exceptions=True,
        )

    for url, ok in zip(OPENCODE_CANDIDATE_URLS, results):
        if ok is True:
            running = True
            detected_url = url  # Keep without /v1 suffix
            break

    serve_url = detected_url or "http://127.0.0.1:4096"
    is_docker = "host.docker.internal" in (detected_url or "")

    return {
        "status": "success",
        "data": {
            "installed": installed,
            "version": version,
            "running": running,
            "serve_url": serve_url,
            "detected_url": detected_url,
            "is_docker": is_docker,
            "start_command": "opencode serve",
            "probed_urls": OPENCODE_CANDIDATE_URLS,
        }
    }
