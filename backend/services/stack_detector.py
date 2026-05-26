import json
import logging

logger = logging.getLogger(__name__)


class DetectedStack:
    def __init__(
        self,
        languages=None, frameworks=None, databases=None,
        build_tool=None, port=8080, entrypoint=None,
        has_dockerfile=False, has_compose=False, has_k8s=False,
        has_helm=False, env_files=None, detected_files=None,
        package_manager=None, docker_base_image=None,
    ):
        self.languages = languages or []
        self.frameworks = frameworks or []
        self.databases = databases or []
        self.build_tool = build_tool
        self.port = port
        self.entrypoint = entrypoint
        self.has_dockerfile = has_dockerfile
        self.has_compose = has_compose
        self.has_k8s = has_k8s
        self.has_helm = has_helm
        self.env_files = env_files or []
        self.detected_files = detected_files or []
        self.package_manager = package_manager
        self.docker_base_image = docker_base_image

    def to_dict(self):
        return {
            "languages": self.languages,
            "frameworks": self.frameworks,
            "databases": self.databases,
            "build_tool": self.build_tool,
            "port": self.port,
            "entrypoint": self.entrypoint,
            "has_dockerfile": self.has_dockerfile,
            "has_compose": self.has_compose,
            "has_k8s": self.has_k8s,
            "has_helm": self.has_helm,
            "env_files": self.env_files,
            "detected_files": self.detected_files,
            "package_manager": self.package_manager,
            "docker_base_image": self.docker_base_image,
        }

    @classmethod
    def from_dict(cls, d):
        return cls(**{k: v for k, v in d.items() if k in [
            "languages", "frameworks", "databases", "build_tool", "port",
            "entrypoint", "has_dockerfile", "has_compose", "has_k8s",
            "has_helm", "env_files", "detected_files", "package_manager",
            "docker_base_image",
        ]})

    def __repr__(self):
        return f"DetectedStack(lang={self.languages}, frameworks={self.frameworks})"


def detect_stack_from_files(key_files: dict, repo_tree: list) -> DetectedStack:
    stack = DetectedStack()
    stack.detected_files = list(key_files.keys())

    file_names = {f.lower() for f in key_files}
    all_paths = {e["path"] for e in repo_tree}
    all_paths_lower = {p.lower() for p in all_paths}

    stack.has_dockerfile = bool(
        {"dockerfile"}.intersection(file_names)
        or any("dockerfile" in p for p in file_names)
    )
    stack.has_compose = bool(
        "docker-compose.yml" in file_names
        or "docker-compose.yaml" in file_names
    )
    stack.has_k8s = bool(
        any("k8s" in p or "kubernetes" in p or "deployment.yaml" in p.lower()
            for p in all_paths_lower)
    )
    stack.has_helm = bool(
        any("chart.yaml" in p.lower() or "helm" in p.lower()
            for p in all_paths_lower)
    )

    has_ts = bool(
        {"tsconfig.json"}.intersection(file_names)
        or any(f.endswith(".ts") for f in all_paths)
    )
    has_tsx = any(f.endswith(".tsx") for f in all_paths)

    if "package.json" in key_files:
        pkg = _try_parse_json(key_files["package.json"])
        if pkg:
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            stack.languages.append("javascript")
            if has_ts:
                stack.languages.append("typescript")

            if "react" in deps:
                stack.frameworks.append("react")
                stack.port = 3000
            if "next" in deps or "next.js" in deps:
                stack.frameworks.append("nextjs")
                stack.port = 3000
            if "vue" in deps or "@vue" in str(deps):
                stack.frameworks.append("vue")
                stack.port = 5173
            if "express" in deps or "fastify" in deps or "hapi" in deps:
                stack.frameworks.append("express")
                stack.port = 3000
            if "nest" in deps or "@nestjs" in str(deps):
                stack.frameworks.append("nestjs")
                stack.port = 3000

            scripts = pkg.get("scripts", {})
            if scripts.get("dev") and "vite" in scripts.get("dev", ""):
                stack.frameworks.append("vite")
            if scripts.get("dev") and "webpack" in scripts.get("dev", ""):
                stack.frameworks.append("webpack")

            stack.package_manager = _detect_package_manager(key_files)
            if not stack.entrypoint:
                main = pkg.get("main", "")
                if main:
                    stack.entrypoint = main

    if "requirements.txt" in key_files:
        reqs = key_files["requirements.txt"].lower()
        stack.languages.append("python")
        if "django" in reqs:
            stack.frameworks.append("django")
            stack.port = 8000
        if "fastapi" in reqs:
            stack.frameworks.append("fastapi")
            stack.port = 8000
        if "flask" in reqs:
            stack.frameworks.append("flask")
            stack.port = 5000
        if "tensorflow" in reqs or "torch" in reqs or "scikit-learn" in reqs:
            stack.frameworks.append("ml")
        if "psycopg2" in reqs or "asyncpg" in reqs:
            stack.databases.append("postgresql")
        if "redis" in reqs:
            stack.databases.append("redis")
        if "pymongo" in reqs or "motor" in reqs:
            stack.databases.append("mongodb")
        if "sqlalchemy" in reqs:
            stack.frameworks.append("sqlalchemy")
        stack.build_tool = "pip"

    if "pyproject.toml" in key_files:
        if "python" not in stack.languages:
            stack.languages.append("python")
        stack.build_tool = "pip"

    if "Pipfile" in key_files:
        if "python" not in stack.languages:
            stack.languages.append("python")
        stack.build_tool = "pipenv"

    if "go.mod" in key_files:
        stack.languages.append("go")
        stack.port = 8080

    if "Cargo.toml" in key_files:
        stack.languages.append("rust")
        stack.port = 8080

    if "Gemfile" in key_files:
        stack.languages.append("ruby")
        stack.frameworks.append("rails")
        stack.port = 3000

    if "composer.json" in key_files:
        stack.languages.append("php")
        stack.build_tool = "composer"
        stack.port = 80

    if "pom.xml" in key_files:
        stack.languages.append("java")
        stack.build_tool = "maven"
        stack.port = 8080

    if "build.gradle" in key_files:
        stack.languages.append("java")
        stack.build_tool = "gradle"
        stack.port = 8080

    has_csproj = any(f.endswith(".csproj") for f in all_paths)
    if has_csproj or ".csproj" in file_names:
        stack.languages.append("csharp")
        if "dotnet" not in stack.frameworks:
            stack.frameworks.append("dotnet")
        if not has_tsx and not has_ts:
            stack.port = 8080

    if not stack.languages:
        ext_map = _detect_by_extension(all_paths)
        stack.languages = ext_map.get("languages", [])
        if ext_map.get("frameworks"):
            stack.frameworks.extend(ext_map["frameworks"])

    if not stack.entrypoint and stack.frameworks:
        _infer_entrypoint(stack, key_files)

    if "Dockerfile" in key_files:
        stack.docker_base_image = _parse_dockerfile_base(key_files["Dockerfile"])

    if ".env.example" in key_files:
        stack.env_files.append(".env.example")

    return stack


