import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.k8s_generator import generate_k8s_manifests
from services.stack_detector import DetectedStack


class TestGenerateK8sManifests:
    def test_returns_all_expected_files(self):
        stack = DetectedStack(languages=["python"], frameworks=["fastapi"], port=8000)
        manifests = generate_k8s_manifests(stack, "myapp")

        expected = [
            "deployment.yaml", "service.yaml", "configmap.yaml",
            "secret.yaml", "ingress.yaml", "hpa.yaml",
        ]
        for f in expected:
            assert f in manifests, f"Missing {f}"

    def test_deployment_yaml_has_app_name(self):
        stack = DetectedStack(languages=["go"], port=8080)
        manifests = generate_k8s_manifests(stack, "my-api")
        dep = manifests["deployment.yaml"]
        assert "name: my-api" in dep
        assert "app: my-api" in dep

    def test_deployment_yaml_has_container_port(self):
        stack = DetectedStack(languages=["python"], port=5000)
        manifests = generate_k8s_manifests(stack, "flask-app")
        dep = manifests["deployment.yaml"]
        assert "containerPort: 5000" in dep
        assert "RollingUpdate" in dep
        assert "livenessProbe" in dep
        assert "readinessProbe" in dep

    def test_deployment_yaml_has_security_context(self):
        stack = DetectedStack(languages=["nodejs"], port=3000)
        manifests = generate_k8s_manifests(stack, "node-app")
        dep = manifests["deployment.yaml"]
        assert "runAsNonRoot: true" in dep
        assert "readOnlyRootFilesystem: true" in dep
        assert "allowPrivilegeEscalation: false" in dep

    def test_deployment_yaml_has_resource_limits(self):
        stack = DetectedStack(languages=["java"], port=8080)
        manifests = generate_k8s_manifests(stack, "java-app")
        dep = manifests["deployment.yaml"]
        assert "limits:" in dep
        assert "requests:" in dep
        assert "cpu: 500m" in dep
        assert "memory: 512Mi" in dep

    def test_deployment_yaml_has_env_from(self):
        stack = DetectedStack(languages=["python"], port=8000)
        manifests = generate_k8s_manifests(stack, "myapp")
        dep = manifests["deployment.yaml"]
        assert "configMapRef" in dep
        assert "secretRef" in dep

    def test_service_yaml_has_correct_port(self):
        stack = DetectedStack(languages=["python"], port=3000)
        manifests = generate_k8s_manifests(stack, "web-app")
        svc = manifests["service.yaml"]
        assert "port: 3000" in svc
        assert "ClusterIP" in svc
        assert "targetPort: http" in svc

    def test_configmap_yaml_has_port(self):
        stack = DetectedStack(languages=["python"], port=8000)
        manifests = generate_k8s_manifests(stack, "app")
        cm = manifests["configmap.yaml"]
        assert "APP_PORT: \"8000\"" in cm
        assert "APP_ENV: production" in cm

    def test_configmap_yaml_includes_databases(self):
        stack = DetectedStack(
            languages=["python"],
            databases=["postgresql", "redis", "mongodb"],
        )
        manifests = generate_k8s_manifests(stack, "app")
        cm = manifests["configmap.yaml"]
        assert "DB_HOST" in cm
        assert "REDIS_HOST" in cm
        assert "MONGO_HOST" in cm
        assert "DB_PORT" in cm

    def test_secret_yaml_has_base64_values(self):
        stack = DetectedStack(languages=["python"])
        manifests = generate_k8s_manifests(stack, "secret-app")
        secret = manifests["secret.yaml"]
        assert "Opaque" in secret
        assert "Y2hhbmdlbWU=" in secret
        assert "stringData" in secret

    def test_ingress_yaml_has_host(self):
        stack = DetectedStack(languages=["python"])
        manifests = generate_k8s_manifests(stack, "web-app")
        ingress = manifests["ingress.yaml"]
        assert "web-app.example.com" in ingress
        assert "nginx" in ingress
        assert "TLS" in ingress or "tls" in ingress

    def test_hpa_yaml_has_metrics(self):
        stack = DetectedStack(languages=["java"])
        manifests = generate_k8s_manifests(stack, "java-app")
        hpa = manifests["hpa.yaml"]
        assert "autoscaling/v2" in hpa
        assert "HorizontalPodAutoscaler" in hpa
        assert "averageUtilization: 70" in hpa
        assert "minReplicas: 2" in hpa
        assert "maxReplicas: 10" in hpa

    def test_sanitizes_name(self):
        stack = DetectedStack(languages=["python"])
        manifests = generate_k8s_manifests(stack, "My App (prod)")
        dep = manifests["deployment.yaml"]
        assert "my-app--prod-" not in dep
        assert "app:" in dep
