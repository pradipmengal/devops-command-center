"""
Docker Networking — FastAPI router.

Endpoints:
  GET /docker-networking/topology    — network/container topology
  GET /docker-networking/port-audit  — port exposure audit
  POST /docker-networking/dns-check  — DNS resolution check between containers
"""

import re
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/docker-networking", tags=["docker-networking"])

# ── Docker client helper ──────────────────────────────────────────────────────

try:
    import docker as _docker
    _DOCKER_AVAILABLE = True
except ImportError:
    _DOCKER_AVAILABLE = False


def _get_client():
    if not _DOCKER_AVAILABLE:
        return None
    try:
        client = _docker.from_env()
        client.ping()
        return client
    except Exception:
        return None


# ── /topology ─────────────────────────────────────────────────────────────────

@router.get("/topology")
async def get_topology():
    """
    Returns all Docker networks with connected containers and their IPs.
    Shape: { networks: [ { id, name, driver, scope, containers: [ { id, name, ip, aliases } ] } ] }
    """
    client = _get_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})

    try:
        networks = client.networks.list()
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    result = []
    for net in networks:
        net.reload()
        containers = []
        for cid, cdata in (net.attrs.get("Containers") or {}).items():
            containers.append({
                "id": cid[:12],
                "name": cdata.get("Name", ""),
                "ip": cdata.get("IPv4Address", "").split("/")[0],
                "mac": cdata.get("MacAddress", ""),
            })

        result.append({
            "id": net.id[:12],
            "name": net.name,
            "driver": net.attrs.get("Driver", ""),
            "scope": net.attrs.get("Scope", ""),
            "internal": net.attrs.get("Internal", False),
            "ipam_subnet": _extract_subnet(net.attrs),
            "containers": containers,
        })

    return {"status": "success", "data": result}


def _extract_subnet(attrs):
    try:
        configs = attrs.get("IPAM", {}).get("Config", [])
        return configs[0].get("Subnet", "") if configs else ""
    except Exception:
        return ""


# ── /port-audit ───────────────────────────────────────────────────────────────

@router.get("/port-audit")
async def port_audit():
    """
    Audit port bindings across all containers.
    Flags: 0.0.0.0 (exposed to all interfaces), duplicate host ports, privileged ports (<1024).
    """
    client = _get_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})

    try:
        containers = client.containers.list(all=True)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    entries = []
    host_port_map: dict[str, list[str]] = {}  # host_port -> [container names]

    for c in containers:
        net_settings = c.attrs.get("NetworkSettings", {}) or {}
        ports = net_settings.get("Ports", {}) or {}

        for container_port_proto, bindings in ports.items():
            container_port = container_port_proto.split("/")[0]
            protocol = container_port_proto.split("/")[1] if "/" in container_port_proto else "tcp"

            if not bindings:
                # Port exposed but not published
                entries.append({
                    "container": c.name,
                    "containerId": c.id[:12],
                    "containerPort": container_port,
                    "protocol": protocol,
                    "hostIp": None,
                    "hostPort": None,
                    "published": False,
                    "risks": [],
                })
                continue

            for binding in bindings:
                host_ip = binding.get("HostIp", "")
                host_port = binding.get("HostPort", "")
                risks = _assess_port_risks(host_ip, host_port, container_port)

                if host_port:
                    host_port_map.setdefault(host_port, []).append(c.name)

                entries.append({
                    "container": c.name,
                    "containerId": c.id[:12],
                    "containerPort": container_port,
                    "protocol": protocol,
                    "hostIp": host_ip,
                    "hostPort": host_port,
                    "published": True,
                    "risks": risks,
                })

    # Flag duplicate host ports
    for entry in entries:
        hp = entry.get("hostPort")
        if hp and len(host_port_map.get(hp, [])) > 1:
            if "duplicate_host_port" not in entry["risks"]:
                entry["risks"].append("duplicate_host_port")

    return {"status": "success", "data": entries}


def _assess_port_risks(host_ip: str, host_port: str, container_port: str) -> list[str]:
    risks = []
    if host_ip in ("0.0.0.0", ""):
        risks.append("exposed_all_interfaces")
    try:
        hp = int(host_port) if host_port else 0
        cp = int(container_port) if container_port else 0
        if hp < 1024 and hp > 0:
            risks.append("privileged_host_port")
        if cp < 1024:
            risks.append("privileged_container_port")
    except ValueError:
        pass
    return risks


# ── /dns-check ────────────────────────────────────────────────────────────────

@router.post("/dns-check")
async def dns_check(payload: dict):
    """
    Test if `from_container` can resolve `target` (a container name or hostname).
    Uses the Docker SDK exec_run to run nslookup/getent inside the source container.
    """
    from_container = (payload.get("from_container") or "").strip()
    target = (payload.get("target") or "").strip()

    if not from_container or not target:
        return JSONResponse(status_code=422, content={"status": "error", "message": "from_container and target are required"})

    client = _get_client()
    if client is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Docker daemon unavailable"})

    try:
        container = client.containers.get(from_container)
    except Exception:
        return JSONResponse(status_code=404, content={"status": "error", "message": f"Container '{from_container}' not found"})

    if container.status != "running":
        return JSONResponse(status_code=400, content={"status": "error", "message": f"Container '{from_container}' is not running"})

    # Try Python socket (always available in Python containers), then getent
    commands = [
        ["python3", "-c", f"import socket; addr=socket.gethostbyname('{target}'); print('RESOLVED:'+addr)"],
        ["getent", "hosts", target],
        ["nslookup", target],
    ]

    for cmd in commands:
        try:
            result = container.exec_run(cmd, stdout=True, stderr=True, demux=False)
            output = (result.output or b"").decode("utf-8", errors="replace").strip()

            # Skip if the tool itself is not installed
            if "executable file not found" in output or "not found" in output.lower() and result.exit_code != 0:
                continue

            resolved = result.exit_code == 0
            ip = None
            for line in output.splitlines():
                line = line.strip()
                if line.startswith("RESOLVED:"):
                    ip = line.split("RESOLVED:")[-1].strip()
                    resolved = True
                    break
                if line and line[0].isdigit() and " " in line:
                    ip = line.split()[0]
                    break
                if "Address:" in line and "#" not in line:
                    ip = line.split("Address:")[-1].strip()
                    break
                m = re.search(r'\((\d+\.\d+\.\d+\.\d+)\)', line)
                if m:
                    ip = m.group(1)
                    break

            return {
                "status": "success",
                "data": {
                    "from_container": from_container,
                    "target": target,
                    "resolved": resolved,
                    "resolved_ip": ip,
                    "output": output[:1000],
                    "command_used": " ".join(cmd[:2]),
                }
            }
        except Exception:
            continue

    return JSONResponse(status_code=500, content={"status": "error", "message": "No DNS tool (python3/getent/nslookup) available in container"})
