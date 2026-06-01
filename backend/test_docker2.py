import docker
client = docker.from_env()
client.ping()
containers = client.containers.list(all=False)
print(f"containers.list returned {len(containers)}")
for c in containers:
    print(f"container: {c.name}")
    attrs = c.attrs
    state = attrs.get("State", {})
    print(f"  status: {state.get('Status')}")
    print(f"  restart: {attrs.get('RestartCount', 'N/A')}")
    try:
        s = c.stats(stream=False)
        print(f"  stats cpu_stats present: {'cpu_stats' in s}")
    except Exception as e:
        print(f"  stats error: {e}")
    try:
        logs = c.logs(tail=2).decode("utf-8", errors="replace")
        print(f"  logs: {len(logs)} chars")
    except Exception as e:
        print(f"  logs error: {e}")
