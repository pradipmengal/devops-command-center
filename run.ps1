param(
    [ValidateSet("start", "stop", "restart", "setup", "status", "logs")]
    [string]$Command = "start",
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"
$ENV_EXAMPLE = ".env.example"
$ENV_FILE = ".env"
$PID_FILE = ".dev-pids.json"

$BACKEND_DIR = Join-Path $PSScriptRoot "backend"
$FRONTEND_DIR = Join-Path $PSScriptRoot "frontend"

function Write-Step($msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)  { Write-Host "OK $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── Prerequisites ────────────────────────────────────────────────────────────
function Check-Prerequisites {
    try {
        $pyVer = python --version 2>&1
        if ($pyVer -match "Python (\d+\.\d+)") {
            $ver = [version]$Matches[1]
            if ($ver -lt [version]"3.10") { Write-Err "Python 3.10+ required, found $pyVer" }
            Write-Ok "$pyVer"
        }
    } catch { Write-Err "Python not found. Install Python 3.10+ and add to PATH." }

    try {
        $nodeVer = node --version 2>&1
        Write-Ok "Node.js $nodeVer"
    } catch { Write-Err "Node.js not found. Install Node.js 18+ from https://nodejs.org" }

    try { $null = npm --version 2>&1 } catch { Write-Err "npm not found" }
}

function Ensure-EnvFile {
    if (-not (Test-Path $ENV_FILE) -and (Test-Path $ENV_EXAMPLE)) {
        Write-Step "Creating $ENV_FILE from $ENV_EXAMPLE ..."
        Copy-Item $ENV_EXAMPLE $ENV_FILE
        Write-Ok "Created $ENV_FILE"
    }
}

# ── Setup ────────────────────────────────────────────────────────────────────
function Install-Deps {
    Write-Step "Installing backend dependencies ..."
    if (-not (Test-Path "$BACKEND_DIR\.venv")) {
        Push-Location $BACKEND_DIR
        try { python -m venv .venv; Write-Ok "Created Python virtual environment" }
        finally { Pop-Location }
    }
    $origPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $pipOutput = & "$BACKEND_DIR\.venv\Scripts\pip" install -r "$BACKEND_DIR\requirements.txt" 2>&1
    $exitCode = $LASTEXITCODE
    $pipOutput | ForEach-Object { Write-Host $_ }
    $ErrorActionPreference = $origPref
    if ($exitCode -ne 0) { Write-Err "pip install failed (exit code $exitCode)" }
    Write-Ok "Backend dependencies installed"
}

function Install-Frontend {
    Write-Step "Installing frontend dependencies ..."
    Push-Location $FRONTEND_DIR
    try {
        $origPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $npmOutput = & cmd /c "npm install" 2>&1
        $exitCode = $LASTEXITCODE
        $npmOutput | ForEach-Object { Write-Host $_ }
        $ErrorActionPreference = $origPref
        if ($exitCode -ne 0) { Write-Err "npm install failed (exit code $exitCode)" }
        Write-Ok "Frontend dependencies installed"
    } finally { Pop-Location }
}

# ── Process management ──────────────────────────────────────────────────────
function Save-Pids($backendPid, $frontendPid) {
    $data = @{ backend = $backendPid; frontend = $frontendPid } | ConvertTo-Json
    Set-Content -Path $PID_FILE -Value $data
}

function Load-Pids {
    if (Test-Path $PID_FILE) {
        try { return Get-Content $PID_FILE | ConvertFrom-Json } catch {}
    }
    return $null
}

function Clear-Pids { if (Test-Path $PID_FILE) { Remove-Item $PID_FILE } }

# ── Start ────────────────────────────────────────────────────────────────────
function Start-Backend {
    $pythonExe = "$BACKEND_DIR\.venv\Scripts\python.exe"
    $outFile = "$BACKEND_DIR\.backend.log"
    $errFile = "$BACKEND_DIR\.backend-err.log"
    # Clear old logs
    Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
    Write-Step "Starting backend (uvicorn) ..."
    $proc = Start-Process -FilePath $pythonExe -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8090 --reload" `
        -WorkingDirectory $BACKEND_DIR -WindowStyle Hidden `
        -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru
    Start-Sleep -Seconds 4
    if ($proc.HasExited) { Write-Err "Backend failed to start (exit code $($proc.ExitCode)). Check $errFile and $outFile" }
    Write-Ok "Backend running (PID: $($proc.Id)) on http://localhost:8000"
    return $proc.Id
}

function Start-Frontend {
    Write-Step "Starting frontend (Vite) ..."
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" `
        -WorkingDirectory $FRONTEND_DIR -WindowStyle Normal -PassThru
    Start-Sleep -Seconds 4
    if ($proc.HasExited) { Write-Err "Frontend failed to start" }
    Write-Ok "Frontend running (PID: $($proc.Id)) on http://localhost:5173"
    return $proc.Id
}

function Start-App {
    Check-Prerequisites
    Ensure-EnvFile
    $venvPython = "$BACKEND_DIR\.venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) { Install-Deps } else {
        # Verify uvicorn is actually installed in the venv
        $check = & $venvPython -c "import uvicorn" 2>&1
        if ($LASTEXITCODE -ne 0) { Write-Step "Packages missing, reinstalling ..."; Install-Deps }
    }
    if (-not (Test-Path "$FRONTEND_DIR\node_modules")) { Install-Frontend }

    $bePid = Start-Backend
    $fePid = Start-Frontend
    Save-Pids $bePid $fePid

    Write-Host ""
    Write-Ok "Application is running locally"
    Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Green
    Write-Host "  Backend  : http://localhost:8000" -ForegroundColor Green
    Write-Host "  API Docs : http://localhost:8000/docs" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Stop with: .\run.ps1 stop" -ForegroundColor Yellow
}

# ── Stop ─────────────────────────────────────────────────────────────────────
function Stop-App {
    $pids = Load-Pids
    if ($pids) {
        if ($pids.backend) {
            $p = Get-Process -Id $pids.backend -ErrorAction SilentlyContinue
            if ($p) { $p | Stop-Process -Force; Write-Step "Stopped backend" }
        }
        if ($pids.frontend) {
            $p = Get-Process -Id $pids.frontend -ErrorAction SilentlyContinue
            if ($p) { $p | Stop-Process -Force; Write-Step "Stopped frontend" }
        }
    }
    # Fallback: kill any lingering uvicorn or npm processes from this project
    Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "uvicorn" } | Stop-Process -Force
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "vite" } | Stop-Process -Force
    Clear-Pids
    Write-Ok "Stopped"
}

