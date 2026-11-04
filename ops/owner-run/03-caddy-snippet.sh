#!/usr/bin/env bash
set -euo pipefail
echo "Caddy owner gate: NO production changes unless prerequisites are present."
read -r -p "Check readiness? [yes/NO] " answer
[[ "$answer" == yes ]] || exit 0
mkdir -p "$HOME/bcbookstudio-owner-logs"
log="$HOME/bcbookstudio-owner-logs/caddy-gate-$(date -u +%Y%m%dT%H%M%SZ).log"
{
 echo "Required: complete hostnames.txt; baseline; tested BC Book Studio snippet; same-version temporary Caddy validation; rollback backup."
 base="$(dirname "$0")"
 test -s "$base/hostnames.txt" || { echo "BLOCKED: hostnames.txt missing"; exit 1; }
 test -s "$base/bcbookstudio.caddy" || { echo "BLOCKED: validated snippet missing"; exit 1; }
 echo "Preflight gate only. No automatic production reload is implemented until the snippet and regression checks are reviewed."
} 2>&1 | tee "$log"
exit 1
