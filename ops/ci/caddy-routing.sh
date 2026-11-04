#!/usr/bin/env bash
set -euo pipefail
source ops/owner-run/config.env
work="$(mktemp -d)"
network="bc-ci-$$"
cleanup() {
  docker rm -f bc-ci-caddy bc-ci-verifier bc-ci-jwks bc-ci-static >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/conf.d" "$work/keys"
chmod 755 "$work" "$work/keys"
openssl genrsa -out "$work/keys/sign.pem" 2048 2>/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=jwks.test' -addext 'subjectAltName=DNS:jwks.test' -keyout "$work/keys/jwks.key" -out "$work/keys/jwks.crt" 2>/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=bcbookstudio.test' -addext 'subjectAltName=DNS:bcbookstudio.test' -keyout "$work/keys/caddy.key" -out "$work/keys/caddy.crt" 2>/dev/null
chmod 644 "$work/keys/"*.crt "$work/keys/sign.pem" "$work/keys/jwks.key" "$work/keys/caddy.key"
cat > "$work/Caddyfile" <<'CADDY'
https://bcbookstudio.test:8443 {
 tls /ci/keys/caddy.crt /ci/keys/caddy.key
 log {
  output stdout
  format filter {
   wrap json
   fields {
    request>headers>Cf-Access-Jwt-Assertion delete
    request>headers>Cookie delete
    request>headers>X-Access-Identity delete
   }
  }
 }
 forward_auth bc-ci-verifier:8080 {
  uri /auth
  copy_headers X-Access-Identity
 }
 reverse_proxy bc-ci-static:8080
}
http://legacy.test:8080 {
 respond "legacy-ok" 200
}
CADDY
docker build --target test -t bc-verifier-ci ./verifier
docker network create "$network" >/dev/null
docker run -d --name bc-ci-jwks --network "$network" --network-alias jwks.test -v "$PWD/ops/ci:/ci:ro" -v "$work/keys:/keys:ro" -e TEST_KEY=/keys/sign.pem -e TEST_CERT=/keys/jwks.crt -e TEST_TLS_KEY=/keys/jwks.key bc-verifier-ci python /ci/jwks_fixture.py >/dev/null
docker run -d --name bc-ci-verifier --network "$network" --network-alias bc-ci-verifier -v "$work/keys/jwks.crt:/ci/ca.crt:ro" -e SSL_CERT_FILE=/ci/ca.crt -e REQUESTS_CA_BUNDLE=/ci/ca.crt -e CF_ACCESS_TEAM_DOMAIN=jwks.test:8443 -e CF_ACCESS_AUD=ci-audience bc-verifier-ci python /app/server.py >/dev/null
docker run -d --name bc-ci-static --network "$network" --network-alias bc-ci-static -v "$PWD/ops/ci:/ci:ro" bc-verifier-ci python /ci/static_fixture.py >/dev/null
docker run -d --name bc-ci-caddy --network "$network" -p 127.0.0.1:18443:8443 -p 127.0.0.1:18080:8080 -v "$work/Caddyfile:/etc/caddy/Caddyfile:ro" -v "$work/keys:/ci/keys:ro" "caddy@$CADDY_IMAGE_DIGEST" >/dev/null
for i in $(seq 1 35); do
 if curl -fsS -H "Host: legacy.test" --max-time 2 http://127.0.0.1:18080/ | grep -q legacy-ok; then break; fi
 sleep 1
done
curl -fsS -H "Host: legacy.test" --max-time 3 http://127.0.0.1:18080/ | grep -q legacy-ok || { echo "FAIL: legacy baseline unavailable before reload"; exit 1; }
request() {
 curl -ksS --noproxy '*' --resolve bcbookstudio.test:18443:127.0.0.1 -o "$work/body" -w '%{http_code}' "$@" https://bcbookstudio.test:18443/
}
check() {
 local label="$1" expected="$2"; shift 2
 local got
 got="$(request "$@")"
 printf '%s expected=%s actual=%s\n' "$label" "$expected" "$got" | tee -a "$work/results"
 [[ "$got" == "$expected" ]]
}
check missing-jwt 401
docker run --rm --network none -v "$work/keys:/keys" -v "$PWD/ops/ci:/ci:ro" bc-verifier-ci python -c 'import jwt,time; k=open("/keys/sign.pem").read(); n=int(time.time()); claims={"iss":"https://jwks.test:8443","aud":"ci-audience","email":"verified@example.invalid","exp":n+300,"nbf":n-5}; open("/keys/valid.jwt","w").write(jwt.encode(claims,k,algorithm="RS256",headers={"kid":"ci-key"})); claims["aud"]="wrong"; open("/keys/wrong.jwt","w").write(jwt.encode(claims,k,algorithm="RS256",headers={"kid":"ci-key"})); claims["aud"]="ci-audience"; claims["exp"]=n-3600; open("/keys/expired.jwt","w").write(jwt.encode(claims,k,algorithm="RS256",headers={"kid":"ci-key"}))'
check valid-jwt 200 -H "Cf-Access-Jwt-Assertion: $(cat "$work/keys/valid.jwt")"
grep -q 'identity=verified@example.invalid' "$work/body"
check wrong-audience 401 -H "Cf-Access-Jwt-Assertion: $(cat "$work/keys/wrong.jwt")"
check expired-jwt 401 -H "Cf-Access-Jwt-Assertion: $(cat "$work/keys/expired.jwt")"
check spoofed-identity 200 -H "X-Access-Identity: attacker@example.invalid" -H "Cf-Access-Jwt-Assertion: $(cat "$work/keys/valid.jwt")"
grep -q 'identity=verified@example.invalid' "$work/body"
# Requests carry a deliberately recognizable cookie; logs must not echo its value or JWT.
check cookie-log-probe 200 -H 'Cookie: ci_sensitive_cookie_marker=SECRET_NEVER_LOG' -H "Cf-Access-Jwt-Assertion: $(cat "$work/keys/valid.jwt")"
docker logs bc-ci-caddy > "$work/caddy.log" 2>&1
if grep -Ei 'Cf-Access-Jwt-Assertion|ci_sensitive_cookie_marker|SECRET_NEVER_LOG' "$work/caddy.log"; then
 echo 'FAIL: sensitive header/cookie marker appeared in Caddy log'; exit 1
fi
if grep -Fq "$(cat "$work/keys/valid.jwt")" "$work/caddy.log"; then echo 'FAIL: JWT leaked to log'; exit 1; fi
echo 'PASS: Caddy log has no JWT header name, token, or cookie marker'
# Concurrent old-host requests while Caddy reloads the same valid config.
(
 for i in $(seq 1 30); do
  curl -fsS -H "Host: legacy.test" --max-time 3 http://127.0.0.1:18080/ | grep -q legacy-ok || { echo "FAIL: legacy probe $i during reload"; exit 1; }
  sleep 0.1
 done
) &
watcher=$!
if ! docker exec bc-ci-caddy caddy reload --config /etc/caddy/Caddyfile; then echo "FAIL: Caddy reload command"; exit 1; fi
if ! wait "$watcher"; then echo "FAIL: legacy continuity watcher"; exit 1; fi
echo 'PASS: 30 legacy host probes during Caddy reload'
echo '=== JWT cases ==='
cat "$work/results"
