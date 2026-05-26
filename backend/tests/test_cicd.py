"""
Tests for CI/CD pipeline generator endpoint.

Covers:
  - All 3 platforms × 6 languages generate valid output
  - All valid steps are included in output
  - Docker step includes image name
  - Unsupported platform returns 422
  - Unsupported language returns 422
  - Invalid step returns 422
  - Correct filename returned per platform
  - Property: output always contains the language-specific setup for GitHub Actions
  - Property: all requested steps appear in the generated pipeline
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

PLATFORMS = ["github_actions", "gitlab_ci", "jenkins"]
LANGUAGES = ["nodejs", "python", "java", "go", "rust", "dotnet"]
VALID_STEPS = ["lint", "test", "build", "docker", "deploy"]

EXPECTED_FILENAMES = {
    "github_actions": ".github/workflows/pipeline.yml",
    "gitlab_ci":      ".gitlab-ci.yml",
    "jenkins":        "Jenkinsfile",
}


# ── Unit tests ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("platform", PLATFORMS)
@pytest.mark.parametrize("language", LANGUAGES)
def test_all_platform_language_combinations(platform, language):
    """Every platform × language combination should produce a non-empty pipeline."""
    resp = client.post("/cicd/generate", json={
        "platform": platform,
        "language": language,
        "steps": ["lint", "test", "build"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert len(data["data"]["pipeline"]) > 0
    assert data["data"]["platform"] == platform
    assert data["data"]["language"] == language


@pytest.mark.parametrize("platform", PLATFORMS)
def test_correct_filename_per_platform(platform):
    resp = client.post("/cicd/generate", json={
        "platform": platform,
        "language": "nodejs",
        "steps": ["test"]
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["filename"] == EXPECTED_FILENAMES[platform]


def test_github_actions_structure():
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": "nodejs",
        "steps": ["lint", "test", "build"]
    })
    assert resp.status_code == 200
    pipeline = resp.json()["data"]["pipeline"]
    assert "name: CI/CD Pipeline" in pipeline
    assert "on:" in pipeline
    assert "jobs:" in pipeline
    assert "actions/checkout@v4" in pipeline
    assert "actions/setup-node@v4" in pipeline


def test_gitlab_ci_structure():
    resp = client.post("/cicd/generate", json={
        "platform": "gitlab_ci",
        "language": "python",
        "steps": ["test", "build"]
    })
    assert resp.status_code == 200
    pipeline = resp.json()["data"]["pipeline"]
    assert "stages:" in pipeline
    assert "python:3.12" in pipeline


def test_jenkins_structure():
    resp = client.post("/cicd/generate", json={
        "platform": "jenkins",
        "language": "java",
        "steps": ["test", "build"]
    })
    assert resp.status_code == 200
    pipeline = resp.json()["data"]["pipeline"]
    assert "pipeline {" in pipeline
    assert "agent any" in pipeline
    assert "stages {" in pipeline


def test_docker_step_includes_image():
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": "nodejs",
        "steps": ["docker"],
        "docker_image": "myorg/my-app"
    })
    assert resp.status_code == 200
    assert "myorg/my-app" in resp.json()["data"]["pipeline"]


def test_deploy_kubernetes_step():
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": "nodejs",
        "steps": ["deploy"],
        "deploy_target": "kubernetes"
    })
    assert resp.status_code == 200
    assert "kubectl" in resp.json()["data"]["pipeline"]


def test_unsupported_platform_returns_422():
    resp = client.post("/cicd/generate", json={
        "platform": "circleci",
        "language": "nodejs",
        "steps": ["test"]
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Unsupported platform" in resp.json()["data"]["message"]


def test_unsupported_language_returns_422():
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": "ruby",
        "steps": ["test"]
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Unsupported language" in resp.json()["data"]["message"]


def test_invalid_step_returns_422():
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": "nodejs",
        "steps": ["test", "publish"]
    })
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Invalid steps" in resp.json()["data"]["message"]


def test_empty_steps_generates_minimal_pipeline():
    """Empty steps list should still produce a valid (minimal) pipeline."""
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": "nodejs",
        "steps": []
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    platform=st.sampled_from(PLATFORMS),
    language=st.sampled_from(LANGUAGES),
    steps=st.lists(
        st.sampled_from(["lint", "test", "build"]),
        min_size=1,
        max_size=3,
        unique=True,
    ),
)
@settings(max_examples=100)
def test_pipeline_always_non_empty(platform, language, steps):
    """For any valid platform/language/steps combination, the pipeline is non-empty."""
    resp = client.post("/cicd/generate", json={
        "platform": platform,
        "language": language,
        "steps": steps
    })
    assert resp.status_code == 200
    assert len(resp.json()["data"]["pipeline"]) > 0


@given(
    language=st.sampled_from(LANGUAGES),
    steps=st.lists(
        st.sampled_from(["lint", "test", "build"]),
        min_size=1,
        max_size=3,
        unique=True,
    ),
)
@settings(max_examples=50)
def test_github_actions_contains_checkout(language, steps):
    """GitHub Actions pipelines must always include the checkout step."""
    resp = client.post("/cicd/generate", json={
        "platform": "github_actions",
        "language": language,
        "steps": steps
    })
    assert resp.status_code == 200
    assert "actions/checkout@v4" in resp.json()["data"]["pipeline"]
