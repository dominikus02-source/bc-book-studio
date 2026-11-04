#!/usr/bin/env bash
set -euo pipefail
root="$(mktemp -d /tmp/bc-caddy-ci-XXXXXXXX)"
trap 'rm -rf "$root"' EXIT
export BC_CI_FIXTURE=1 BC_CI_ROOT="$root"
touch "$root/.fixture-marker"
mkdir -p "$root/conf.d"
printf 'legacy.test { respond "legacy-ok" 200 }\n' > "$root/conf.d/legacy.caddy"
cat > "$root/validate.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if grep -q 'MISSING_CERT' "$BC_CI_ROOT/conf.d/"*.caddy; then exit 1; fi
SH
cat > "$root/reload.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf 'reload\n' >> "$BC_CI_ROOT/reload-count"
SH
cat > "$root/baseline.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
test ! -f "$BC_CI_ROOT/regression"
grep -q legacy-ok "$BC_CI_ROOT/conf.d/legacy.caddy"
SH
chmod +x "$root/"*.sh
hash_conf() {
 (cd "$root/conf.d" && find . -type f -print0 | sort -z | xargs -0 sha256sum) | sha256sum | cut -d' ' -f1
}
before="$(hash_conf)"
echo "BEFORE_SHA256=$before"
printf 'new.test { respond "new" 200 }\n' > "$root/new.caddy"
touch "$root/regression"
if bash ops/owner-run/03-caddy-snippet.sh --ci-fixture; then
 echo 'FAIL: regression should trigger automatic rollback'; exit 1
fi
after="$(hash_conf)"
echo "AFTER_REGRESSION_ROLLBACK_SHA256=$after"
[[ "$before" == "$after" ]]
grep -q legacy-ok "$root/conf.d/legacy.caddy"
echo 'PASS: regression triggered 99, configuration hash identical, legacy restored'
rm "$root/regression"
printf 'new.test { tls MISSING_CERT MISSING_KEY }\n' > "$root/new.caddy"
reload_before="$(wc -l < "$root/reload-count")"
if bash ops/owner-run/03-caddy-snippet.sh --ci-fixture; then
 echo 'FAIL: invalid cert path should trigger rollback'; exit 1
fi
reload_after="$(wc -l < "$root/reload-count")"
# One reload belongs to the rollback; 03 must not reload before validation.
[[ $((reload_after-reload_before)) -eq 1 ]]
final="$(hash_conf)"
echo "AFTER_INVALID_CERT_ROLLBACK_SHA256=$final"
[[ "$before" == "$final" ]]
echo 'PASS: invalid cert path triggered 99 without pre-validation reload'
echo '=== Final conf.d diff ==='
diff -ru "$root/$(basename "$(cat "$root/backup-path")")" "$root/conf.d" || true
