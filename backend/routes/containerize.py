import json
import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from services.repo_cloner import clone_repository, cleanup_clone, get_repo_tree, read_key_files
from services.stack_detector import detect_stack_from_files
from services.artifact_generator import (
    generate_dockerfile,
    generate_compose,
    generate_k8s,
    generate_helm,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/containerize", tags=["containerize"])


class ContainerizeRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    generate_k8s: bool = True
    generate_helm: bool = True


def sse_progress(phase: str, message: str, data: dict = None):
    payload = {"type": "progress", "phase": phase, "message": message}
    if data:
        payload["data"] = data
    return f"data: {json.dumps(payload)}\n\n"


def sse_artifact(artifact: str, content: str):
    payload = {"type": "artifact", "artifact": artifact, "content": content}
    return f"data: {json.dumps(payload)}\n\n"


def sse_done(stack: dict, files: dict):
    payload = {"type": "done", "stack": stack, "files": files}
    return f"data: {json.dumps(payload)}\n\n"


def sse_error(message: str):
    payload = {"type": "error", "message": message}
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/analyze")
async def containerize(request: ContainerizeRequest):
    repo_url = request.repo_url.strip()
    if not repo_url:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "Repository URL cannot be empty"}},
        )

    async def event_stream():
        clone_result = None
        try:
            yield sse_progress("cloning", f"Cloning repository from {repo_url}...")
            clone_result = await clone_repository(repo_url, request.branch)

            yield sse_progress(
                "cloning",
                f"Repository cloned: {clone_result.repo_name} (@{clone_result.branch})",
                {"repo_name": clone_result.repo_name},
            )

            yield sse_progress("detecting", "Scanning repository structure...")

            repo_tree = get_repo_tree(clone_result.path)
            key_files = read_key_files(clone_result.path)
            stack = detect_stack_from_files(key_files, repo_tree)

            yield sse_progress(
                "detecting",
                f"Detected: {', '.join(stack.languages) or 'unknown'} | "
                f"{', '.join(stack.frameworks) or 'generic'} | "
                f"port {stack.port}",
                stack.to_dict(),
            )

            files = {}

            yield sse_progress("generating", "Generating Dockerfile...")
            dockerfile = generate_dockerfile(stack, clone_result.repo_name)
            files["Dockerfile"] = dockerfile
            yield sse_artifact("Dockerfile", dockerfile)

            yield sse_progress("generating", "Generating docker-compose.yml...")
            compose = generate_compose(stack, clone_result.repo_name)
            files["docker-compose.yml"] = compose
            yield sse_artifact("docker-compose.yml", compose)

            if request.generate_k8s:
                yield sse_progress("generating", "Generating Kubernetes manifests...")
                k8s_files = generate_k8s(stack, clone_result.repo_name)
                for fname, fcontent in k8s_files.items():
                    key = f"k8s/{fname}" if "/" not in fname else f"k8s/{fname.split('/')[-1]}"
                    files[key] = fcontent
                    yield sse_artifact(key, fcontent)

            if request.generate_helm:
                yield sse_progress("generating", "Generating Helm chart...")
                helm_files = generate_helm(stack, clone_result.repo_name)
                for fname, fcontent in helm_files.items():
                    key = f"helm/{fname}" if not fname.startswith("helm/") else fname
                    files[key] = fcontent
                    yield sse_artifact(key, fcontent)

            yield sse_done(stack.to_dict(), files)

        except (ValueError, TimeoutError, RuntimeError) as e:
            yield sse_error(str(e))
        except Exception as e:
            logger.exception("Containerize failed")
            yield sse_error(str(e))
        finally:
            if clone_result:
                cleanup_clone(clone_result)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
