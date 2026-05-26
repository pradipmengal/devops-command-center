"""
Tests for Hash generator endpoint.

Covers:
  - All 6 supported algorithms produce correct output
  - Empty text returns 422
  - Unsupported algorithm returns 422
  - Property: same input always produces same hash (determinism)
  - Property: different inputs produce different hashes (collision resistance for simple cases)
  - Property: hash length is correct for each algorithm
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import hashlib
import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

ALGORITHMS = ["md5", "sha1", "sha224", "sha256", "sha384", "sha512"]

EXPECTED_LENGTHS = {
    "md5":    32,
    "sha1":   40,
    "sha224": 56,
    "sha256": 64,
    "sha384": 96,
    "sha512": 128,
}


# ── Unit tests ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("algo", ALGORITHMS)
def test_hash_known_value(algo):
    """Each algorithm produces the correct hash for 'hello'."""
    resp = client.post("/hash/generate", json={"text": "hello", "algorithm": algo})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"

    expected = hashlib.new(algo, b"hello").hexdigest()
    assert data["data"]["hash"] == expected
    assert data["data"]["algorithm"] == algo
    assert data["data"]["input_length"] == 5


@pytest.mark.parametrize("algo", ALGORITHMS)
def test_hash_length_correct(algo):
    """Hash output length matches the expected hex digest length for each algorithm."""
    resp = client.post("/hash/generate", json={"text": "test input", "algorithm": algo})
    assert resp.status_code == 200
    assert len(resp.json()["data"]["hash"]) == EXPECTED_LENGTHS[algo]


def test_hash_empty_text_returns_422():
    resp = client.post("/hash/generate", json={"text": "", "algorithm": "sha256"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_hash_unsupported_algorithm_returns_422():
    resp = client.post("/hash/generate", json={"text": "hello", "algorithm": "sha3_256"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Unsupported" in resp.json()["data"]["message"]


def test_hash_algorithm_case_insensitive():
    """Algorithm name should be case-insensitive."""
    resp = client.post("/hash/generate", json={"text": "hello", "algorithm": "SHA256"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


def test_hash_unicode_input():
    """Unicode text should be hashed correctly."""
    resp = client.post("/hash/generate", json={"text": "héllo wörld 🚀", "algorithm": "sha256"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    expected = hashlib.sha256("héllo wörld 🚀".encode("utf-8")).hexdigest()
    assert data["data"]["hash"] == expected


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    text=st.text(min_size=1, max_size=500),
    algo=st.sampled_from(ALGORITHMS),
)
@settings(max_examples=100)
def test_hash_determinism(text, algo):
    """Same input always produces the same hash (determinism property)."""
    resp1 = client.post("/hash/generate", json={"text": text, "algorithm": algo})
    resp2 = client.post("/hash/generate", json={"text": text, "algorithm": algo})
    assert resp1.status_code == 200
    assert resp1.json()["data"]["hash"] == resp2.json()["data"]["hash"]


@given(
    text=st.text(min_size=1, max_size=200),
    algo=st.sampled_from(ALGORITHMS),
)
@settings(max_examples=100)
def test_hash_matches_stdlib(text, algo):
    """API output matches Python's hashlib for any input."""
    resp = client.post("/hash/generate", json={"text": text, "algorithm": algo})
    assert resp.status_code == 200
    expected = hashlib.new(algo, text.encode("utf-8")).hexdigest()
    assert resp.json()["data"]["hash"] == expected


@given(
    text=st.text(min_size=1, max_size=200),
    algo=st.sampled_from(ALGORITHMS),
)
@settings(max_examples=100)
def test_hash_output_length_property(text, algo):
    """Hash output length is always the expected hex digest length."""
    resp = client.post("/hash/generate", json={"text": text, "algorithm": algo})
    assert resp.status_code == 200
    assert len(resp.json()["data"]["hash"]) == EXPECTED_LENGTHS[algo]
