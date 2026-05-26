from services.stack_detector import DetectedStack


def generate_helm_chart(stack: DetectedStack, repo_name: str) -> dict:
    app_name = _sanitize_name(repo_name)
    port = stack.port

    return {
        "Chart.yaml": _chart_yaml(app_name),
        "values.yaml": _values_yaml(app_name, port, stack),
        "templates/_helpers.tpl": _helpers_tpl(app_name),
        "templates/deployment.yaml": _deployment_yaml(app_name, port, stack),
        "templates/service.yaml": _service_yaml(app_name, port),
        "templates/hpa.yaml": _hpa_yaml(app_name),
        "templates/ingress.yaml": _ingress_yaml(app_name),
        "templates/configmap.yaml": _configmap_yaml(app_name, stack),
        "templates/secret.yaml": _secret_yaml(app_name),
        "templates/serviceaccount.yaml": _serviceaccount_yaml(app_name),
    }


def _sanitize_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in name).lower().strip("-")


def _chart_yaml(app_name: str) -> str:
    return f"""apiVersion: v2
name: {app_name}
description: A Helm chart for {app_name}
type: application
version: 0.1.0
appVersion: "1.0"
kubeVersion: ">=1.21.0"
keywords:
  - {app_name}
sources:
  - https://github.com/your-org/{app_name}
maintainers:
  - name: DevOps Team
    email: devops@example.com
"""


def _values_yaml(app_name: str, port: int, stack: DetectedStack) -> str:
    env_vars = ["ENVIRONMENT: production"]
    for db in stack.databases:
        if db == "postgresql":
            env_vars.extend([
                f"DB_HOST: {app_name}-postgresql",
                "DB_PORT: '5432'",
                "DB_NAME: myapp",
                "DB_USER: myapp",
                "DB_PASSWORD: changeme",
            ])
        elif db == "redis":
            env_vars.extend([
                f"REDIS_HOST: {app_name}-redis",
                "REDIS_PORT: '6379'",
            ])
        elif db == "mongodb":
            env_vars.extend([
                f"MONGO_HOST: {app_name}-mongodb",
                "MONGO_PORT: '27017'",
                "MONGO_DB: myapp",
            ])

    env_block = "\n  ".join(f"{k}: {v}" for k, v in [e.split(": ", 1) for e in env_vars])

    return f"""# -- {app_name} values --
# This is a YAML-formatted file.
# Declare variables to be passed into your templates.

replicaCount: 2

image:
  repository: your-registry/{app_name}
  tag: latest
  pullPolicy: IfNotPresent

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  automount: true
  annotations: {{}}
  name: ""

podAnnotations: {{}}
podLabels: {{}}

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

securityContext:
  capabilities:
    drop: ["ALL"]
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1001
  allowPrivilegeEscalation: false

service:
  type: ClusterIP
  port: {port}
  targetPort: http

ingress:
  enabled: true
  className: nginx
  host: {app_name}.example.com
  tls: true
  tlsSecretName: {app_name}-tls
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

livenessProbe:
  path: /health
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  path: /ready
  initialDelaySeconds: 5
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 2

env:
{env_block}

nodeSelector: {{}}
tolerations: []
affinity: {{}}
"""


def _helpers_tpl(app_name: str) -> str:
    return f"""{{{{- define "{app_name}.name" -}}}}
{{{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}}}
{{{{- end }}}}

{{{{- define "{app_name}.fullname" -}}}}
{{{{- if .Values.fullnameOverride }}}}
{{{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}}}
{{{{- else }}}}
{{{{- $name := default .Chart.Name .Values.nameOverride }}}}
{{{{- if contains $name .Release.Name }}}}
{{{{- .Release.Name | trunc 63 | trimSuffix "-" }}}}
{{{{- else }}}}
{{{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}}}
{{{{- end }}}}
{{{{- end }}}}
{{{{- end }}}}

{{{{- define "{app_name}.labels" -}}}}
helm.sh/chart: {{{{ include "{app_name}.name" . }}}}-{{{{ .Chart.Version | replace "+" "_" }}}}
{{{{ include "{app_name}.selectorLabels" . }}}}
{{{{- if .Chart.AppVersion }}}}
app.kubernetes.io/version: {{{{ .Chart.AppVersion | quote }}}}
{{{{- end }}}}
app.kubernetes.io/managed-by: {{{{ .Release.Service }}}}
{{{{- end }}}}

{{{{- define "{app_name}.selectorLabels" -}}}}
app.kubernetes.io/name: {{{{ include "{app_name}.name" . }}}}
app.kubernetes.io/instance: {{{{ .Release.Name }}}}
{{{{- end }}}}

{{{{- define "{app_name}.serviceAccountName" -}}}}
{{{{- if .Values.serviceAccount.create }}}}
{{{{- default (include "{app_name}.fullname" .) .Values.serviceAccount.name }}}}
{{{{- else }}}}
{{{{- default "default" .Values.serviceAccount.name }}}}
{{{{- end }}}}
{{{{- end }}}}
"""


