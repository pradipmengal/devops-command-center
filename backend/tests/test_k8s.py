import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

VALID_DEPLOYMENT_YAML = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest
          resources:
            limits:
              cpu: "500m"
              memory: "128Mi"
            requests:
              cpu: "250m"
              memory: "64Mi"
"""

YAML_MISSING_LABELS = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest
          resources:
            limits:
              cpu: "500m"
"""

YAML_MISSING_RESOURCE_LIMITS = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest
"""

YAML_MISSING_REPLICAS = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest
          resources:
            limits:
              cpu: "500m"
"""

INVALID_YAML = """
key: value
  bad_indent: oops
  another: [unclosed
"""


def test_valid_yaml_no_suggestions():
    response = client.post("/k8s/validate", json={"yaml_content": VALID_DEPLOYMENT_YAML})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["valid"] is True
    assert data["data"]["suggestions"] == []


def test_missing_labels_suggestion():
    response = client.post("/k8s/validate", json={"yaml_content": YAML_MISSING_LABELS})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["valid"] is True
    suggestions = data["data"]["suggestions"]
    assert any("labels" in s.lower() for s in suggestions)


def test_missing_resource_limits_suggestion():
    response = client.post("/k8s/validate", json={"yaml_content": YAML_MISSING_RESOURCE_LIMITS})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    suggestions = data["data"]["suggestions"]
    assert any("resource" in s.lower() for s in suggestions)


def test_missing_replicas_suggestion():
    response = client.post("/k8s/validate", json={"yaml_content": YAML_MISSING_REPLICAS})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    suggestions = data["data"]["suggestions"]
    assert any("replicas" in s.lower() for s in suggestions)


def test_invalid_yaml():
    response = client.post("/k8s/validate", json={"yaml_content": INVALID_YAML})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert data["data"]["valid"] is False
    assert "error" in data["data"]
