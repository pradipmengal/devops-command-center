"""
Tests for UUID generator and validator endpoints.

Covers:
  - Generate v1, v4, v5 UUIDs
  - Count clamped to 1–20
  - Validate valid UUIDs (v1, v4, v5)
  - Validate invalid UUIDs
  - Unsupported version returns 422
  - Property: all generated UUIDs match the UUID regex
  - Property: generated count matches requested count (within bounds)
  - Property: v4 UUIDs are always unique across a batch
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import re
import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


# ── Unit tests: generate ──────────────────────────────────────────────────────

def test_generate_v4_single():
    resp = client.post("/uuid/generate", json={"version": 4, "count": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert len(data["data"]["uuids"]) == 1
    assert UUID_PATTERN.match(data["data"]["uuids"][0])
    assert data["data"]["version"] == 4


def test_generate_v4_multiple():
    resp = client.post("/uuid/generate", json={"version": 4, "count": 5})
    assert resp.status_code == 200
    uuids = resp.json()["data"]["uuids"]
    assert len(uuids) == 5
    # All unique
    assert len(set(uuids)) == 5


def test_generate_v1():
    resp = client.post("/uuid/generate", json={"version": 1, "count": 3})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]["uuids"]) == 3
    assert data["data"]["version"] == 1
    for u in data["data"]["uuids"]:
        assert UUID_PATTERN.match(u)


def test_generate_v5():
    resp = client.post("/uuid/generate", json={"version": 5, "count": 2, "name": "example.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]["uuids"]) == 2
    # v5 is deterministic — same name produces same UUID
    assert data["data"]["uuids"][0] == data["data"]["uuids"][1]


def test_generate_count_clamped_to_20():
    resp = client.post("/uuid/generate", json={"version": 4, "count": 100})
    assert resp.status_code == 200
    assert len(resp.json()["data"]["uuids"]) == 20
    assert resp.json()["data"]["count"] == 20


def test_generate_count_minimum_1():
    resp = client.post("/uuid/generate", json={"version": 4, "count": 0})
    assert resp.status_code == 200
    assert len(resp.json()["data"]["uuids"]) == 1


def test_generate_unsupported_version_returns_422():
    resp = client.post("/uuid/generate", json={"version": 3, "count": 1})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


# ── Unit tests: validate ──────────────────────────────────────────────────────

def test_validate_valid_v4():
    resp = client.post("/uuid/validate", json={"value": "550e8400-e29b-41d4-a716-446655440000"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_valid"] is True
    assert data["data"]["version"] == 4


def test_validate_invalid_uuid():
    resp = client.post("/uuid/validate", json={"value": "not-a-uuid"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_valid"] is False
    assert data["data"]["version"] is None


def test_validate_uuid_with_wrong_format():
    resp = client.post("/uuid/validate", json={"value": "550e8400-e29b-41d4-a716"})
    assert resp.status_code == 200
    assert resp.json()["data"]["is_valid"] is False


def test_validate_uppercase_uuid():
    resp = client.post("/uuid/validate", json={"value": "550E8400-E29B-41D4-A716-446655440000"})
    assert resp.status_code == 200
    assert resp.json()["data"]["is_valid"] is True


def test_validate_v1_uuid():
    # A known v1 UUID
    resp = client.post("/uuid/validate", json={"value": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["is_valid"] is True
    assert data["data"]["version"] == 1


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    count=st.integers(min_value=1, max_value=20),
)
@settings(max_examples=50)
def test_generated_uuids_match_pattern(count):
    """All generated v4 UUIDs must match the standard UUID regex."""
    resp = client.post("/uuid/generate", json={"version": 4, "count": count})
    assert resp.status_code == 200
    for u in resp.json()["data"]["uuids"]:
        assert UUID_PATTERN.match(u), f"UUID {u!r} does not match pattern"


@given(
    count=st.integers(min_value=1, max_value=20),
)
@settings(max_examples=50)
def test_generated_count_matches_request(count):
    """The number of returned UUIDs must equal the requested count (within 1–20)."""
    resp = client.post("/uuid/generate", json={"version": 4, "count": count})
    assert resp.status_code == 200
    data = resp.json()["data"]
    expected = max(1, min(count, 20))
    assert len(data["uuids"]) == expected
    assert data["count"] == expected


@given(
    count=st.integers(min_value=2, max_value=20),
)
@settings(max_examples=30)
def test_v4_uuids_are_unique(count):
    """v4 UUIDs generated in a single batch must all be unique."""
    resp = client.post("/uuid/generate", json={"version": 4, "count": count})
    assert resp.status_code == 200
    uuids = resp.json()["data"]["uuids"]
    assert len(set(uuids)) == len(uuids)
