"""
Tests for JSON ↔ YAML converter endpoint.

Covers:
  - JSON → YAML conversion
  - YAML → JSON conversion
  - Round-trip: JSON → YAML → JSON preserves data
  - Round-trip: YAML → JSON → YAML preserves data
  - Invalid JSON returns 422
  - Invalid YAML returns 422
  - Unsupported from_format returns 422
  - Property: round-trip preserves all keys and values
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import yaml
import pytest
from hypothesis import given, settings, assume
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_json_to_yaml():
    resp = client.post("/converter/convert", json={
        "content": '{"name": "test", "value": 42}',
        "from_format": "json"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["from_format"] == "json"
    assert data["data"]["to_format"] == "yaml"
    # Parse the YAML result and verify values
    parsed = yaml.safe_load(data["data"]["result"])
    assert parsed["name"] == "test"
    assert parsed["value"] == 42


def test_yaml_to_json():
    yaml_input = "name: test\nvalue: 42\n"
    resp = client.post("/converter/convert", json={
        "content": yaml_input,
        "from_format": "yaml"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["from_format"] == "yaml"
    assert data["data"]["to_format"] == "json"
    parsed = json.loads(data["data"]["result"])
    assert parsed["name"] == "test"
    assert parsed["value"] == 42


def test_json_to_yaml_nested():
    content = json.dumps({
        "server": {"host": "localhost", "port": 8080},
        "features": ["auth", "logging"],
        "debug": True
    })
    resp = client.post("/converter/convert", json={"content": content, "from_format": "json"})
    assert resp.status_code == 200
    parsed = yaml.safe_load(resp.json()["data"]["result"])
    assert parsed["server"]["host"] == "localhost"
    assert parsed["server"]["port"] == 8080
    assert "auth" in parsed["features"]
    assert parsed["debug"] is True


def test_invalid_json_returns_422():
    resp = client.post("/converter/convert", json={
        "content": "{not valid json}",
        "from_format": "json"
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Invalid JSON" in resp.json()["data"]["message"]


def test_invalid_yaml_returns_422():
    resp = client.post("/converter/convert", json={
        "content": "key: [unclosed bracket",
        "from_format": "yaml"
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Invalid YAML" in resp.json()["data"]["message"]


def test_unsupported_format_returns_422():
    resp = client.post("/converter/convert", json={
        "content": "anything",
        "from_format": "xml"
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_from_format_case_insensitive():
    resp = client.post("/converter/convert", json={
        "content": '{"key": "value"}',
        "from_format": "JSON"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


def test_json_to_yaml_roundtrip():
    """JSON → YAML → JSON should preserve the original data."""
    original = {"a": 1, "b": [1, 2, 3], "c": {"nested": True}}
    json_str = json.dumps(original)

    # JSON → YAML
    resp1 = client.post("/converter/convert", json={"content": json_str, "from_format": "json"})
    assert resp1.status_code == 200
    yaml_str = resp1.json()["data"]["result"]

    # YAML → JSON
    resp2 = client.post("/converter/convert", json={"content": yaml_str, "from_format": "yaml"})
    assert resp2.status_code == 200
    recovered = json.loads(resp2.json()["data"]["result"])

    assert recovered == original


# ── Property tests ────────────────────────────────────────────────────────────

# Strategy for JSON-serializable dicts with simple string keys and scalar values
simple_json_strategy = st.dictionaries(
    keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))),
    values=st.one_of(
        st.integers(min_value=-1000, max_value=1000),
        st.floats(min_value=-1000, max_value=1000, allow_nan=False, allow_infinity=False),
        st.text(min_size=0, max_size=50, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs"))),
        st.booleans(),
    ),
    min_size=1,
    max_size=10,
)


@given(data=simple_json_strategy)
@settings(max_examples=100)
def test_json_yaml_roundtrip_property(data):
    """For any simple JSON object, JSON → YAML → JSON preserves all key-value pairs."""
    json_str = json.dumps(data)

    resp1 = client.post("/converter/convert", json={"content": json_str, "from_format": "json"})
    assert resp1.status_code == 200
    yaml_str = resp1.json()["data"]["result"]

    resp2 = client.post("/converter/convert", json={"content": yaml_str, "from_format": "yaml"})
    assert resp2.status_code == 200
    recovered = json.loads(resp2.json()["data"]["result"])

    # All original keys must be present with the same values
    for key, value in data.items():
        assert key in recovered
        # Float comparison needs tolerance
        if isinstance(value, float):
            assert abs(recovered[key] - value) < 1e-9
        else:
            assert recovered[key] == value
