import yaml
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models import K8sRequest

router = APIRouter(prefix="/k8s", tags=["k8s"])


def check_suggestions(manifest: dict) -> list:
    suggestions = []

    # Check for metadata.labels
    metadata = manifest.get("metadata", {}) or {}
    if not metadata.get("labels"):
        suggestions.append(
            "Consider adding labels to metadata for better resource management"
        )

    # Deployment-specific checks
    if manifest.get("kind") == "Deployment":
        spec = manifest.get("spec", {}) or {}

        # Check for spec.replicas
        if "replicas" not in spec:
            suggestions.append(
                "Consider explicitly setting spec.replicas for Deployments"
            )

        # Check for resource limits on containers
        template = spec.get("template", {}) or {}
        pod_spec = template.get("spec", {}) or {}
        containers = pod_spec.get("containers", []) or []

        has_limits = all(
            c.get("resources", {}).get("limits") for c in containers
        ) if containers else True

        if not has_limits:
            suggestions.append(
                "Consider setting resource limits and requests for containers"
            )

    return suggestions


@router.post("/validate")
async def validate_k8s_yaml(request: K8sRequest):
    try:
        manifest = yaml.safe_load(request.yaml_content)
    except yaml.YAMLError as e:
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {"valid": False, "error": str(e)},
            },
        )

    if not isinstance(manifest, dict):
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "data": {"valid": False, "error": "YAML content must be a mapping (dict)"},
            },
        )

    suggestions = check_suggestions(manifest)

    return {
        "status": "success",
        "data": {"valid": True, "suggestions": suggestions},
    }
