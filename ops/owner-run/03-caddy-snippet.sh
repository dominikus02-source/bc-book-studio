#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/owner-run/config.env
source "$base/config.env"

# CI fixture only: refuses all real host paths and requires explicit opt-in.
if [[ "${1:-}" == "--ci-fixture" ]]; then
  [[ "${BC_CI_FIXTURE:-}" == "1" && -n "${BC_CI_ROOT:-}" && "$BC_CI_ROOT" == /tmp/* ]] || { echo "BLOCKED: fixture isolation missing"; exit 1; }
  [[ -f "$BC_CI_ROOT/.fixture-marker" && -d "$BC_CI_ROOT/conf.d" ]] || { echo "BLOCKED: fixture marker missing"; exit 1; }
  backup="$BC_CI_ROOT/backup-$(date -u +%Y%m%dT%H%M%S%N)"
  cp -a "$BC_CI_ROOT/conf.d" "$backup"
  echo "$backup" > "$BC_CI_ROOT/backup-path"
  cp "$BC_CI_ROOT/new.caddy" "$BC_CI_ROOT/conf.d/new.caddy"
  if ! bash "$BC_CI_ROOT/validate.sh"; then
    echo "CI FIXTURE: validate failed; calling 99 rollback without reload"
    BC_CI_FIXTURE=1 BC_CI_ROOT="$BC_CI_ROOT" bash "$base/99-rollback.sh" --ci-fixture "$backup"
    exit 1
  fi
  bash "$BC_CI_ROOT/reload.sh"
  if ! bash "$BC_CI_ROOT/baseline.sh"; then
    echo "CI FIXTURE: baseline regression; calling 99 rollback"
    BC_CI_FIXTURE=1 BC_CI_ROOT="$BC_CI_ROOT" bash "$base/99-rollback.sh" --ci-fixture "$backup"
    exit 1
  fi
  echo "CI FIXTURE: applied and baseline passed"
  exit 0
fi

dest="$HOST_CONFD/$SNIPPET_NAME"
certdir="$HOST_CONFD/$CERT_SUBDIR"
if [[ "${1:-}" == "--dry-run" ]]; then
  printf 'DRY RUN: check Caddy mount %q -> %q read-only, import, complete baselines, origin cert paths, and CI evidence\n' "$HOST_CONFD" "$CT_CONFD"
  printf 'DRY RUN: backup conf.d; install test-approved cert/key in %q; render snippet to %q; caddy validate; caddy reload; verify all baseline hosts; rollback on error\n' "$certdir" "$dest"
  exit 0
fi
[[ $# -eq 0 ]] || { echo "Usage: $0 [--dry-run]"; exit 2; }
# Fail closed: preflight has not established complete host inventory, Caddy mount
# identity, or cert/key accessibility. Do not mutate production until proven.
[[ "$BASELINE_COMPLETE" == true ]] || { echo "BLOCKED: complete hostname baseline not verified"; exit 1; }
[[ -f "$base/caddy-ci-approved.txt" ]] || { echo "BLOCKED: Caddy CI validation evidence missing"; exit 1; }
mount="$(docker inspect -f '{{range .Mounts}}{{println .Source "|" .Destination "|" .RW}}{{end}}' "$CADDY_CONTAINER" | awk -F ' \\| ' -v target="$CT_CONFD" '$2 == target {print $1 "|" $3}')" 
[[ "$mount" == "$HOST_CONFD|false" ]] || { echo "BLOCKED: Caddy conf.d mount is not the expected read-only bind"; exit 1; }
docker exec "$CADDY_CONTAINER" grep -F "import $CT_CONFD/*.caddy" /etc/caddy/Caddyfile >/dev/null || { echo "BLOCKED: Caddy import absent"; exit 1; }
[[ "$CERT_SUBDIR" == */* && "$CERT_SUBDIR" != *.caddy ]] || { echo "BLOCKED: invalid certificate subdir"; exit 1; }
echo "BLOCKED: automated backup/rollback and complete baseline regression test not yet CI validated; no production changes performed."
exit 1