# ── Logs ─────────────────────────────────────────────────────────────────────
function Show-Logs {
    $logFile = if ($Service -eq "backend") { "$BACKEND_DIR\.backend.log" }
               elseif ($Service -eq "frontend") { "$FRONTEND_DIR\.frontend.log" }
               else { Write-Err "Usage: .\run.ps1 logs -Service backend|frontend" }
    if (-not (Test-Path $logFile)) { Write-Err "No logs yet. Start the app first." }
    Write-Step "Tailing $Service logs (Ctrl+C to exit) ..."
    Get-Content $logFile -Tail 30 -Wait
}

# ── Status ───────────────────────────────────────────────────────────────────
function Show-Status {
    $pids = Load-Pids
    if (-not $pids) { Write-Host "Not running. Run: .\run.ps1 start" -ForegroundColor Yellow; return }

    $be = Get-Process -Id $pids.backend -ErrorAction SilentlyContinue
    $fe = Get-Process -Id $pids.frontend -ErrorAction SilentlyContinue

    if ($be) { Write-Host "  Backend  : RUNNING (PID: $($pids.backend))" -ForegroundColor Green }
    else { Write-Host "  Backend  : STOPPED" -ForegroundColor Red }

    if ($fe) { Write-Host "  Frontend : RUNNING (PID: $($pids.frontend))" -ForegroundColor Green }
    else { Write-Host "  Frontend : STOPPED" -ForegroundColor Red }
}

# ── Dispatch ─────────────────────────────────────────────────────────────────
switch ($Command) {
    "start"   { Start-App }
    "stop"    { Stop-App }
    "restart" { Stop-App; Start-Sleep 2; Start-App }
    "setup"   { Check-Prerequisites; Ensure-EnvFile; Install-Deps; Install-Frontend }
    "status"  { Show-Status }
    "logs"    { Show-Logs }
}
