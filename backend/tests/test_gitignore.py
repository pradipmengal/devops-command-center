"""
Tests for .gitignore generator endpoint.

Covers:
  - Single type generates correct template
  - Multiple types merge without duplicates
  - All 14 supported types work individually
  - Empty types list returns 422
  - Unsupported type returns 422
  - Property: merged output contains no duplicate non-comment lines
  - Property: types_included in response matches requested types
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

ALL_TYPES = [
    "node", "python", "java", "go", "rust", "dotnet", "react",
    "macos", "windows", "linux", "jetbrains", "vscode", "docker", "terraform"
]


# ── Unit tests ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("t", ALL_TYPES)
def test_each_type_generates_output(t):
    """Every supported type should produce a non-empty .gitignore."""
    resp = client.post("/gitignore/generate", json={"types": [t]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert len(data["data"]["gitignore"]) > 0
    assert data["data"]["types_included"] == [t]


def test_node_contains_node_modules():
    resp = client.post("/gitignore/generate", json={"types": ["node"]})
    assert resp.status_code == 200
    assert "node_modules/" in resp.json()["data"]["gitignore"]


def test_python_contains_pycache():
    resp = client.post("/gitignore/generate", json={"types": ["python"]})
    assert resp.status_code == 200
    assert "__pycache__/" in resp.json()["data"]["gitignore"]


def test_terraform_contains_tfstate():
    resp = client.post("/gitignore/generate", json={"types": ["terraform"]})
    assert resp.status_code == 200
    assert "*.tfstate" in resp.json()["data"]["gitignore"]


def test_multiple_types_merged():
    resp = client.post("/gitignore/generate", json={"types": ["node", "python"]})
    assert resp.status_code == 200
    content = resp.json()["data"]["gitignore"]
    assert "node_modules/" in content
    assert "__pycache__/" in content


def test_no_duplicate_lines_in_merged_output():
    """Merging node + react should not duplicate shared entries like dist/."""
    resp = client.post("/gitignore/generate", json={"types": ["node", "react"]})
    assert resp.status_code == 200
    content = resp.json()["data"]["gitignore"]
    lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith("#")]
    assert len(lines) == len(set(lines)), "Duplicate non-comment lines found"


def test_empty_types_returns_422():
    resp = client.post("/gitignore/generate", json={"types": []})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_unsupported_type_returns_422():
    resp = client.post("/gitignore/generate", json={"types": ["kotlin"]})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Unsupported" in resp.json()["data"]["message"]


def test_mixed_valid_invalid_returns_422():
    resp = client.post("/gitignore/generate", json={"types": ["node", "kotlin"]})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_types_included_matches_request():
    resp = client.post("/gitignore/generate", json={"types": ["go", "docker", "vscode"]})
    assert resp.status_code == 200
    assert set(resp.json()["data"]["types_included"]) == {"go", "docker", "vscode"}


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    types=st.lists(
        st.sampled_from(ALL_TYPES),
        min_size=1,
        max_size=5,
        unique=True,
    )
)
@settings(max_examples=100)
def test_no_duplicate_non_comment_lines_property(types):
    """For any combination of types, the merged output has no duplicate non-comment lines."""
    resp = client.post("/gitignore/generate", json={"types": types})
    assert resp.status_code == 200
    content = resp.json()["data"]["gitignore"]
    lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith("#")]
    assert len(lines) == len(set(lines))


@given(
    types=st.lists(
        st.sampled_from(ALL_TYPES),
        min_size=1,
        max_size=14,
        unique=True,
    )
)
@settings(max_examples=100)
def test_types_included_matches_request_property(types):
    """types_included in response always matches the requested types (lowercased)."""
    resp = client.post("/gitignore/generate", json={"types": types})
    assert resp.status_code == 200
    assert set(resp.json()["data"]["types_included"]) == set(t.lower() for t in types)
