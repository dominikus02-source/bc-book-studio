#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"; rm -f "$base/../owner-run/config.env.generated"' EXIT
cat > "$root/valid" <<'EOF'
[CADDY_ADAPT_JSON]
{"apps":{"http":{"servers":{"srv0":{"routes":[{"match":[{"host":["www.bahasacerdas.com","jumpa.bahasacerdas.com","bcbookstudio.bahasacerdas.com"]}]}]}}}}}
[/CADDY_ADAPT_JSON]
[CURL]
www.bahasacerdas.com HTTP:200 LATENCY:0.280008s
jumpa.bahasacerdas.com HTTP:200 LATENCY:0.100537s
bcbookstudio.bahasacerdas.com HTTP:302 LATENCY:0.202921s
[/CURL]
[MOUNTS]
/opt/bahasacerdas/config/caddy.d /etc/caddy/conf.d false
[/MOUNTS]
[IMPORTS]
import /etc/caddy/conf.d/*.caddy
[/IMPORTS]
EOF
bash "$base/../owner-run/ingest-inventory.sh" "$root/valid"
grep -q '^BASELINE_COMPLETE=true$' "$base/../owner-run/config.env.generated"
grep -q 'bcbookstudio.bahasacerdas.com:302:' "$base/../owner-run/config.env.generated"
echo 'PASS: valid inventory including 302'
sed '/jumpa.bahasacerdas.com HTTP:/d' "$root/valid" > "$root/missing"
if bash "$base/../owner-run/ingest-inventory.sh" "$root/missing"; then echo 'FAIL: missing status accepted'; exit 1; fi
grep -q '^BASELINE_COMPLETE=false$' "$base/../owner-run/config.env.generated"
echo 'PASS: missing host status blocked'
sed 's|/opt/bahasacerdas/config/caddy.d /etc/caddy/conf.d false|/different /etc/caddy/conf.d true|' "$root/valid" > "$root/mount"
if bash "$base/../owner-run/ingest-inventory.sh" "$root/mount"; then echo 'FAIL: changed mount accepted'; exit 1; fi
grep -q '^BASELINE_COMPLETE=false$' "$base/../owner-run/config.env.generated"
echo 'PASS: changed mount blocked'
: > "$root/empty"
if bash "$base/../owner-run/ingest-inventory.sh" "$root/empty"; then echo 'FAIL: empty inventory accepted'; exit 1; fi
grep -q '^BASELINE_COMPLETE=false$' "$base/../owner-run/config.env.generated"
echo 'PASS: empty inventory blocked'
