from services.stack_detector import DetectedStack


def generate_k8s_manifests(stack: DetectedStack, repo_name: str) -> dict:
    app_name = _sanitize_name(repo_name)
    port = stack.port

    return {
        "deployment.yaml": _deployment_yaml(app_name, port),
        "service.yaml": _service_yaml(app_name, port),
        "configmap.yaml": _configmap_yaml(app_name, stack),
        "secret.yaml": _secret_yaml(app_name),
        "ingress.yaml": _ingress_yaml(app_name),
        "hpa.yaml": _hpa_yaml(app_name),
    }


def _sanitize_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in name).lower().strip("-")


def _deployment_yaml(app_name: str, port: int) -> str:
    return f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {app_name}
  labels:
    app: {app_name}
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: {app_name}
  template:
    metadata:
      labels:
        app: {app_name}
    spec:
      serviceAccountName: {app_name}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      terminationGracePeriodSeconds: 30
      containers:
        - name: {app_name}
          securityContext:
            capabilities:
              drop: ["ALL"]
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1001
            allowPrivilegeEscalation: false
          image: your-registry/{app_name}:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: {port}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 2
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
          envFrom:
            - configMapRef:
                name: {app_name}
            - secretRef:
                name: {app_name}
"""


def _service_yaml(app_name: str, port: int) -> str:
    return f"""apiVersion: v1
kind: Service
metadata:
  name: {app_name}
  labels:
    app: {app_name}
spec:
  type: ClusterIP
  ports:
    - port: {port}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: {app_name}
"""


def _configmap_yaml(app_name: str, stack: DetectedStack) -> str:
    data_lines = [f"  APP_ENV: production", f"  APP_PORT: \"{stack.port}\""]

    for db in stack.databases:
        if db == "postgresql":
            data_lines.extend([
                f"  DB_HOST: {app_name}-postgresql",
                "  DB_PORT: \"5432\"",
                "  DB_NAME: myapp",
            ])
        elif db == "redis":
            data_lines.extend([
                f"  REDIS_HOST: {app_name}-redis",
                "  REDIS_PORT: \"6379\"",
            ])
        elif db == "mongodb":
            data_lines.extend([
                f"  MONGO_HOST: {app_name}-mongodb",
                "  MONGO_PORT: \"27017\"",
                "  MONGO_DB: myapp",
            ])

    data_block = "\n".join(data_lines)

    return f"""apiVersion: v1
kind: ConfigMap
metadata:
  name: {app_name}
  labels:
    app: {app_name}
data:
{data_block}
"""


def _secret_yaml(app_name: str) -> str:
    return f"""apiVersion: v1
kind: Secret
metadata:
  name: {app_name}
  labels:
    app: {app_name}
type: Opaque
data:
  DB_PASSWORD: Y2hhbmdlbWU=
  SECRET_KEY: cGxhY2Vob2xkZXItc2VjcmV0LWtleQ==
stringData:
  APP_ENV: production
"""


def _ingress_yaml(app_name: str) -> str:
    return f"""apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {app_name}
  labels:
    app: {app_name}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - {app_name}.example.com
      secretName: {app_name}-tls
  rules:
    - host: {app_name}.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {app_name}
                port:
                  number: 80
"""


def _hpa_yaml(app_name: str) -> str:
    return f"""apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {app_name}
  labels:
    app: {app_name}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {app_name}
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
"""
