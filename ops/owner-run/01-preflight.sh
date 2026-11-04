#!/usr/bin/env bash
set -euo pipefail
echo "READ-ONLY preflight: no configuration changes"
read -r -p "Run preflight? [yes/NO] " answer
[[ "$answer" == yes ]] || exit 0
mkdir -p "$HOME/bcbookstudio-owner-logs"
log="$HOME/bcbookstudio-owner-logs/preflight-$(date -u +%Y%m%dT%H%M%SZ).log"
{
 date -u
 id
 df -h /opt/bc-book-studio
 docker version --format '{{.Server.Version}}'
 docker network inspect bahasacerdas-prod_edge --format '{{.Name}}'
 docker inspect bahasacerdas-prod-caddy-1 --format '{{.Config.Image}}'
 for f in /opt/bahasacerdas/config/caddy.d /var/lib/docker/volumes/bahasacerdas-prod_caddy_data/_data/bcbookstudio/tls.crt /var/lib/docker/volumes/bahasacerdas-prod_caddy_data/_data/bcbookstudio/tls.key; do
   if sudo test -e "$f"; then echo "PRESENT: $f"; else echo "MISSING: $f"; fi
 done
 echo "Hostname baseline: supply complete approved hostname list in ops/owner-run/hostnames.txt"
 if [[ -f "$(dirname "$0")/hostnames.txt" ]]; then
   while IFS= read -r host; do
     [[ -z "$host" || "$host" == \#* ]] && continue
     curl -sS -o /dev/null -w "$host HTTP:%{http_code} LATENCY:%{time_total}\n" --max-time 12 "https://$host" || true
   done < "$(dirname "$0")/hostnames.txt"
 fi
} 2>&1 | tee "$log"
echo "Saved $log"
