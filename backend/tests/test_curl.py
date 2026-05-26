"""
Tests for curl command builder endpoint.

Covers:
  - GET request (no -X flag)
  - POST with JSON body (auto Content-Type)
  - PUT, PATCH, DELETE, HEAD, OPTIONS
  - Bearer auth
  - Basic auth
  - Custom headers
  - Verbose, insecure, follow_redirects flags
  - Empty URL returns 422
  - Invalid method returns 422
  - Property: URL always appears in the command
  - Property: method always appears (except GET)
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

VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_get_request_no_x_flag():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://api.example.com/users"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    cmd = data["data"]["command"]
    assert "https://api.example.com/users" in cmd
    assert "-X GET" not in cmd  # GET is default, should be omitted


def test_post_with_json_body():
    resp = client.post("/curl/build", json={
        "method": "POST",
        "url": "https://api.example.com/users",
        "body": '{"name": "Alice"}'
    })
    assert resp.status_code == 200
    cmd = resp.json()["data"]["command"]
    assert "-X POST" in cmd
    assert "Content-Type: application/json" in cmd
    assert "Alice" in cmd


def test_bearer_auth():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://api.example.com/me",
        "auth_type": "bearer",
        "auth_value": "my-secret-token"
    })
    assert resp.status_code == 200
    cmd = resp.json()["data"]["command"]
    assert "Authorization: Bearer my-secret-token" in cmd


def test_basic_auth():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://api.example.com/me",
        "auth_type": "basic",
        "auth_value": "user:password"
    })
    assert resp.status_code == 200
    cmd = resp.json()["data"]["command"]
    assert '-u "user:password"' in cmd


def test_custom_headers():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://api.example.com",
        "headers": {"Accept": "application/json", "X-Request-ID": "abc123"}
    })
    assert resp.status_code == 200
    cmd = resp.json()["data"]["command"]
    assert "Accept: application/json" in cmd
    assert "X-Request-ID: abc123" in cmd


def test_verbose_flag():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://example.com",
        "verbose": True
    })
    assert resp.status_code == 200
    assert "-v" in resp.json()["data"]["command"]


def test_insecure_flag():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://example.com",
        "insecure": True
    })
    assert resp.status_code == 200
    assert "-k" in resp.json()["data"]["command"]


def test_follow_redirects_flag():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://example.com",
        "follow_redirects": True
    })
    assert resp.status_code == 200
    assert "-L" in resp.json()["data"]["command"]


def test_no_follow_redirects():
    resp = client.post("/curl/build", json={
        "method": "GET",
        "url": "https://example.com",
        "follow_redirects": False
    })
    assert resp.status_code == 200
    assert "-L" not in resp.json()["data"]["command"]


def test_delete_method():
    resp = client.post("/curl/build", json={
        "method": "DELETE",
        "url": "https://api.example.com/users/1"
    })
    assert resp.status_code == 200
    assert "-X DELETE" in resp.json()["data"]["command"]


def test_empty_url_returns_422():
    resp = client.post("/curl/build", json={"method": "GET", "url": ""})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_invalid_method_returns_422():
    resp = client.post("/curl/build", json={"method": "FETCH", "url": "https://example.com"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Invalid method" in resp.json()["data"]["message"]


def test_non_json_body_gets_form_content_type():
    resp = client.post("/curl/build", json={
        "method": "POST",
        "url": "https://example.com",
        "body": "name=Alice&age=30"
    })
    assert resp.status_code == 200
    cmd = resp.json()["data"]["command"]
    assert "application/x-www-form-urlencoded" in cmd


def test_response_includes_method_and_url():
    resp = client.post("/curl/build", json={
        "method": "POST",
        "url": "https://api.example.com/data"
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["method"] == "POST"
    assert data["url"] == "https://api.example.com/data"


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    method=st.sampled_from(VALID_METHODS),
    path=st.text(
        min_size=1, max_size=50,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))
    ),
)
@settings(max_examples=100)
def test_url_always_in_command(method, path):
    """The URL must always appear in the generated curl command."""
    url = f"https://api.example.com/{path}"
    resp = client.post("/curl/build", json={"method": method, "url": url})
    assert resp.status_code == 200
    assert url in resp.json()["data"]["command"]


@given(
    method=st.sampled_from([m for m in VALID_METHODS if m != "GET"]),
)
@settings(max_examples=50)
def test_non_get_method_in_command(method):
    """Non-GET methods must appear as -X METHOD in the command."""
    resp = client.post("/curl/build", json={"method": method, "url": "https://example.com"})
    assert resp.status_code == 200
    assert f"-X {method}" in resp.json()["data"]["command"]
