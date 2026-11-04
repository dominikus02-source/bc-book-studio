#!/usr/bin/env python3
"""Strict, read-only parser for normalized owner inventory. No VPS access."""
import difflib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

source, config, generated = sys.argv[1:]
raw = sys.stdin.read() if source == "-" else Path(source).read_text()
original = Path(config).read_text()
sections = {}
current = None
for line in raw.splitlines():
    stripped = line.strip()
    if stripped in ("[CADDY_ADAPT_JSON]", "[/CADDY_ADAPT_JSON]", "[CURL]", "[/CURL]", "[MOUNTS]", "[/MOUNTS]", "[IMPORTS]", "[/IMPORTS]"):
        if stripped.startswith("[/"):
            current = None
        else:
            current = stripped[1:-1]
            sections.setdefault(current, [])
    elif current:
        sections[current].append(line)
    elif stripped:
        sections.setdefault("UNKNOWN", []).append(line)
errors = []
if sections.get("UNKNOWN"): errors.append("unrecognized lines outside inventory sections")
try:
    adapt = json.loads("\n".join(sections.get("CADDY_ADAPT_JSON", [])))
except (ValueError, TypeError):
    adapt = {}
    errors.append("missing or invalid caddy adapt JSON")
hosts = set()
def walk(obj):
    if isinstance(obj, dict):
        match = obj.get("match")
        if isinstance(match, list):
            for entry in match:
                if isinstance(entry, dict) and "host" in entry:
                    for h in entry["host"]:
                        if isinstance(h, str) and re.fullmatch(r"[A-Za-z0-9.-]+", h):
                            hosts.add(h.lower())
                        else:
                            errors.append("unsupported host matcher")
        for v in obj.values(): walk(v)
    elif isinstance(obj, list):
        for v in obj: walk(v)
walk(adapt.get("apps", {}).get("http", {}).get("servers", {}))
if not hosts: errors.append("no concrete host matchers in adapted HTTP servers")
status = {}
for line in sections.get("CURL", []):
    line = line.strip()
    if not line: continue
    m = re.fullmatch(r"(https?://)?([A-Za-z0-9.-]+)(?:/)?\s+(?:HTTP:)?([0-9]{3})\s+(?:LATENCY:)?([0-9]+(?:\.[0-9]+)?)s?", line)
    if not m:
        errors.append("unrecognized curl line: " + line[:100]); continue
    host, code, latency = m.group(2).lower(), int(m.group(3)), float(m.group(4))
    if host in status: errors.append("duplicate curl host " + host)
    if code < 100 or code > 599: errors.append("invalid status " + host)
    status[host] = (code, latency)
for h in sorted(hosts - status.keys()): errors.append("missing curl status: " + h)
for h in sorted(status.keys() - hosts): errors.append("curl host absent from adapt: " + h)
mounts = []
for line in sections.get("MOUNTS", []):
    if not line.strip(): continue
    m = re.fullmatch(r"([^\s]+)\s+([^\s]+)\s+(true|false)", line.strip(), re.I)
    if not m: errors.append("unrecognized mount line"); continue
    mounts.append((m.group(1),m.group(2),m.group(3).lower()))
expected_host = re.search(r"^HOST_CONFD=(.*)$",original,re.M).group(1)
expected_ct = re.search(r"^CT_CONFD=(.*)$",original,re.M).group(1)
match = [m for m in mounts if m[1] == expected_ct]
if len(match) != 1 or match[0] != (expected_host, expected_ct, "false"):
    errors.append("MOUNT MISMATCH: expected "+expected_host+" "+expected_ct+" false")
imports = [x.strip() for x in sections.get("IMPORTS", []) if x.strip()]
if imports != ["import "+expected_ct+"/*.caddy"]:
    errors.append("IMPORT MISMATCH: expected import "+expected_ct+"/*.caddy")
if not raw.strip(): errors.append("empty inventory")
complete = not errors
baseline = ",".join(f"{h}:{status[h][0]}:{status[h][1]:.6f}" for h in sorted(hosts & status.keys()))
updates = {"BASELINE_HOSTS": "'" + baseline + "'", "BASELINE_COMPLETE": "true" if complete else "false"}
output = original
for key, value in updates.items():
    output = re.sub(r"^"+key+r"=.*$",lambda m, key=key,value=value:key+"="+value,output,flags=re.M)
Path(generated).write_text(output)
print("BASELINE_HOSTS="+updates["BASELINE_HOSTS"])
print("BASELINE_COMPLETE="+updates["BASELINE_COMPLETE"])
print("MOUNT="+(str(match[0]) if len(match)==1 else "unknown"))
print("IMPORT="+str(imports))
for e in errors: print("BLOCKED: "+e,file=sys.stderr)
print("=== config.env diff ===")
print("".join(difflib.unified_diff(original.splitlines(True),output.splitlines(True),fromfile="config.env",tofile="config.env.generated")),end="")
if errors: sys.exit(1)
