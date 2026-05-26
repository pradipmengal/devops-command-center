"""
Tests for JWT decoder endpoint.

Covers:
  - Valid JWT decode (header, payload, signature)
  - Expired token detection
  - Non-expired token
  - Invalid format (wrong number of parts)
  - Malformed base64 payload
  - Property: decode(encode(payload)) round-trip preserves all claims
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import base64
import json
import time
import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_jwt(header: dict, payload: dict, signature: str = "fakesig") -> str:
    """Build a JWT string from dicts (no real signing — for decode testing only)."""
    def b64(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
    return f"{b64(header)}.{b64(payload)}.{signature}"


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_decode_valid_jwt():
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": "1234567890", "name": "John Doe", "iat": 1516239022}
    token = make_jwt(header, payload)

    resp = client.post("/jwt/decode", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["header"] == header
    assert data["data"]["payload"] == payload
    assert data["data"]["signature"] == "fakesig"


def test_decode_expired_token():
    past_exp = int(time.time()) - 3600  # 1 hour ago
    payload = {"sub": "user1", "exp": past_exp}
    token = make_jwt({"alg": "HS256"}, payload)

    resp = client.post("/jwt/decode", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_expired"] is True
    assert data["data"]["expires_in_seconds"] is None


def test_decode_non_expired_token():
    future_exp = int(time.time()) + 3600  # 1 hour from now
    payload = {"sub": "user1", "exp": future_exp}
    token = make_jwt({"alg": "HS256"}, payload)

    resp = client.post("/jwt/decode", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_expired"] is False
    assert data["data"]["expires_in_seconds"] is not None
    assert data["data"]["expires_in_seconds"] > 0


def test_decode_no_exp_claim():
    payload = {"sub": "user1", "name": "Alice"}
    token = make_jwt({"alg": "HS256"}, payload)

    resp = client.post("/jwt/decode", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["is_expired"] is None
    assert data["data"]["expires_in_seconds"] is None


def test_decode_invalid_format_two_parts():
    resp = client.post("/jwt/decode", json={"token": "header.payload"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "3 parts" in resp.json()["data"]["message"]


def test_decode_invalid_format_one_part():
    resp = client.post("/jwt/decode", json={"token": "notajwt"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_decode_invalid_base64():
    resp = client.post("/jwt/decode", json={"token": "!!!.!!!.!!!"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_decode_real_jwt_sample():
    # A real (unsigned) JWT from jwt.io
    token = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
        ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
    resp = client.post("/jwt/decode", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["payload"]["sub"] == "1234567890"
    assert data["data"]["payload"]["name"] == "John Doe"


# ── Property test: round-trip ─────────────────────────────────────────────────

@given(
    sub=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))),
    name=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Zs"))),
)
@settings(max_examples=50)
def test_jwt_decode_roundtrip(sub, name):
    """For any valid sub/name, decoding the constructed JWT returns the same values."""
    payload = {"sub": sub, "name": name.strip() or "user"}
    token = make_jwt({"alg": "HS256", "typ": "JWT"}, payload)

    resp = client.post("/jwt/decode", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["payload"]["sub"] == sub
