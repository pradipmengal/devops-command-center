"""
Tests for Regex tester endpoint.

Covers:
  - Basic match detection
  - Match count and positions
  - Capture groups (numbered and named)
  - Flags: i (IGNORECASE), m (MULTILINE), s (DOTALL)
  - Empty pattern returns 422
  - Invalid regex pattern returns 422
  - No matches returns is_match=False with empty list
  - Property: match count equals len(matches) list
  - Property: all match positions are within string bounds
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import re
import pytest
from hypothesis import given, settings, assume
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_basic_match():
    resp = client.post("/regex/test", json={
        "pattern": r"\d+",
        "test_string": "abc 123 def 456",
        "flags": []
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_match"] is True
    assert data["data"]["match_count"] == 2
    assert data["data"]["matches"][0]["match"] == "123"
    assert data["data"]["matches"][1]["match"] == "456"


def test_no_match():
    resp = client.post("/regex/test", json={
        "pattern": r"\d+",
        "test_string": "no numbers here",
        "flags": []
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_match"] is False
    assert data["data"]["match_count"] == 0
    assert data["data"]["matches"] == []


def test_match_positions():
    resp = client.post("/regex/test", json={
        "pattern": "hello",
        "test_string": "say hello world hello",
        "flags": []
    })
    assert resp.status_code == 200
    matches = resp.json()["data"]["matches"]
    assert len(matches) == 2
    assert matches[0]["start"] == 4
    assert matches[0]["end"] == 9
    assert matches[1]["start"] == 16
    assert matches[1]["end"] == 21


def test_capture_groups():
    resp = client.post("/regex/test", json={
        "pattern": r"(\w+)@(\w+)\.(\w+)",
        "test_string": "user@example.com",
        "flags": []
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["is_match"] is True
    groups = data["data"]["matches"][0]["groups"]
    assert groups == ["user", "example", "com"]


def test_named_capture_groups():
    resp = client.post("/regex/test", json={
        "pattern": r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})",
        "test_string": "Date: 2024-01-15",
        "flags": []
    })
    assert resp.status_code == 200
    named = resp.json()["data"]["matches"][0]["named_groups"]
    assert named["year"] == "2024"
    assert named["month"] == "01"
    assert named["day"] == "15"


def test_flag_ignorecase():
    resp = client.post("/regex/test", json={
        "pattern": "hello",
        "test_string": "HELLO World",
        "flags": ["i"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["is_match"] is True
    assert "IGNORECASE" in data["data"]["flags_applied"]


def test_flag_multiline():
    resp = client.post("/regex/test", json={
        "pattern": r"^\d+",
        "test_string": "123\nabc\n456",
        "flags": ["m"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["match_count"] == 2
    assert "MULTILINE" in data["data"]["flags_applied"]


def test_flag_dotall():
    resp = client.post("/regex/test", json={
        "pattern": r"start.+end",
        "test_string": "start\nmiddle\nend",
        "flags": ["s"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["is_match"] is True
    assert "DOTALL" in data["data"]["flags_applied"]


def test_empty_pattern_returns_422():
    resp = client.post("/regex/test", json={
        "pattern": "",
        "test_string": "anything",
        "flags": []
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_invalid_pattern_returns_422():
    resp = client.post("/regex/test", json={
        "pattern": "[unclosed",
        "test_string": "test",
        "flags": []
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Invalid regex" in resp.json()["data"]["message"]


def test_no_flags_defaults_to_empty():
    resp = client.post("/regex/test", json={
        "pattern": r"\w+",
        "test_string": "hello"
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["flags_applied"] == []


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    text=st.text(min_size=0, max_size=200),
)
@settings(max_examples=100)
def test_match_count_equals_matches_list_length(text):
    """match_count must always equal len(matches)."""
    resp = client.post("/regex/test", json={
        "pattern": r"\d+",
        "test_string": text,
        "flags": []
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["match_count"] == len(data["matches"])


@given(
    text=st.text(min_size=1, max_size=200),
)
@settings(max_examples=100)
def test_match_positions_within_bounds(text):
    """All match start/end positions must be within the string bounds."""
    resp = client.post("/regex/test", json={
        "pattern": r"\w+",
        "test_string": text,
        "flags": []
    })
    assert resp.status_code == 200
    for match in resp.json()["data"]["matches"]:
        assert 0 <= match["start"] < len(text)
        assert match["start"] < match["end"] <= len(text)


@given(
    text=st.text(min_size=0, max_size=200),
)
@settings(max_examples=100)
def test_is_match_consistent_with_matches(text):
    """is_match must be True iff matches list is non-empty."""
    resp = client.post("/regex/test", json={
        "pattern": r"\d+",
        "test_string": text,
        "flags": []
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_match"] == (len(data["matches"]) > 0)
