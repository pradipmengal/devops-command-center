import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_encode_hello():
    response = client.post("/utils/base64", json={"text": "hello", "mode": "encode"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["result"] == "aGVsbG8="


def test_decode_hello():
    response = client.post("/utils/base64", json={"text": "aGVsbG8=", "mode": "decode"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["result"] == "hello"


def test_invalid_base64_decode():
    response = client.post("/utils/base64", json={"text": "not-valid-base64!!!", "mode": "decode"})
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert "message" in data["data"]


def test_unsupported_mode():
    response = client.post("/utils/base64", json={"text": "hello", "mode": "encrypt"})
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_encode_decode_roundtrip():
    original = "Hello, DevOps World! 🚀"
    encode_resp = client.post("/utils/base64", json={"text": original, "mode": "encode"})
    encoded = encode_resp.json()["data"]["result"]

    decode_resp = client.post("/utils/base64", json={"text": encoded, "mode": "decode"})
    assert decode_resp.json()["data"]["result"] == original
