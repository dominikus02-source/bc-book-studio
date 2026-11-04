#!/usr/bin/env bash
set -euo pipefail
# Strict read-only inventory. No sudo, writes, or Docker container creation.
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.env
source "$base/config.env"
C="$CADDY_CONTAINER"
if [[ "${1:-}" == "--dry-run" ]]; then echo "DRY RUN: inspect Caddy image/digest, mounts, imports, hostname status/latency; no remote writes"; exit 0; fi
[[ $# -eq 0 ]] || { echo "Usage: $0 [--dry-run]"; exit 2; }
echo "== timestamp"; date -u
echo "== identity"; id
echo "== containers"; docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
echo "== caddy image tag"; docker inspect -f '{{.Config.Image}}' "$C"
echo "== caddy image digest"
image_id="$(docker inspect -f '{{.Image}}' "$C")"
docker image inspect "$image_id" --format '{{json .RepoDigests}}'
echo "== caddy version"; docker exec "$C" caddy version
echo "== networks"; docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$C"
echo "== caddyfile and imports (paths only; may include hostnames)"
docker exec "$C" sh -c "grep -nE '^[^ #].*\\{|^[[:space:]]*import[[:space:]]' /etc/caddy/Caddyfile" || true
echo "== conf.d metadata"; ls -ld "$HOST_CONFD"; ls -la "$HOST_CONFD" || true
echo "== cert and key existence (no content)"
for f in /var/lib/docker/volumes/bahasacerdas-prod_caddy_data/_data/bcbookstudio/tls.crt /var/lib/docker/volumes/bahasacerdas-prod_caddy_data/_data/bcbookstudio/tls.key; do
 if test -e "$f"; then echo "PRESENT $f"; elif test -r "$f"; then echo "READABLE $f"; else echo "UNKNOWN/INACCESSIBLE $f"; fi
done
echo "== disk"; df -h /
echo "== hostname inventory (from Caddyfile; review imports separately)"
docker exec "$C" sh -c "grep -nE '^[^ #].*\\{' /etc/caddy/Caddyfile" || true
echo "== baseline known hosts (NOT proof of full inventory)"
echo "== config baseline: $BASELINE_HOSTS; complete=$BASELINE_COMPLETE"
for h in www.bahasacerdas.com jumpa.bahasacerdas.com bcbookstudio.bahasacerdas.com; do
 printf '%s ' "$h"
 curl -sS -o /dev/null -m 12 -w 'HTTP:%{http_code} LATENCY:%{time_total}s\n' "https://$h/" || echo "REQUEST FAILED"
done
echo "== IMPORTANT: owner must supply complete host list from all imported Caddy snippets; do not assume these three hosts are exhaustive"
