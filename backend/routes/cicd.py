from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/cicd", tags=["cicd"])

SUPPORTED_PLATFORMS = {"github_actions", "gitlab_ci", "jenkins"}
SUPPORTED_LANGUAGES = {"nodejs", "python", "java", "go", "rust", "dotnet"}


class CICDRequest(BaseModel):
    platform: str
    language: str
    steps: List[str]          # e.g. ["lint", "test", "build", "docker", "deploy"]
    docker_image: Optional[str] = None
    deploy_target: Optional[str] = None  # "kubernetes", "ec2", "ecs"


def _github_actions(language: str, steps: List[str], docker_image: Optional[str], deploy_target: Optional[str]) -> str:
    lang_setup = {
        "nodejs": "      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n          cache: 'npm'",
        "python": "      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n          cache: 'pip'",
        "java":   "      - uses: actions/setup-java@v4\n        with:\n          java-version: '21'\n          distribution: 'temurin'\n          cache: 'maven'",
        "go":     "      - uses: actions/setup-go@v5\n        with:\n          go-version: '1.22'\n          cache: true",
        "rust":   "      - uses: dtolnay/rust-toolchain@stable",
        "dotnet": "      - uses: actions/setup-dotnet@v4\n        with:\n          dotnet-version: '8.0.x'",
    }

    lint_cmds = {
        "nodejs": "npm run lint",
        "python": "pip install flake8 && flake8 .",
        "java":   "mvn checkstyle:check",
        "go":     "golangci-lint run",
        "rust":   "cargo clippy -- -D warnings",
        "dotnet": "dotnet format --verify-no-changes",
    }

    test_cmds = {
        "nodejs": "npm test",
        "python": "pip install pytest && pytest",
        "java":   "mvn test",
        "go":     "go test ./...",
        "rust":   "cargo test",
        "dotnet": "dotnet test",
    }

    build_cmds = {
        "nodejs": "npm run build",
        "python": "pip install build && python -m build",
        "java":   "mvn package -DskipTests",
        "go":     "go build -o app .",
        "rust":   "cargo build --release",
        "dotnet": "dotnet publish -c Release -o ./publish",
    }

    step_lines = []

    if "lint" in steps:
        step_lines.append(f"""
      - name: Lint
        run: {lint_cmds.get(language, 'echo "No lint configured"')}""")

    if "test" in steps:
        step_lines.append(f"""
      - name: Test
        run: {test_cmds.get(language, 'echo "No test configured"')}""")

    if "build" in steps:
        step_lines.append(f"""
      - name: Build
        run: {build_cmds.get(language, 'echo "No build configured"')}""")

    if "docker" in steps:
        img = docker_image or "my-app"
        step_lines.append(f"""
      - name: Build Docker image
        run: docker build -t {img}:${{{{ github.sha }}}} .

      - name: Push Docker image
        run: |
          echo "${{{{ secrets.DOCKER_PASSWORD }}}}" | docker login -u "${{{{ secrets.DOCKER_USERNAME }}}}" --password-stdin
          docker push {img}:${{{{ github.sha }}}}""")

    if "deploy" in steps and deploy_target == "kubernetes":
        step_lines.append("""
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/app app=${{ env.IMAGE }}:${{ github.sha }}
          kubectl rollout status deployment/app""")

    steps_yaml = "".join(step_lines)

    return f"""name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  pipeline:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

{lang_setup.get(language, '')}
{steps_yaml}
"""


