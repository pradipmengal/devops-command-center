import os
import shutil
import tempfile
import re
import asyncio
import logging

logger = logging.getLogger(__name__)

GIT_URL_PATTERN = re.compile(
    r"^(https?://[^\s/$.?#].[^\s]*)|(git@[^:]+:[^\s]+)$", re.IGNORECASE
)


class CloneResult:
    def __init__(self, path: str, repo_name: str, branch: str):
        self.path = path
        self.repo_name = repo_name
        self.branch = branch


async def clone_repository(repo_url: str, branch: str = "main") -> CloneResult:
    repo_url = repo_url.strip()
    if not GIT_URL_PATTERN.match(repo_url):
        raise ValueError(f"Invalid git URL: {repo_url}")

    repo_name = repo_url.rstrip("/").split("/")[-1]
    if repo_name.endswith(".git"):
        repo_name = repo_name[:-4]

    tmp_dir = tempfile.mkdtemp(prefix="containerize_")
    dest = os.path.join(tmp_dir, repo_name)

    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--depth", "1", "--branch", branch,
            repo_url, dest,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise TimeoutError(f"Git clone timed out after 60s for {repo_url}")

        if proc.returncode != 0:
            err_msg = stderr.decode().strip() or f"git clone exited with code {proc.returncode}"
            if "not found" in err_msg.lower() or "repository" in err_msg.lower():
                raise ValueError(f"Repository not found: {repo_url}")
            if "branch" in err_msg.lower() and "not found" in err_msg.lower():
                raise ValueError(f"Branch '{branch}' not found in {repo_url}")
            raise RuntimeError(f"Git clone failed: {err_msg}")

        logger.info(f"Cloned {repo_url} (branch={branch}) to {dest}")
        return CloneResult(path=dest, repo_name=repo_name, branch=branch)

    except (ValueError, TimeoutError, RuntimeError):
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise


def cleanup_clone(clone_result: CloneResult):
    parent = os.path.dirname(clone_result.path)
    if parent and os.path.exists(parent):
        shutil.rmtree(parent, ignore_errors=True)
        logger.info(f"Cleaned up {parent}")


def get_repo_tree(repo_path: str, max_depth: int = 3) -> list:
    tree = []
    base_depth = repo_path.rstrip(os.sep).count(os.sep)
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules"]
        depth = root.count(os.sep) - base_depth
        if depth > max_depth:
            dirs.clear()
            continue
        rel_root = os.path.relpath(root, repo_path)
        if rel_root == ".":
            rel_root = ""
        for f in files:
            rel_path = os.path.join(rel_root, f) if rel_root else f
            try:
                size = os.path.getsize(os.path.join(root, f))
            except OSError:
                size = 0
            tree.append({"path": rel_path, "size": size})
    return sorted(tree, key=lambda x: x["path"])


def read_key_files(repo_path: str, max_size: int = 100_000) -> dict:
    patterns = [
        "package.json", "requirements.txt", "Pipfile", "pyproject.toml",
        "pom.xml", "build.gradle", "go.mod", "Cargo.toml", "Gemfile",
        "composer.json", "*.csproj", "*.sln", "Dockerfile", "docker-compose.yml",
        ".env.example", "Makefile", "Dockerfile.*", "index.html",
        "vite.config.js", "vite.config.ts", "next.config.js", "webpack.config.js",
        "tsconfig.json", "angular.json", "vue.config.js",
    ]
    import fnmatch
    found = {}
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules"]
        for f in files:
            for pat in patterns:
                if fnmatch.fnmatch(f, pat):
                    fp = os.path.join(root, f)
                    try:
                        if os.path.getsize(fp) <= max_size:
                            rel = os.path.relpath(fp, repo_path)
                            with open(fp, "r", errors="replace") as fh:
                                found[rel] = fh.read()
                    except OSError:
                        pass
    return found
