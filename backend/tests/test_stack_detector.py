import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.stack_detector import (
    detect_stack_from_files,
    DetectedStack,
    build_stack_summary_for_ai,
)


class TestDetectStackFromFiles:
    def test_detects_nodejs_express(self):
        key_files = {
            "package.json": '{"name": "app", "dependencies": {"express": "^4.0"}}',
        }
        tree = [{"path": "package.json", "size": 50}]
        stack = detect_stack_from_files(key_files, tree)
        assert "javascript" in stack.languages
        assert "express" in stack.frameworks
        assert stack.port == 3000
        assert stack.package_manager == "npm"

    def test_detects_react_app(self):
        key_files = {
            "package.json": '{"dependencies": {"react": "^18.0"}}',
        }
        tree = [{"path": "package.json", "size": 30}]
        stack = detect_stack_from_files(key_files, tree)
        assert "react" in stack.frameworks

    def test_detects_nextjs(self):
        key_files = {
            "package.json": '{"dependencies": {"next": "^14.0", "react": "^18.0"}}',
        }
        tree = [{"path": "package.json", "size": 30}]
        stack = detect_stack_from_files(key_files, tree)
        assert "nextjs" in stack.frameworks

    def test_detects_fastapi(self):
        key_files = {
            "requirements.txt": "fastapi\nuvicorn\npsycopg2-binary\n",
        }
        tree = []
        stack = detect_stack_from_files(key_files, tree)
        assert "python" in stack.languages
        assert "fastapi" in stack.frameworks
        assert stack.port == 8000
        assert "postgresql" in stack.databases

    def test_detects_django(self):
        key_files = {
            "requirements.txt": "django\ngunicorn\n",
        }
        tree = [{"path": "manage.py", "size": 100}]
        stack = detect_stack_from_files(key_files, tree)
        assert "python" in stack.languages
        assert "django" in stack.frameworks
        assert stack.port == 8000

    def test_detects_go(self):
        key_files = {
            "go.mod": "module github.com/user/app\ngo 1.22\n",
        }
        tree = [{"path": "go.mod", "size": 30}]
        stack = detect_stack_from_files(key_files, tree)
        assert "go" in stack.languages
        assert stack.port == 8080

    def test_detects_rust(self):
        key_files = {
            "Cargo.toml": "[package]\nname = \"app\"\n",
        }
        tree = [{"path": "Cargo.toml", "size": 20}]
        stack = detect_stack_from_files(key_files, tree)
        assert "rust" in stack.languages

    def test_detects_python_ml(self):
        key_files = {
            "requirements.txt": "tensorflow\npandas\nscikit-learn\n",
        }
        tree = []
        stack = detect_stack_from_files(key_files, tree)
        assert "ml" in stack.frameworks

    def test_detects_dockerfile_presence(self):
        key_files = {"Dockerfile": "FROM python:3.12"}
        tree = [{"path": "Dockerfile", "size": 20}]
        stack = detect_stack_from_files(key_files, tree)
        assert stack.has_dockerfile is True

    def test_detects_compose_presence(self):
        key_files = {"docker-compose.yml": "version: '3.8'"}
        tree = [{"path": "docker-compose.yml", "size": 20}]
        stack = detect_stack_from_files(key_files, tree)
        assert stack.has_compose is True

    def test_detects_yarn_lock(self):
        key_files = {
            "package.json": '{"dependencies": {"react": "^18.0"}}',
            "yarn.lock": "",
        }
        tree = []
        stack = detect_stack_from_files(key_files, tree)
        assert stack.package_manager == "yarn"

    def test_detects_multiple_databases(self):
        key_files = {
            "requirements.txt": "fastapi\npsycopg2\nredis\npymongo\n",
        }
        tree = []
        stack = detect_stack_from_files(key_files, tree)
        assert "postgresql" in stack.databases
        assert "redis" in stack.databases
        assert "mongodb" in stack.databases

    def test_unknown_stack_returns_empty_languages(self):
        key_files = {"readme.md": "# Hello"}
        tree = [{"path": "readme.md", "size": 10}]
        stack = detect_stack_from_files(key_files, tree)
        assert stack.languages == []
        assert stack.frameworks == []

    def test_parse_dockerfile_base(self):
        key_files = {"Dockerfile": "FROM node:20-alpine\nWORKDIR /app\n"}
        tree = []
        stack = detect_stack_from_files(key_files, tree)
        assert "node:20-alpine" in stack.docker_base_image


class TestBuildStackSummaryForAI:
    def test_returns_json_string(self):
        stack = DetectedStack(languages=["python", "javascript"], frameworks=["fastapi"])
        summary = build_stack_summary_for_ai(stack)
        assert '"languages"' in summary
        assert '"fastapi"' in summary
        assert summary.strip().startswith("{")
