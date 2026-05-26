from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/gitignore", tags=["gitignore"])

TEMPLATES = {
    "node": """\
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
.npm
.yarn-integrity
dist/
build/
.env
.env.local
.env.*.local
coverage/
.nyc_output
*.tsbuildinfo
""",

    "python": """\
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST
.env
.venv
env/
venv/
ENV/
.pytest_cache/
.coverage
htmlcov/
.mypy_cache/
.ruff_cache/
""",

    "java": """\
# Java / Maven / Gradle
*.class
*.log
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar
target/
build/
.gradle/
gradle-app.setting
!gradle-wrapper.jar
.gradletasknamecache
out/
.idea/
*.iml
*.iws
*.ipr
""",

    "go": """\
# Go
*.exe
*.exe~
*.dll
*.so
*.dylib
*.test
*.out
vendor/
go.sum
""",

    "rust": """\
# Rust
/target/
Cargo.lock
**/*.rs.bk
*.pdb
""",

    "dotnet": """\
# .NET
*.user
*.suo
*.userosscache
*.sln.docstates
[Dd]ebug/
[Dd]ebugPublic/
[Rr]elease/
[Rr]eleases/
x64/
x86/
[Ww][Ii][Nn]32/
[Aa][Rr][Mm]/
[Aa][Rr][Mm]64/
bld/
[Bb]in/
[Oo]bj/
[Ll]og/
[Ll]ogs/
.vs/
*.user
*.rsuser
*.suo
*.userprefs
publish/
**/[Pp]ackages/*
*.nupkg
*.snupkg
project.lock.json
project.fragment.lock.json
artifacts/
""",

    "react": """\
# React / Vite / Next.js
node_modules/
dist/
build/
.next/
out/
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
coverage/
""",

    "macos": """\
# macOS
.DS_Store
.AppleDouble
.LSOverride
Icon
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent
.AppleDB
.AppleDesktop
Network Trash Folder
Temporary Items
.apdisk
""",

    "windows": """\
# Windows
Thumbs.db
Thumbs.db:encryptable
ehthumbs.db
ehthumbs_vista.db
*.stackdump
[Dd]esktop.ini
$RECYCLE.BIN/
*.cab
*.msi
*.msix
*.msm
*.msp
*.lnk
""",

    "linux": """\
# Linux
*~
.fuse_hidden*
.directory
.Trash-*
.nfs*
""",

    "jetbrains": """\
# JetBrains IDEs
.idea/
*.iml
*.iws
*.ipr
out/
.idea_modules/
atlassian-ide-plugin.xml
com_crashlytics_export_strings.xml
crashlytics.properties
crashlytics-build.properties
fabric.properties
""",

    "vscode": """\
# VS Code
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
!.vscode/*.code-snippets
.history/
*.vsix
""",

    "docker": """\
# Docker
.dockerignore
docker-compose.override.yml
.env
""",

    "terraform": """\
# Terraform
.terraform/
.terraform.lock.hcl
*.tfstate
*.tfstate.*
crash.log
crash.*.log
*.tfvars
*.tfvars.json
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraformrc
terraform.rc
""",
}

SUPPORTED_TYPES = set(TEMPLATES.keys())


class GitignoreRequest(BaseModel):
    types: List[str]


@router.post("/generate")
async def generate_gitignore(request: GitignoreRequest):
    if not request.types:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "At least one type must be specified"}},
        )

    unsupported = [t for t in request.types if t.lower() not in SUPPORTED_TYPES]
    if unsupported:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {
                    "message": f"Unsupported types: {', '.join(unsupported)}. "
                               f"Supported: {', '.join(sorted(SUPPORTED_TYPES))}"
                },
            },
        )

    # Merge templates, deduplicate lines
    seen_lines = set()
    sections = []
    for t in request.types:
        template = TEMPLATES[t.lower()]
        lines = template.splitlines()
        unique_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#") or stripped == "":
                unique_lines.append(line)
            elif stripped not in seen_lines:
                seen_lines.add(stripped)
                unique_lines.append(line)
        sections.append("\n".join(unique_lines))

    result = "\n".join(sections)

    return {
        "status": "success",
        "data": {
            "gitignore": result,
            "types_included": [t.lower() for t in request.types],
        },
    }
