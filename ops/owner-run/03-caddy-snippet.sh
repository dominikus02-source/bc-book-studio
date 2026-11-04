#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/owner-run/config.env
source "$base/config.env"
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
mount="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/conf.d"}}{{.Source}}|{{.RW}}{{end}}{{end}}' "$CADDY_CONTAINER")"
[[ "$mount" == "$HOST_CONFD|false" ]] || { echo "BLOCKED: Caddy conf.d mount is not the expected read-only bind"; exit 1; }
docker exec "$CADDY_CONTAINER" grep -F "import $CT_CONFD/*.caddy" /etc/caddy/Caddyfile >/dev/null || { echo "BLOCKED: Caddy import absent"; exit 1; }
[[ "$CERT_SUBDIR" == */* && "$CERT_SUBDIR" != *.caddy ]] || { echo "BLOCKED: invalid certificate subdir"; exit 1; }
echo "BLOCKED: automated backup/rollback and complete baseline regression test not yet CI validated; no production changes performed."
exit 1
