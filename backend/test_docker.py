import docker

client = docker.from_env()
client.ping()
print("Docker daemon connected")

containers = client.containers.list(all=False)
print(f"Found {len(containers)} containers")

for c in containers:
    print(f"\n  ID: {c.id[:12]}")
    print(f"  Name: {c.name}")
    print(f"  Image: {c.image.tags}")
    inspect = client.api.inspect(c.id)
    print(f"  Status: {inspect['State']['Status']}")
    print(f"  RestartCount: {inspect['RestartCount']}")

    try:
        stats = c.stats(stream=False)
        print(f"  Stats OK: cpu keys={list(stats.get('cpu_stats', {}).keys())}")
    except Exception as e:
        print(f"  Stats ERROR: {e}")

    try:
        logs = c.logs(tail=3).decode("utf-8", errors="replace")
        print(f"  Logs OK: {len(logs)} chars")
    except Exception as e:
        print(f"  Logs ERROR: {e}")