def _deployment_yaml(app_name: str, port: int, stack: DetectedStack) -> str:
    return f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{{{ include "{app_name}.fullname" . }}}}
  labels:
    {{{{- include "{app_name}.labels" . | nindent 4 }}}}
spec:
  replicas: {{{{ .Values.replicaCount }}}}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      {{{{- include "{app_name}.selectorLabels" . | nindent 6 }}}}
  template:
    metadata:
      annotations:
        checksum/config: {{{{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}}}
        checksum/secret: {{{{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}}}
        {{{{- with .Values.podAnnotations }}}}
        {{{{ toYaml . | nindent 8 }}}}
        {{{{ end }}}}
      labels:
        {{{{- include "{app_name}.labels" . | nindent 8 }}}}
        {{{{- with .Values.podLabels }}}}
        {{{{ toYaml . | nindent 8 }}}}
        {{{{ end }}}}
    spec:
      {{{{- with .Values.imagePullSecrets }}}}
      imagePullSecrets:
        {{{{ toYaml . | nindent 8 }}}}
      {{{{ end }}}}
      serviceAccountName: {{{{ include "{app_name}.serviceAccountName" . }}}}
      securityContext:
        {{{{ toYaml .Values.podSecurityContext | nindent 8 }}}}
      terminationGracePeriodSeconds: 30
      containers:
        - name: {{{{ .Chart.Name }}}}
          securityContext:
            {{{{ toYaml .Values.securityContext | nindent 12 }}}}
          image: "{{{{ .Values.image.repository }}}}:{{{{ .Values.image.tag | default .Chart.AppVersion }}}}"
          imagePullPolicy: {{{{ .Values.image.pullPolicy }}}}
          ports:
            - name: http
              containerPort: {port}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: {{{{ .Values.livenessProbe.path }}}}
              port: http
            initialDelaySeconds: {{{{ .Values.livenessProbe.initialDelaySeconds }}}}
            periodSeconds: {{{{ .Values.livenessProbe.periodSeconds }}}}
            timeoutSeconds: {{{{ .Values.livenessProbe.timeoutSeconds }}}}
            failureThreshold: {{{{ .Values.livenessProbe.failureThreshold }}}}
          readinessProbe:
            httpGet:
              path: {{{{ .Values.readinessProbe.path }}}}
              port: http
            initialDelaySeconds: {{{{ .Values.readinessProbe.initialDelaySeconds }}}}
            periodSeconds: {{{{ .Values.readinessProbe.periodSeconds }}}}
            timeoutSeconds: {{{{ .Values.readinessProbe.timeoutSeconds }}}}
            failureThreshold: {{{{ .Values.readinessProbe.failureThreshold }}}}
          resources:
            {{{{ toYaml .Values.resources | nindent 12 }}}}
          env:
            - name: APP_ENV
              value: "production"
            {{{{ range $key, $val := .Values.env }}}}
            - name: {{{{ $key }}}}
              value: {{{{ $val | quote }}}}
            {{{{ end }}}}
          envFrom:
            - configMapRef:
                name: {{{{ include "{app_name}.fullname" . }}}}
            - secretRef:
                name: {{{{ include "{app_name}.fullname" . }}}}
      {{{{- with .Values.nodeSelector }}}}
      nodeSelector:
        {{{{ toYaml . | nindent 8 }}}}
      {{{{ end }}}}
      {{{{- with .Values.affinity }}}}
      affinity:
        {{{{ toYaml . | nindent 8 }}}}
      {{{{ end }}}}
      {{{{- with .Values.tolerations }}}}
      tolerations:
        {{{{ toYaml . | nindent 8 }}}}
      {{{{ end }}}}
"""


def _service_yaml(app_name: str, port: int) -> str:
    return f"""apiVersion: v1
kind: Service
metadata:
  name: {{{{ include "{app_name}.fullname" . }}}}
  labels:
    {{{{ include "{app_name}.labels" . | nindent 4 }}}}
spec:
  type: {{{{ .Values.service.type }}}}
  ports:
    - port: {{{{ .Values.service.port }}}}
      targetPort: {{{{ .Values.service.targetPort }}}}
      protocol: TCP
      name: http
  selector:
    {{{{ include "{app_name}.selectorLabels" . | nindent 4 }}}}
"""


def _hpa_yaml(app_name: str) -> str:
    return f"""{{{{- if .Values.autoscaling.enabled }}}}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{{{ include "{app_name}.fullname" . }}}}
  labels:
    {{{{ include "{app_name}.labels" . | nindent 4 }}}}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{{{ include "{app_name}.fullname" . }}}}
  minReplicas: {{{{ .Values.autoscaling.minReplicas }}}}
  maxReplicas: {{{{ .Values.autoscaling.maxReplicas }}}}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{{{ .Values.autoscaling.targetCPUUtilizationPercentage }}}}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{{{ .Values.autoscaling.targetMemoryUtilizationPercentage }}}}
{{{{- end }}}}
"""


def _ingress_yaml(app_name: str) -> str:
    return f"""{{{{- if .Values.ingress.enabled }}}}
{{{{- $fullName := include "{app_name}.fullname" . -}}}}
{{{{- $svcPort := .Values.service.port -}}}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{{{ $fullName }}}}
  labels:
    {{{{ include "{app_name}.labels" . | nindent 4 }}}}
  annotations:
    {{{{ toYaml .Values.ingress.annotations | nindent 4 }}}}
