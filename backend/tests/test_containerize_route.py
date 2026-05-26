import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)





def _make_fake_clone_result(path="/tmp/fake_repo", repo_name="test-app", branch="main"):
    class FakeCloneResult:
        def __init__(self):
            self.path = path
            self.repo_name = repo_name
            self.branch = branch
    return FakeCloneResult()


def _collect_sse_frames(response):
    frames = []
    for line in response.iter_lines():
        line = line.strip()
        if line.startswith("data: "):
            payload = line[6:]
            if payload:
                frames.append(json.loads(payload))
    return frames


class TestContainerizeRoute:
    @patch("routes.containerize.clone_repository")
    @patch("routes.containerize.get_repo_tree")
    @patch("routes.containerize.read_key_files")
    def test_full_success_flow(
        self,
        mock_read_key_files,
        mock_get_repo_tree,
        mock_clone_repo,
    ):
        mock_clone_repo.return_value = _make_fake_clone_result()
        mock_get_repo_tree.return_value = [
            {"path": "requirements.txt", "size": 20},
            {"path": "main.py", "size": 100},
        ]
        mock_read_key_files.return_value = {
            "requirements.txt": "fastapi\nuvicorn\n",
            "main.py": "from fastapi import FastAPI\n",
        }

        response = client.post(
            "/containerize/analyze",
            json={
                "repo_url": "https://github.com/user/test-app",
                "branch": "main",
                "generate_k8s": True,
                "generate_helm": True,
            },
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        frames = _collect_sse_frames(response)

        progress_frames = [f for f in frames if f.get("type") == "progress"]
        artifact_frames = [f for f in frames if f.get("type") == "artifact"]
        done_frames = [f for f in frames if f.get("type") == "done"]
        error_frames = [f for f in frames if f.get("type") == "error"]

        assert len(progress_frames) >= 4, f"Expected >=4 progress frames, got {len(progress_frames)}"
        assert len(error_frames) == 0, f"Unexpected error frames: {error_frames}"
        assert len(done_frames) == 1, f"Expected 1 done frame, got {len(done_frames)}"

        done = done_frames[0]
        assert "stack" in done
        assert "files" in done
        files = done["files"]
        assert "Dockerfile" in files
        assert "docker-compose.yml" in files
        assert any(k.startswith("k8s/") for k in files), f"No k8s/ files in {list(files.keys())}"
        assert any(k.startswith("helm/") for k in files), f"No helm/ files in {list(files.keys())}"

        # Also check artifact frames were emitted
        artifact_names = {a["artifact"] for a in artifact_frames}
        assert "Dockerfile" in artifact_names
        assert "docker-compose.yml" in artifact_names

    @patch("routes.containerize.clone_repository")
    @patch("routes.containerize.get_repo_tree")
    @patch("routes.containerize.read_key_files")
    def test_generates_all_four_artifact_types(
        self,
        mock_read_key_files,
        mock_get_repo_tree,
        mock_clone_repo,
    ):
        mock_clone_repo.return_value = _make_fake_clone_result()
        mock_get_repo_tree.return_value = [{"path": "package.json", "size": 30}]
        mock_read_key_files.return_value = {
            "package.json": '{"dependencies": {"express": "^4.0"}}',
        }

        response = client.post(
            "/containerize/analyze",
            json={
                "repo_url": "https://github.com/user/test-app",
                "generate_k8s": True,
                "generate_helm": True,
            },
        )

        assert response.status_code == 200
        frames = _collect_sse_frames(response)
        done_frames = [f for f in frames if f.get("type") == "done"]
        assert len(done_frames) == 1

        files = done_frames[0]["files"]
        assert "Dockerfile" in files
        assert "docker-compose.yml" in files
        assert any(k.startswith("k8s/") for k in files), f"No k8s/ files in {list(files.keys())}"
        assert any(k.startswith("helm/") for k in files), f"No helm/ files in {list(files.keys())}"

    def test_empty_repo_url_returns_422(self):
        response = client.post(
            "/containerize/analyze",
            json={"repo_url": ""},
        )
        assert response.status_code == 422

    def test_missing_repo_url_returns_422(self):
        response = client.post(
            "/containerize/analyze",
            json={},
        )
        assert response.status_code == 422

    @patch("routes.containerize.clone_repository")
    def test_clone_failure_returns_error_frame(self, mock_clone_repo):
        mock_clone_repo.side_effect = ValueError("Repository not found: https://github.com/bad/repo")

        response = client.post(
            "/containerize/analyze",
            json={
                "repo_url": "https://github.com/bad/repo",
            },
        )

        assert response.status_code == 200
        frames = _collect_sse_frames(response)
        error_frames = [f for f in frames if f.get("type") == "error"]
        assert len(error_frames) == 1
        assert "Repository not found" in error_frames[0]["message"]