def _gitlab_ci(language: str, steps: List[str], docker_image: Optional[str], deploy_target: Optional[str]) -> str:
    images = {
        "nodejs": "node:20-alpine",
        "python": "python:3.12-slim",
        "java":   "maven:3.9-eclipse-temurin-21",
        "go":     "golang:1.22-alpine",
        "rust":   "rust:1.77-slim",
        "dotnet": "mcr.microsoft.com/dotnet/sdk:8.0",
    }

    stages = []
    jobs = []

    if "lint" in steps:
        stages.append("lint")
        jobs.append("""lint:
  stage: lint
  script:
    - echo "Running linter..."
""")

    if "test" in steps:
        stages.append("test")
        jobs.append("""test:
  stage: test
  script:
    - echo "Running tests..."
  coverage: '/TOTAL.*\\s+(\\d+%)$/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
""")

    if "build" in steps:
        stages.append("build")
        jobs.append("""build:
  stage: build
  script:
    - echo "Building application..."
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour
""")

    if "docker" in steps:
        stages.append("docker")
        img = docker_image or "my-app"
        jobs.append(f"""docker-build:
  stage: docker
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t {img}:$CI_COMMIT_SHA .
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker push {img}:$CI_COMMIT_SHA
""")

    stages_yaml = "\n".join(f"  - {s}" for s in stages)
    jobs_yaml = "\n".join(jobs)

    return f"""image: {images.get(language, 'ubuntu:22.04')}

stages:
{stages_yaml}

variables:
  DOCKER_DRIVER: overlay2

{jobs_yaml}"""


def _jenkins(language: str, steps: List[str], docker_image: Optional[str], deploy_target: Optional[str]) -> str:
    stage_blocks = []

    if "lint" in steps:
        stage_blocks.append("""        stage('Lint') {
            steps {
                sh 'echo "Running linter..."'
            }
        }""")

    if "test" in steps:
        stage_blocks.append("""        stage('Test') {
            steps {
                sh 'echo "Running tests..."'
            }
            post {
                always {
                    junit '**/test-results/*.xml'
                }
            }
        }""")

    if "build" in steps:
        stage_blocks.append("""        stage('Build') {
            steps {
                sh 'echo "Building application..."'
            }
        }""")

    if "docker" in steps:
        img = docker_image or "my-app"
        stage_blocks.append(f"""        stage('Docker Build & Push') {{
            steps {{
                script {{
                    docker.build('{img}:${{env.BUILD_NUMBER}}')
                    docker.withRegistry('https://registry.hub.docker.com', 'docker-credentials') {{
                        docker.image('{img}:${{env.BUILD_NUMBER}}').push()
                    }}
                }}
            }}
        }}""")

    stages_yaml = "\n\n".join(stage_blocks)

    return f"""pipeline {{
    agent any

    environment {{
        APP_NAME = 'my-app'
        DOCKER_IMAGE = '{docker_image or "my-app"}'
    }}

    stages {{
{stages_yaml}
    }}

    post {{
        always {{
            cleanWs()
        }}
        success {{
            echo 'Pipeline succeeded!'
        }}
        failure {{
            echo 'Pipeline failed!'
            // mail to: 'team@example.com', subject: 'Build Failed'
        }}
    }}
}}"""


@router.post("/generate")
async def generate_cicd(request: CICDRequest):
    platform = request.platform.lower().strip()
    language = request.language.lower().strip()

    if platform not in SUPPORTED_PLATFORMS:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {
                    "message": f"Unsupported platform '{request.platform}'. "
                               f"Supported: {', '.join(sorted(SUPPORTED_PLATFORMS))}"
                },
            },
        )

    if language not in SUPPORTED_LANGUAGES:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {
                    "message": f"Unsupported language '{request.language}'. "
                               f"Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
                },
            },
        )

    valid_steps = {"lint", "test", "build", "docker", "deploy"}
    invalid_steps = [s for s in request.steps if s not in valid_steps]
    if invalid_steps:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {
                    "message": f"Invalid steps: {', '.join(invalid_steps)}. "
                               f"Valid steps: {', '.join(sorted(valid_steps))}"
                },
            },
        )

    generators = {
        "github_actions": _github_actions,
        "gitlab_ci":      _gitlab_ci,
        "jenkins":        _jenkins,
    }

    pipeline = generators[platform](
        language, request.steps, request.docker_image, request.deploy_target
    )

    file_names = {
        "github_actions": ".github/workflows/pipeline.yml",
        "gitlab_ci":      ".gitlab-ci.yml",
        "jenkins":        "Jenkinsfile",
    }

    return {
        "status": "success",
        "data": {
            "pipeline": pipeline,
            "platform": platform,
            "language": language,
            "filename": file_names[platform],
        },
    }
