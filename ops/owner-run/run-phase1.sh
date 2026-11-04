#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/owner-run/config.env
source "$base/config.env"
dry=false
if [[ "${1:-}" == "--dry-run" ]]; then dry=true; elif [[ $# -ne 0 ]]; then echo "Usage: $0 [--dry-run]"; exit 2; fi
if [[ "$dry" == true ]]; then
  for s in 01-preflight.sh 02-deploy-verifier.sh 03-caddy-snippet.sh; do
    printf 'DRY RUN: %s\n' "$s"
    bash "$base/$s" --dry-run
  done
  echo 'DRY RUN: 04-verify.sh read-only checks after deployment'
  echo 'DRY RUN: on failure, 99 requires a verified dated backup path; no production writes'
  exit 0
fi
logdir="$base/logs"
mkdir -p "$logdir"
log="$logdir/phase1-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$log") 2>&1
backup=""
on_error() {
  local status=$?
  trap - ERR
  echo "FAILED: status=$status; log=$log"
  if [[ -n "$backup" && -d "$backup" ]]; then
    echo "Owner rollback requested: $backup"
    bash "$base/99-rollback.sh" "$backup" || echo "ROLLBACK FAILED; owner intervention required"
  else
    echo "NO VERIFIED BACKUP: automatic rollback prohibited"
  fi
  exit "$status"
}
trap on_error ERR
confirm() {
  local label="$1" answer
  printf 'CONFIRM %s (type YES): ' "$label"
  read -r answer
  [[ "$answer" == YES ]] || { echo "STOP: owner declined"; exit 2; }
}
echo 'STAGE 01: read-only Caddy and hostname inventory'
confirm 'run preflight'
bash "$base/01-preflight.sh"
[[ "$BASELINE_COMPLETE" == true ]] || { echo "BLOCKED: inventory incomplete"; exit 1; }
echo 'STAGE 02: verifier and static staging; no Caddy restart'
confirm 'deploy verifier and static'
bash "$base/02-deploy-verifier.sh"
echo 'STAGE 03: Caddy snippet, only after backup and complete gate'
# The owner script 03 must write a verified backup-path before any mutation.
[[ -f "$base/caddy-ci-approved.txt" ]] || { echo "BLOCKED: full Caddy CI approval missing"; exit 1; }
confirm 'install and reload Caddy snippet'
bash "$base/03-caddy-snippet.sh"
[[ -f "$base/last-backup-path" ]] || { echo "BLOCKED: no rollback backup recorded"; exit 1; }
backup="$(cat "$base/last-backup-path")"
echo 'STAGE 04: post-deployment read-only checks'
confirm 'run verification'
bash "$base/04-verify.sh"
echo "LULUS: machine checks; owner browser checklist still required"
