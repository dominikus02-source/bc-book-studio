"""Read-only admission check before ANY production-side image build/deploy.

This NEVER starts/stops containers, writes production state or retrieves secrets.
The output does not grant permission to deploy; human release gates remain.
"""
from __future__ import annotations
import json
import os
import shutil
import subprocess
from pathlib import Path

MIN_DISK_GIB = 25
MIN_MEMORY_GIB = 6
MAX_LOAD_PER_CPU = 0.55

def evaluate(*, disk_free_gib: float, memory_available_gib: float,
             load_one: float, cpus: int, docker_access: bool) -> list[str]:
    problems = []
    if not docker_access:
        problems.append("docker access denied")
    if disk_free_gib < MIN_DISK_GIB:
        problems.append(f"insufficient disk for isolated image builds ({disk_free_gib:.1f} GiB, need {MIN_DISK_GIB})")
    if memory_available_gib < MIN_MEMORY_GIB:
        problems.append(f"insufficient available memory ({memory_available_gib:.1f} GiB)")
    if load_one > cpus * MAX_LOAD_PER_CPU:
        problems.append(f"host load too high ({load_one:.2f} / {cpus} CPUs)")
    return problems

def main() -> int:
    disk = shutil.disk_usage("/")
    mem_kb = 0
    for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
        if line.startswith("MemAvailable:"):
            mem_kb = int(line.split()[1])
            break
    ps = subprocess.run(["docker", "ps", "--format", "{{.Names}}"],
                        text=True, capture_output=True, timeout=20, check=False)
    cpus = os.cpu_count() or 1
    load = os.getloadavg()[0]
    disk_gib = disk.free / (1024**3)
    mem_gib = mem_kb / (1024**2)
    blockers = evaluate(disk_free_gib=disk_gib, memory_available_gib=mem_gib,
                        load_one=load, cpus=cpus, docker_access=ps.returncode == 0)
    report = {
        "status": "BLOCKED" if blockers else "PREFLIGHT_PASS_ONLY",
        "diskFreeGiB": round(disk_gib, 2),
        "memoryAvailableGiB": round(mem_gib, 2),
        "oneMinuteLoad": round(load, 2),
        "cpus": cpus,
        "containerCount": len(ps.stdout.splitlines()) if ps.returncode == 0 else None,
        "blockers": blockers,
        "note": "Read-only gate; never authorizes modifying existing production containers, Cloudflare Access, or release."
    }
    print(json.dumps(report, indent=2))
    return 2 if blockers else 0

if __name__ == "__main__":
    raise SystemExit(main())
