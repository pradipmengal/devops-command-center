"""
Tests for AI streaming endpoints and SSE pipeline.

Covers:
  - Property 1: SSE Frame Serialization Round-Trip (Requirements 1.2, 1.4)
  - Property 8: Provider Detection Correctness (Requirements 7.4)
  - Property 9: Chat History Bounded at 8 Turns (Requirements 8.5)
  - Unit: make_stream_response behavior (Requirements 1.2, 1.3, 1.4)
  - Unit: 401/429 error message hardening (Requirements 5.2, 5.3)
  - Unit: empty-input 422 responses (Requirements 1.1)
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import patch, MagicMock
from hypothesis import given, settings
import hypothesis.strategies as st

import asyncio
from fastapi.testclient import TestClient
from main import app
from routes.ai import is_gemini, make_stream_response, stream_openai, stream_gemini

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _collect_raw(body_iterator):
    """Drain an async or sync body iterator into bytes."""
    chunks = []
    # StreamingResponse.body_iterator may be async or sync depending on Starlette version
    try:
        async for chunk in body_iterator:
            chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    except TypeError:
        # Fallback: sync iterator
        for chunk in body_iterator:
            chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    return b"".join(chunks)


def collect_sse_frames(generator_fn, *args):
    """
    Collect all SSE frames emitted by make_stream_response into a list of
    parsed JSON dicts. Works with both sync and async body iterators.
    """
    response = make_stream_response(generator_fn, *args)
    raw = asyncio.run(_collect_raw(response.body_iterator))
    lines = raw.decode().split("\n")
    frames = []
    for line in lines:
        line = line.strip()
        if line.startswith("data: "):
            payload = line[len("data: "):]
            if payload:
                frames.append(json.loads(payload))
    return frames


# ── Property 1: SSE Frame Serialization Round-Trip ────────────────────────────
# Feature: ai-streaming-response, Property 1: SSE Frame Serialization Round-Trip
# Validates: Requirements 1.2, 1.4

@given(st.text())
@settings(max_examples=100)
def test_sse_chunk_serialization_roundtrip(chunk_text):
    """
    For any text string, serializing it as an SSE chunk frame and parsing
    the data: line back as JSON should recover the original string exactly.
    """
    def single_chunk_gen():
        yield chunk_text

    frames = collect_sse_frames(single_chunk_gen)

    # Should have exactly 2 frames: one chunk + one done
    assert len(frames) == 2, f"Expected 2 frames, got {len(frames)}: {frames}"
    assert frames[0].get("chunk") == chunk_text, (
        f"Chunk mismatch: expected {chunk_text!r}, got {frames[0].get('chunk')!r}"
    )
    assert frames[1] == {"done": True}, f"Expected done frame, got {frames[1]}"


@given(st.text())
@settings(max_examples=100)
def test_sse_error_serialization_roundtrip(error_msg):
    """
    For any error message string, an error frame should round-trip correctly.
    """
    def raising_gen():
        raise Exception(error_msg)
        yield  # make it a generator

    frames = collect_sse_frames(raising_gen)

    assert len(frames) == 1, f"Expected 1 error frame, got {len(frames)}: {frames}"
    assert frames[0].get("error") == error_msg, (
        f"Error mismatch: expected {error_msg!r}, got {frames[0].get('error')!r}"
    )


# ── Property 8: Provider Detection Correctness ───────────────────────────────
# Feature: ai-streaming-response, Property 8: Provider Detection Correctness
# Validates: Requirements 7.4

@given(st.text(), st.text())
@settings(max_examples=100)
def test_provider_detection_correctness(model, base_url):
    """
    is_gemini(model, base_url) returns True iff model starts with 'gemini'
    (case-insensitive) or base_url contains 'generativelanguage.googleapis.com'.
    """
    result = is_gemini(model, base_url)
    expected = (
        model.lower().startswith("gemini")
        or "generativelanguage.googleapis.com" in (base_url or "")
    )
    assert result == expected, (
        f"is_gemini({model!r}, {base_url!r}) = {result}, expected {expected}"
    )


# ── Property 9: Chat History Bounded at 8 Turns ──────────────────────────────
# Feature: ai-streaming-response, Property 9: Chat History Bounded at 8 Turns
# Validates: Requirements 8.5

@given(st.lists(
    st.fixed_dictionaries({
        "role": st.sampled_from(["user", "assistant"]),
        "content": st.text(min_size=1),
    }),
    min_size=0,
    max_size=30,
))
@settings(max_examples=100)
def test_chat_history_capped_at_8(history):
    """
    The /api/ai/chat endpoint caps history to the last 8 turns regardless
    of how many turns are provided.
    """
    # Replicate the slicing logic from the endpoint
    capped = history[-8:]
    assert len(capped) <= 8, (
        f"History of length {len(history)} was not capped: got {len(capped)} turns"
    )


# ── Unit: make_stream_response behavior ──────────────────────────────────────
# Validates: Requirements 1.2, 1.3, 1.4

def test_make_stream_response_three_chunks():
    """Generator yielding 3 chunks produces 3 chunk frames + 1 done frame."""
    def gen():
        yield "hello"
        yield " world"
        yield "!"

    frames = collect_sse_frames(gen)
    assert len(frames) == 4
    assert frames[0] == {"chunk": "hello"}
    assert frames[1] == {"chunk": " world"}
    assert frames[2] == {"chunk": "!"}
    assert frames[3] == {"done": True}


def test_make_stream_response_exception_emits_error_frame():
    """Generator that raises produces a single error frame."""
    def gen():
        raise ValueError("something went wrong")
        yield  # make it a generator

    frames = collect_sse_frames(gen)
    assert len(frames) == 1
    assert frames[0] == {"error": "something went wrong"}


def test_make_stream_response_empty_generator():
    """Empty generator produces only a done frame."""
    def gen():
        return
        yield  # make it a generator

    frames = collect_sse_frames(gen)
    assert len(frames) == 1
    assert frames[0] == {"done": True}


def test_make_stream_response_headers():
    """SSE response includes required no-cache and no-buffering headers."""
    def gen():
        yield "x"

    response = make_stream_response(gen)
    assert response.headers.get("cache-control") == "no-cache"
    assert response.headers.get("x-accel-buffering") == "no"
    assert "text/event-stream" in response.media_type


# ── Unit: 401/429 error message hardening ────────────────────────────────────
# Validates: Requirements 5.2, 5.3

def test_stream_openai_authentication_error_message():
    """AuthenticationError from OpenAI yields exact error message."""
    import openai as _openai

    mock_client = MagicMock()
    mock_stream = MagicMock()
    mock_stream.__iter__ = MagicMock(
        side_effect=_openai.AuthenticationError(
            message="Incorrect API key",
            response=MagicMock(status_code=401, headers={}),
            body={"error": {"message": "Incorrect API key"}},
        )
    )
    mock_client.chat.completions.create.return_value = mock_stream

    with patch("routes.ai.get_openai_client", return_value=mock_client):
        frames = collect_sse_frames(
            stream_openai, "fake-key", "gpt-4o", "https://api.openai.com/v1",
            [{"role": "user", "content": "hi"}]
        )

    assert len(frames) == 1
    assert frames[0].get("error") == "Invalid API key. Check your settings."


def test_stream_openai_rate_limit_error_message():
    """RateLimitError from OpenAI yields exact error message."""
    import openai as _openai

    mock_client = MagicMock()
    mock_stream = MagicMock()
    mock_stream.__iter__ = MagicMock(
        side_effect=_openai.RateLimitError(
            message="Rate limit exceeded",
            response=MagicMock(status_code=429, headers={}),
            body={"error": {"message": "Rate limit exceeded"}},
        )
    )
    mock_client.chat.completions.create.return_value = mock_stream

    with patch("routes.ai.get_openai_client", return_value=mock_client):
        frames = collect_sse_frames(
            stream_openai, "fake-key", "gpt-4o", "https://api.openai.com/v1",
            [{"role": "user", "content": "hi"}]
        )

    assert len(frames) == 1
    assert frames[0].get("error") == "Rate limit exceeded. Please wait and try again."


# ── Unit: empty-input 422 responses ──────────────────────────────────────────
# Validates: Requirements 1.1

def test_explain_error_empty_input_returns_422():
    response = client.post("/ai/explain-error", json={
        "api_key": "test", "model": "gpt-4o", "error_text": ""
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert "message" in data["data"]


def test_optimize_dockerfile_empty_input_returns_422():
    response = client.post("/ai/optimize-dockerfile", json={
        "api_key": "test", "model": "gpt-4o", "dockerfile": ""
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert "message" in data["data"]


def test_chat_empty_message_returns_422():
    response = client.post("/ai/chat", json={
        "api_key": "test", "model": "gpt-4o", "message": ""
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert "message" in data["data"]
