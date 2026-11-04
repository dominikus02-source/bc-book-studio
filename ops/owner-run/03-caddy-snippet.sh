#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "$0")" && pwd)"
snippet="$base/bcbookstudio.caddy"
hosts="$base/hostnames.txt"
dest=/opt/bahasacerdas/config/caddy.d/bcbookstudio.caddy
certdir=/opt/bahasacerdas/config/caddy.d/certs/bcbookstudio
sourcecert=/var/lib/docker/volumes/bahasacerdas-prod_caddy_data/_data/bcbookstudio
container=bahasacerdas-prod-caddy-1
logdir="$HOME/bcbookstudio-owner-logs"
mkdir -p "$logdir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
log="$logdir/caddy-$stamp.log"
backup="$logdir/caddy-$stamp.backup"
baseline="$logdir/baseline-$stamp.tsv"
after="$logdir/after-$stamp.tsv"
echo "Will back up only BC Book Studio snippet, copy its certs, validate, reload and compare all listed hostnames. Failure triggers rollback."
read -r -p "Owner confirms all hostnames listed and temporary validation passed? [yes/NO] " answer
[[ "$answer" == yes ]] || exit 0
exec > >(tee -a "$log") 2>&1
[[ -s "$hosts" && -s "$snippet" ]] || { echo "Missing hostnames or snippet"; exit 1; }
[[ -f "$sourcecert/tls.crt" && -f "$sourcecert/tls.key" ]] || { echo "Missing origin cert/key"; exit 1; }
[[ -f "$base/caddy-ci-approved.txt" ]] || { echo "Missing approved temporary Caddy validation evidence"; exit 1; }
# Require the existing Caddy container to see the exact snippet directory; never mutate its mounts.
docker exec "$container" test -d /etc/caddy/caddy.d || { echo "Caddy snippet mount unknown: stop"; exit 1; }
measure() {
 local output="$1" host status latency
 : > "$output"
 while IFS= read -r host || [[ -n "$host" ]]; do
   [[ -z "$host" || "$host" == \#* ]] && continue
   [[ "$host" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo "Invalid hostname"; return 1; }
   read -r status latency < <(curl -sS -o /dev/null -w '%{http_code} %{time_total}' --max-time 12 "https://$host" || echo "000 99")
   printf '%s\t%s\t%s\n' "$host" "$status" "$latency" >> "$output"
 done < "$hosts"
 [[ -s "$output" ]]
}
measure "$baseline"
echo "Baseline saved: $baseline"
if sudo test -f "$dest"; then
 sudo cp -p "$dest" "$backup"
else
 : > "$backup.absent"
fi
rollback() {
 echo "Regression or validation failure: rolling back BC Book Studio snippet."
 if [[ -f "$backup.absent" ]]; then sudo rm -f "$dest"; else sudo cp -p "$backup" "$dest"; fi
 docker exec "$container" caddy validate --config /etc/caddy/Caddyfile &&
 docker exec "$container" caddy reload --config /etc/caddy/Caddyfile || echo "CRITICAL: rollback validation/reload failed; owner intervention needed"
}
trap rollback ERR
sudo install -d -m 700 "$certdir"
sudo install -m 600 "$sourcecert/tls.crt" "$certdir/tls.crt"
sudo install -m 600 "$sourcecert/tls.key" "$certdir/tls.key"
sudo install -m 644 "$snippet" "$dest"
docker exec "$container" caddy validate --config /etc/caddy/Caddyfile
docker exec "$container" caddy reload --config /etc/caddy/Caddyfile
measure "$after"
python3 - "$baseline" "$after" <<'PY'
import sys
def load(path):
    with open(path) as f:
        return {h:(int(code),float(t)) for h,code,t in (line.strip().split("\t") for line in f if line.strip())}
before, after = load(sys.argv[1]),load(sys.argv[2])
assert before and before.keys()==after.keys(), "hostname inventory mismatch"
for host,(code,latency) in before.items():
    newcode,newlatency=after[host]
    assert newcode==code and newcode not in (0,500,502,503,504), f"{host}: status regression {code}->{newcode}"
    assert newlatency<=max(latency*2,latency+0.5), f"{host}: latency regression {latency}->{newlatency}"
print("All listed hosts passed status/latency regression gate")
PY
trap - ERR
echo "SUCCESS; log=$log; backup=$backup; baseline=$baseline; after=$after"