def _try_parse_json(content: str):
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def _detect_package_manager(key_files: dict) -> str:
    if "package-lock.json" in key_files:
        return "npm"
    if "yarn.lock" in key_files:
        return "yarn"
    if "pnpm-lock.yaml" in key_files:
        return "pnpm"
    if "bun.lockb" in key_files:
        return "bun"
    return "npm"


def _detect_by_extension(all_paths: set) -> dict:
    exts = {}
    for p in all_paths:
        ext = p.rsplit(".", 1)[-1].lower() if "." in p else ""
        if ext:
            exts[ext] = exts.get(ext, 0) + 1
    languages = []
    frameworks = []
    lang_map = {
        "py": "python", "js": "javascript", "ts": "typescript",
        "jsx": "javascript", "tsx": "typescript",
        "java": "java", "go": "go", "rs": "rust",
        "rb": "ruby", "php": "php", "cs": "csharp",
        "swift": "swift", "kt": "kotlin",
    }
    for ext, lang in lang_map.items():
        if ext in exts and exts[ext] > 1:
            languages.append(lang)
    return {"languages": languages, "frameworks": frameworks}


def _infer_entrypoint(stack: DetectedStack, key_files: dict):
    if "fastapi" in stack.frameworks or "flask" in stack.frameworks:
        for f in key_files:
            if f.endswith("main.py") or f.endswith("app.py"):
                stack.entrypoint = f
                return
    if "express" in stack.frameworks or "nestjs" in stack.frameworks:
        for f in key_files:
            if f.endswith("server.js") or f.endswith("app.js") or f.endswith("index.js"):
                stack.entrypoint = f
                return
    if "django" in stack.frameworks:
        if "manage.py" in key_files:
            stack.entrypoint = "manage.py"


def _parse_dockerfile_base(content: str) -> str:
    for line in content.splitlines():
        if line.strip().upper().startswith("FROM "):
            return line.strip()[5:].strip()
    return None


def build_stack_summary_for_ai(stack: DetectedStack) -> str:
    return json.dumps(stack.to_dict(), indent=2)
