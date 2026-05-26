import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.helm_generator import generate_helm_chart
from services.stack_detector import DetectedStack


class TestGenerateHelmChart:
    def test_returns_all_expected_files(self):
        stack = DetectedStack(languages=["python"], frameworks=["fastapi"], port=8000)
        chart = generate_helm_chart(stack, "myapp")

        expected = [
            "Chart.yaml", "values.yaml",
            "templates/_helpers.tpl", "templates/deployment.yaml",
            "templates/service.yaml", "templates/hpa.yaml",
            "templates/ingress.yaml", "templates/configmap.yaml",
            "templates/secret.yaml", "templates/serviceaccount.yaml",
        ]
        for f in expected:
            assert f in chart, f"Missing {f}"

    def test_chart_yaml_has_correct_name(self):
        stack = DetectedStack(languages=["go"], port=8080)
        chart = generate_helm_chart(stack, "my-api")
        assert "name: my-api" in chart["Chart.yaml"]
        assert "description: A Helm chart for my-api" in chart["Chart.yaml"]

    def test_values_yaml_has_correct_port(self):
        stack = DetectedStack(languages=["python"], port=5000)
        chart = generate_helm_chart(stack, "flask-app")
        assert "port: 5000" in chart["values.yaml"]

    def test_deployment_yaml_has_container_port(self):
        stack = DetectedStack(languages=["python"], port=8080)
        chart = generate_helm_chart(stack, "app")
        dep = chart["templates/deployment.yaml"]
        assert "containerPort: 8080" in dep
        assert "RollingUpdate" in dep
        assert "livenessProbe" in dep
        assert "readinessProbe" in dep

    def test_helpers_tpl_has_define_blocks(self):
        stack = DetectedStack(languages=["nodejs"])
        chart = generate_helm_chart(stack, "node-app")
        helpers = chart["templates/_helpers.tpl"]
        assert "define" in helpers
        assert "selectorLabels" in helpers
        assert "serviceAccountName" in helpers

    def test_service_yaml_has_port_ref(self):
        stack = DetectedStack(languages=["python"], port=3000)
        chart = generate_helm_chart(stack, "app")
        svc = chart["templates/service.yaml"]
        assert ".Values.service.port" in svc
        assert ".Values.service.type" in svc

    def test_hpa_yaml_has_autoscaling(self):
        stack = DetectedStack(languages=["java"])
        chart = generate_helm_chart(stack, "java-app")
        hpa = chart["templates/hpa.yaml"]
        assert "autoscaling/v2" in hpa
        assert "HorizontalPodAutoscaler" in hpa

    def test_ingress_yaml_has_host(self):
        stack = DetectedStack(languages=["python"])
        chart = generate_helm_chart(stack, "web-app")
        ingress = chart["templates/ingress.yaml"]
        assert "ingress.enabled" in ingress
        assert "host" in ingress

    def test_values_yaml_includes_env_from_databases(self):
        stack = DetectedStack(
            languages=["python"],
            databases=["postgresql", "redis"],
        )
        chart = generate_helm_chart(stack, "app")
        vals = chart["values.yaml"]
        assert "DB_HOST" in vals
        assert "REDIS_HOST" in vals
        assert "DB_PASSWORD: changeme" in vals

    def test_sanitizes_name(self):
        stack = DetectedStack(languages=["python"])
        chart = generate_helm_chart(stack, "My App (prod)")
        assert "name: my-app--prod-" not in chart["Chart.yaml"]
        assert "name:" in chart["Chart.yaml"]

    def test_secret_yaml_has_b64enc(self):
        stack = DetectedStack(languages=["python"])
        chart = generate_helm_chart(stack, "app")
        secret = chart["templates/secret.yaml"]
        assert "b64enc" in secret
        assert "Opaque" in secret

    def test_serviceaccount_yaml(self):
        stack = DetectedStack(languages=["python"])
        chart = generate_helm_chart(stack, "app")
        sa = chart["templates/serviceaccount.yaml"]
        assert "ServiceAccount" in sa
        assert "serviceAccount.create" in sa
