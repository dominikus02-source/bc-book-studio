#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/owner-run/config.env
source "$base/config.env"
if [[ "${1:-}" == "--dry-run" ]]; then
  echo "DRY RUN: read-only baseline, Access redirect, origin-IP, verifier health, certificate expiry and key mode checks"; exit 0
fi
[[ $# -eq 0 ]] || { echo "Usage: $0 [--dry-run]"; exit 2; }
fail=0
printf '%-36s %-9s %-9s %-12s %s\n' HOST EXPECTED ACTUAL LATENCY RESULT
IFS=',' read -r -a entries <<< "$BASELINE_HOSTS"
for entry in "${entries[@]}"; do
  IFS=: read -r host expected baseline <<< "$entry"
  if [[ ! "$host" =~ ^[a-zA-Z0-9.-]+$ || ! "$expected" =~ ^[0-9]{3}$ || ! "$baseline" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    echo "INVALID baseline entry: $entry"; fail=1; continue
  fi
  response="$(curl -sS -o /dev/null --max-time 12 -w '%{http_code} %{time_total}' "https://$host/" 2>/dev/null)" || response="000 999"
  read -r actual latency <<< "$response"
  verdict="$(awk -v a="$actual" -v e="$expected" -v t="$latency" -v b="$baseline" -v factor="$MAX_LATENCY_FACTOR" -v extra="$MAX_LATENCY_EXTRA_SECONDS" 'BEGIN {if(a==e && t<=b*factor+extra) print "LULUS"; else print "GAGAL"}')"
  printf '%-36s %-9s %-9s %-12s %s\n' "$host" "$expected" "$actual" "$latency" "$verdict"
  [[ "$verdict" == LULUS ]] || fail=1
done
if [[ "$BASELINE_COMPLETE" != true ]]; then echo "GAGAL: hostname inventory incomplete"; fail=1; fi
# The origin IP must be explicitly supplied; do not guess it from DNS/Cloudflare.
if [[ -n "${ORIGIN_IP:-}" ]]; then
  code="$(curl -ksS --max-time 12 --resolve "bcbookstudio.bahasacerdas.com:443:$ORIGIN_IP" -o /dev/null -w '%{http_code}' https://bcbookstudio.bahasacerdas.com/ 2>/dev/null)" || code=000
  if [[ "$code" == 401 || "$code" == 403 || "$code" == 404 ]]; then echo "LULUS: origin direct rejected ($code)"; else echo "GAGAL: origin direct $code"; fail=1; fi
else echo "GAGAL: ORIGIN_IP not provided; direct-origin denial unverified"; fail=1; fi
# Access edge must redirect unauthenticated browser. Curl without cookie or JWT.
code="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://bcbookstudio.bahasacerdas.com/ 2>/dev/null)" || code=000
if [[ "$code" == 302 ]]; then echo "LULUS: unauthenticated Access 302"; else echo "GAGAL: Access expected 302 got $code"; fail=1; fi
if docker inspect bc-book-studio-verifier >/dev/null 2>&1; then
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' bc-book-studio-verifier)"
  ports="$(docker inspect -f '{{json .NetworkSettings.Ports}}' bc-book-studio-verifier)"
  if [[ "$health" == healthy && "$ports" != *HostIp* ]]; then echo "LULUS: verifier healthy; no public port"; else echo "GAGAL: verifier health=$health ports=$ports"; fail=1; fi
else echo "GAGAL: verifier container not found"; fail=1; fi
cert="${CERT_FILE:-$HOST_CONFD/$CERT_SUBDIR/tls.crt}"
key="${CERT_KEY_FILE:-$HOST_CONFD/$CERT_SUBDIR/tls.key}"
if [[ -r "$cert" ]]; then
  expiry="$(openssl x509 -in "$cert" -noout -enddate 2>/dev/null || true)"
  if openssl x509 -in "$cert" -checkend 0 -noout >/dev/null 2>&1; then echo "LULUS: certificate currently valid ($expiry)"; else echo "GAGAL: expired/unreadable certificate"; fail=1; fi
  echo "NOTE: owner must confirm intended expiration date 2027-11-04; this check does not assume it."
else echo "GAGAL: certificate not readable at $cert"; fail=1; fi
if [[ -e "$key" ]]; then
  mode="$(stat -c %a "$key" 2>/dev/null || true)"
  if [[ "$mode" == 600 ]]; then echo "LULUS: private key mode 600"; else echo "GAGAL: private key mode $mode"; fail=1; fi
else echo "GAGAL: private key path unavailable"; fail=1; fi
if ((fail)); then echo "HASIL: GAGAL"; exit 1; fi
echo "HASIL: LULUS (browser login still owner-only)"
