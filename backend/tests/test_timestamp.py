"""
Tests for Unix Timestamp converter endpoint.

Covers:
  - Unix timestamp → date (to_date mode)
  - Date string → Unix timestamp (to_timestamp mode)
  - Round-trip: timestamp → date → timestamp
  - Invalid mode returns 422
  - Non-numeric value in to_date mode returns 422
  - Unparseable date string returns 422
  - All supported date formats parse correctly
  - Property: to_date always returns a valid UTC string
  - Property: to_timestamp → to_date round-trip preserves the timestamp
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_to_date_known_timestamp():
    """Unix timestamp 0 should be 1970-01-01 00:00:00 UTC."""
    resp = client.post("/timestamp/convert", json={"value": "0", "mode": "to_date"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "1970-01-01" in data["data"]["utc"]
    assert data["data"]["unix_timestamp"] == 0


def test_to_date_returns_all_fields():
    resp = client.post("/timestamp/convert", json={"value": "1700000000", "mode": "to_date"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "unix_timestamp" in data
    assert "utc" in data
    assert "iso8601" in data
    assert "timezones" in data
    assert "relative" in data
    assert "UTC" in data["timezones"]


def test_to_date_timezones_present():
    resp = client.post("/timestamp/convert", json={"value": "1700000000", "mode": "to_date"})
    assert resp.status_code == 200
    zones = resp.json()["data"]["timezones"]
    expected_zones = ["UTC", "US/Eastern", "US/Pacific", "Europe/London", "Asia/Tokyo"]
    for zone in expected_zones:
        assert zone in zones


def test_to_timestamp_iso_format():
    resp = client.post("/timestamp/convert", json={
        "value": "2024-01-15 12:00:00",
        "mode": "to_timestamp"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert isinstance(data["data"]["unix_timestamp"], int)
    assert data["data"]["unix_timestamp"] > 0


def test_to_timestamp_date_only():
    resp = client.post("/timestamp/convert", json={
        "value": "2024-01-15",
        "mode": "to_timestamp"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


def test_to_timestamp_iso_t_format():
    resp = client.post("/timestamp/convert", json={
        "value": "2024-01-15T12:00:00",
        "mode": "to_timestamp"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


def test_invalid_mode_returns_422():
    resp = client.post("/timestamp/convert", json={"value": "1700000000", "mode": "invalid"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "mode" in resp.json()["data"]["message"]


def test_non_numeric_to_date_returns_422():
    resp = client.post("/timestamp/convert", json={"value": "not-a-number", "mode": "to_date"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_unparseable_date_returns_422():
    resp = client.post("/timestamp/convert", json={
        "value": "January 15th 2024",
        "mode": "to_timestamp"
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Cannot parse" in resp.json()["data"]["message"]


def test_roundtrip_timestamp_to_date_to_timestamp():
    """timestamp → date → timestamp should recover the original timestamp."""
    original_ts = 1700000000

    # to_date
    resp1 = client.post("/timestamp/convert", json={"value": str(original_ts), "mode": "to_date"})
    assert resp1.status_code == 200
    utc_str = resp1.json()["data"]["utc"].replace(" UTC", "")

    # to_timestamp
    resp2 = client.post("/timestamp/convert", json={"value": utc_str, "mode": "to_timestamp"})
    assert resp2.status_code == 200
    recovered_ts = resp2.json()["data"]["unix_timestamp"]

    assert recovered_ts == original_ts


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    # Timestamps from 2000-01-01 to 2038-01-01 (safe range for all platforms)
    ts=st.integers(min_value=946684800, max_value=2145916800),
)
@settings(max_examples=100)
def test_to_date_always_returns_valid_utc(ts):
    """For any valid timestamp, to_date returns a non-empty UTC string."""
    resp = client.post("/timestamp/convert", json={"value": str(ts), "mode": "to_date"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "UTC" in data["data"]["utc"]
    assert data["data"]["unix_timestamp"] == ts


@given(
    ts=st.integers(min_value=946684800, max_value=2145916800),
)
@settings(max_examples=50)
def test_to_date_to_timestamp_roundtrip(ts):
    """timestamp → date string → timestamp should recover the original value."""
    resp1 = client.post("/timestamp/convert", json={"value": str(ts), "mode": "to_date"})
    assert resp1.status_code == 200
    utc_str = resp1.json()["data"]["utc"].replace(" UTC", "")

    resp2 = client.post("/timestamp/convert", json={"value": utc_str, "mode": "to_timestamp"})
    assert resp2.status_code == 200
    assert resp2.json()["data"]["unix_timestamp"] == ts
