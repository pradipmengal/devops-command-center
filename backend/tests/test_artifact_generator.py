import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.artifact_generator import (
    generate_dockerfile,
    generate_compose,
    generate_k8s,
    generate_helm,
)
from services.stack_detector import DetectedStack


class TestGenerateDockerfile:
    def test_python_stack_returns_python_dockerfile(self):
        stack = DetectedStack(languages=["python"])
        df = generate_dockerfile(stack, "myapp")
        assert "python" in df.lower() or "FROM python" in df

    def test_nodejs_stack_returns_node_dockerfile(self):
        stack = DetectedStack(languages=["javascript"])
        df = generate_dockerfile(stack, "myapp")
        assert "node" in df.lower()

    def test_go_stack_returns_go_dockerfile(self):
        stack = DetectedStack(languages=["go"])
        df = generate_dockerfile(stack, "myapp")
        assert "golang" in df.lower() or "go" in df.lower()

    def test_unknown_stack_returns_fallback(self):
        stack = DetectedStack(languages=["unknown"])
        df = generate_dockerfile(stack, "app")
        assert df is not None and len(df) > 0


class TestGenerateCompose:
    def test_basic_app_service(self):
        stack = DetectedStack(languages=["python"], port=8000)
        compose = generate_compose(stack, "myapp")
        assert "8000:8000" in compose
        assert "build: ." in compose

    def test_includes_postgres(self):
        stack = DetectedStack(languages=["python"], databases=["postgresql"])
        compose = generate_compose(stack, "app")
        assert "postgres" in compose
        assert "POSTGRES_USER" in compose

    def test_includes_redis(self):
        stack = DetectedStack(languages=["python"], databases=["redis"])
        compose = generate_compose(stack, "app")
        assert "redis" in compose
        assert "redis-cli" in compose

    def test_includes_mongodb(self):
        stack = DetectedStack(languages=["python"], databases=["mongodb"])
        compose = generate_compose(stack, "app")
        assert "mongo" in compose
        assert "MONGO_INITDB_DATABASE" in compose

    def test_multiple_databases(self):
        stack = DetectedStack(languages=["python"], databases=["postgresql", "redis"])
        compose = generate_compose(stack, "app")
        assert "postgres" in compose
        assert "redis" in compose


class TestGenerateK8s:
    def test_returns_dict(self):
        stack = DetectedStack(languages=["python"], port=8000)
        result = generate_k8s(stack, "myapp")
        assert isinstance(result, dict)
        assert "deployment.yaml" in result
        assert "service.yaml" in result

    def test_has_deployment(self):
        stack = DetectedStack(languages=["go"], port=8080)
        result = generate_k8s(stack, "go-app")
        assert "containerPort: 8080" in result["deployment.yaml"]


class TestGenerateHelm:
    def test_returns_dict(self):
        stack = DetectedStack(languages=["python"], port=8000)
        result = generate_helm(stack, "myapp")
        assert isinstance(result, dict)
        assert "Chart.yaml" in result
        assert "values.yaml" in result

    def test_chart_has_name(self):
        stack = DetectedStack(languages=["nodejs"])
        result = generate_helm(stack, "node-app")
        assert "name: node-app" in result["Chart.yaml"]