spec:
  {{{{- if .Values.ingress.className }}}}
  ingressClassName: {{{{ .Values.ingress.className }}}}
  {{{{ end }}}}
  {{{{- if .Values.ingress.tls }}}}
  tls:
    - hosts:
        - {{{{ .Values.ingress.host }}}}
      secretName: {{{{ .Values.ingress.tlsSecretName }}}}
  {{{{ end }}}}
  rules:
    - host: {{{{ .Values.ingress.host }}}}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{{{ $fullName }}}}
                port:
                  number: {{{{ $svcPort }}}}
{{{{- end }}}}
"""


def _configmap_yaml(app_name: str, stack: DetectedStack) -> str:
    return f"""apiVersion: v1
kind: ConfigMap
metadata:
  name: {{{{ include "{app_name}.fullname" . }}}}
  labels:
    {{{{ include "{app_name}.labels" . | nindent 4 }}}}
data:
  APP_ENV: production
  APP_PORT: "{stack.port}"
  {{{{- range $key, $val := .Values.env }}}}
  {{{{ $key }}}}: {{{{ $val | quote }}}}
  {{{{ end }}}}
"""


def _secret_yaml(app_name: str) -> str:
    return f"""apiVersion: v1
kind: Secret
metadata:
  name: {{{{ include "{app_name}.fullname" . }}}}
  labels:
    {{{{ include "{app_name}.labels" . | nindent 4 }}}}
type: Opaque
data:
  {{{{- range $key, $val := .Values.env }}}}
  {{{{ $key }}}}: {{{{ $val | b64enc | quote }}}}
  {{{{ end }}}}
"""


def _serviceaccount_yaml(app_name: str) -> str:
    return f"""{{{{- if .Values.serviceAccount.create }}}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{{{ include "{app_name}.serviceAccountName" . }}}}
  labels:
    {{{{ include "{app_name}.labels" . | nindent 4 }}}}
  annotations:
    {{{{ toYaml .Values.serviceAccount.annotations | nindent 4 }}}}
automountServiceAccountToken: {{{{ .Values.serviceAccount.automount }}}}
{{{{- end }}}}
"""
