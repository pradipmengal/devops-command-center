#!/usr/bin/env bash
set -o errexit -o pipefail
[[ $TRACE ]] && set -o xtrace

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKEND_DIR="$SCRIPT_DIR/backend"
readonly FRONTEND_DIR="$SCRIPT_DIR/frontend"
readonly ENV_EXAMPLE=".env.example"
readonly ENV_FILE=".env"
readonly PID_FILE=".dev-pids.json"
readonly BE_LOG="$BACKEND_DIR/.backend.log"
readonly FE_LOG="$FRONTEND_DIR/.frontend.log"

# ── Colors ───────────────────────────────────────────────────────────────────
readonly CYAN='\033[0;36m'
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[0;33m'
readonly RESET='\033[0m'

step()  { echo -e "${CYAN}>> $*${RESET}"; }
ok()    { echo -e "${GREEN}OK $*${RESET}"; }
err()   { echo -e "${RED}ERROR: $*${RESET}" >&2; exit 1; }

# ── Prerequisites ────────────────────────────────────────────────────────────
check_prereqs() {
    local py_ver
    py_ver=$(python3 --version 2>&1) || err "Python 3.10+ not found. Install it."
    local ver
    ver=$(echo "$py_ver" | sed -n 's/Python \([0-9]*\.[0-9]*\).*/\1/p')
    if [[ "$(echo "$ver < 3.10" | bc -l 2>/dev/null || echo 1)" -eq 1 ]]; then
        err "Python 3.10+ required, found $py_ver"
    fi
    ok "$py_ver"

    local node_ver
    node_ver=$(node --version 2>&1) || err "Node.js 18+ not found. Install from https://nodejs.org"
    ok "Node.js $node_ver"

    npm --version >/dev/null 2>&1 || err "npm not found"
}

# ── Environment ──────────────────────────────────────────────────────────────
ensure_env_file() {
    if [[ ! -f $ENV_FILE && -f $ENV_EXAMPLE ]]; then
        step "Creating $ENV_FILE from $ENV_EXAMPLE ..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        ok "Created $ENV_FILE"
    fi
}

# ── Setup ────────────────────────────────────────────────────────────────────
install_deps() {
    step "Installing backend dependencies ..."
    if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
        pushd "$BACKEND_DIR" >/dev/null
        python3 -m venv .venv
        popd >/dev/null
        ok "Created Python virtual environment"
    fi
    "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt" 2>&1
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        err "pip install failed (exit code $rc)"
    fi
    ok "Backend dependencies installed"
}

install_frontend() {
    step "Installing frontend dependencies ..."
    pushd "$FRONTEND_DIR" >/dev/null
    npm install 2>&1
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        err "npm install failed (exit code $rc)"
    fi
    popd >/dev/null
    ok "Frontend dependencies installed"
}

# ── PID management ───────────────────────────────────────────────────────────
save_pids() {
    printf '{"backend":%d,"frontend":%d}\n' "$1" "$2" > "$PID_FILE"
}

load_pids() {
    if [[ -f $PID_FILE ]]; then
        python3 -c "
import json, sys
try:
    d = json.load(open('$PID_FILE'))
    print(d.get('backend', 0), d.get('frontend', 0))
except: print('0 0')
" 2>/dev/null || echo "0 0"
    else
        echo "0 0"
    fi
}

clear_pids() {
    rm -f "$PID_FILE"
}

# ── Start ────────────────────────────────────────────────────────────────────
start_backend() {
    local python_exe="$BACKEND_DIR/.venv/bin/python"
    rm -f "$BE_LOG"
    step "Starting backend (uvicorn) ..."
    nohup "$python_exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload \
        --root-path "$BACKEND_DIR" \
        > "$BE_LOG" 2>&1 &
    local pid=$!
    sleep 4
    if ! kill -0 "$pid" 2>/dev/null; then
        err "Backend failed to start. Check $BE_LOG"
    fi
    ok "Backend running (PID: $pid) on http://localhost:8000"
    echo "$pid"
}

start_frontend() {
    step "Starting frontend (Vite) ..."
    rm -f "$FE_LOG"
    nohup npm run dev --prefix "$FRONTEND_DIR" \
        > "$FE_LOG" 2>&1 &
    local pid=$!
    sleep 4
    if ! kill -0 "$pid" 2>/dev/null; then
        err "Frontend failed to start. Check $FE_LOG"
    fi
    ok "Frontend running (PID: $pid) on http://localhost:5173"
    echo "$pid"
}

start_app() {
    check_prereqs
    ensure_env_file

    local python_exe="$BACKEND_DIR/.venv/bin/python"
    if [[ ! -f $python_exe ]]; then
        install_deps
    else
        "$python_exe" -c "import uvicorn" 2>/dev/null || {
            step "Packages missing, reinstalling ..."
            install_deps
        }
    fi

    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
        install_frontend
    fi

    local be_pid fe_pid
    be_pid=$(start_backend)
    fe_pid=$(start_frontend)
    save_pids "$be_pid" "$fe_pid"

    echo ""
    ok "Application is running locally"
    echo -e "  ${GREEN}Frontend : http://localhost:5173${RESET}"
    echo -e "  ${GREEN}Backend  : http://localhost:8000${RESET}"
    echo -e "  ${GREEN}API Docs : http://localhost:8000/docs${RESET}"
    echo ""
    echo -e "  ${YELLOW}Stop with: ./run.sh stop${RESET}"
}

# ── Stop ─────────────────────────────────────────────────────────────────────
stop_app() {
    local be_pid fe_pid
    read -r be_pid fe_pid <<< "$(load_pids)"

    if [[ $be_pid -gt 0 ]] && kill -0 "$be_pid" 2>/dev/null; then
        kill "$be_pid" 2>/dev/null || true
        step "Stopped backend"
    fi
    if [[ $fe_pid -gt 0 ]] && kill -0 "$fe_pid" 2>/dev/null; then
        kill "$fe_pid" 2>/dev/null || true
        step "Stopped frontend"
    fi

    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    clear_pids
    ok "Stopped"
}

# ── Logs ─────────────────────────────────────────────────────────────────────
show_logs() {
    local log_file
    case "$SERVICE" in
        backend)  log_file=$BE_LOG ;;
        frontend) log_file=$FE_LOG ;;
        *) err "Usage: ./run.sh logs -s backend|frontend" ;;
    esac
    if [[ ! -f $log_file ]]; then
        err "No logs yet. Start the app first."
    fi
    step "Tailing $SERVICE logs (Ctrl+C to exit) ..."
    tail -f "$log_file"
}

