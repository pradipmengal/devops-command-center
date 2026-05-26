import yaml

from services.stack_detector import DetectedStack
from services.k8s_generator import generate_k8s_manifests
from services.helm_generator import generate_helm_chart


def generate_dockerfile(stack: DetectedStack, repo_name: str) -> str:
    from routes.docker import DOCKERFILES
    lang_map = {
        "nodejs": "nodejs", "javascript": "nodejs",
        "python": "python", "django": "django", "fastapi": "fastapi",
        "go": "go", "rust": "rust", "java": "java",
        "ruby": "rails", "php": "php",
        "react": "react", "nextjs": "nextjs", "vue": "vue", "angular": "angular",
        "dotnet": "dotnet", "csharp": "dotnet",
    }
    for lang in stack.languages:
        key = lang_map.get(lang)
        if key and key in DOCKERFILES:
            return DOCKERFILES[key]
    for fw in stack.frameworks:
        key = lang_map.get(fw)
        if key and key in DOCKERFILES:
            return DOCKERFILES[key]
    return DOCKERFILES.get("python", "# Dockerfile not available")


def generate_compose(stack: DetectedStack, repo_name: str) -> str:
    port = stack.port
    services = {"app": {"build": ".", f'ports': [f'{port}:{port}']}}

    if "postgresql" in stack.databases:
        services["db"] = {
            "image": "postgres:16-alpine",
            "environment": [
                "POSTGRES_USER=myapp",
                "POSTGRES_PASSWORD=changeme",
                "POSTGRES_DB=myapp",
            ],
            "volumes": ["pgdata:/var/lib/postgresql/data"],
            "healthcheck": {"test": ["CMD", "pg_isready"], "interval": "10s"},
        }
    if "redis" in stack.databases:
        services["redis"] = {
            "image": "redis:7.2-alpine",
            "healthcheck": {"test": ["CMD", "redis-cli", "ping"], "interval": "10s"},
        }
    if "mongodb" in stack.databases:
        services["mongo"] = {
            "image": "mongo:7-jammy",
            "environment": ["MONGO_INITDB_DATABASE=myapp"],
            "volumes": ["mongodata:/data/db"],
        }

    compose = {
        "version": "3.8",
        "services": services,
        "volumes": {name: {} for name in ["pgdata", "mongodata"] if name in str(services)},
    }
    return yaml.dump(compose, default_flow_style=False, sort_keys=False)


def generate_k8s(stack: DetectedStack, repo_name: str) -> dict:
    return generate_k8s_manifests(stack, repo_name)


def generate_helm(stack: DetectedStack, repo_name: str) -> dict:
    return generate_helm_chart(stack, repo_name)