# ── Status ───────────────────────────────────────────────────────────────────
show_status() {
    local be_pid fe_pid
    read -r be_pid fe_pid <<< "$(load_pids)"

    if [[ $be_pid -eq 0 && $fe_pid -eq 0 ]]; then
        echo -e "${YELLOW}Not running. Run: ./run.sh start${RESET}"
        return
    fi

    if [[ $be_pid -gt 0 ]] && kill -0 "$be_pid" 2>/dev/null; then
        echo -e "  ${GREEN}Backend  : RUNNING (PID: $be_pid)${RESET}"
    else
        echo -e "  ${RED}Backend  : STOPPED${RESET}"
    fi

    if [[ $fe_pid -gt 0 ]] && kill -0 "$fe_pid" 2>/dev/null; then
        echo -e "  ${GREEN}Frontend : RUNNING (PID: $fe_pid)${RESET}"
    else
        echo -e "  ${RED}Frontend : STOPPED${RESET}"
    fi
}

# ── Dispatch ─────────────────────────────────────────────────────────────────
usage() {
    echo "Usage: ./run.sh <command> [-s backend|frontend]"
    echo ""
    echo "Commands:"
    echo "  start              Start both backend and frontend"
    echo "  stop               Stop all services"
    echo "  restart            Stop then start"
    echo "  setup              Check prerequisites, create venv, install deps"
    echo "  status             Show running status"
    echo "  logs -s <service>  Tail logs (backend|frontend)"
    exit 1
}

COMMAND="${1:-start}"
shift 2>/dev/null || true
SERVICE=""

while getopts ":s:" opt; do
    case $opt in
        s) SERVICE=$OPTARG ;;
        *) ;;
    esac
done

case "$COMMAND" in
    start)   start_app ;;
    stop)    stop_app ;;
    restart) stop_app; sleep 2; start_app ;;
    setup)   check_prereqs; ensure_env_file; install_deps; install_frontend ;;
    status)  show_status ;;
    logs)    show_logs ;;
    *)       usage ;;
esac
