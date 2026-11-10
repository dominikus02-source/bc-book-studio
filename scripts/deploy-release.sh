#!/usr/bin/env bash
# Run from the existing BC Book Studio Compose directory on the VPS.
set -euo pipefail
mode="${1:---check}"
[[ "$mode" == --check || "$mode" == --apply ]] || { echo 'Use --check or --apply'; exit 2; }
: "${BC_BOOK_STUDIO_IMAGE:?Required}" "${BC_BOOK_STUDIO_MIGRATOR_IMAGE:?Required}" "${BC_BOOK_STUDIO_VERIFIED_SHA:?Required}"
[[ "$BC_BOOK_STUDIO_IMAGE" =~ ^ghcr.io/dominikus02-source/bc-book-studio@sha256:[a-f0-9]{64}$ ]]
[[ "$BC_BOOK_STUDIO_MIGRATOR_IMAGE" =~ ^ghcr.io/dominikus02-source/bc-book-studio-migrator@sha256:[a-f0-9]{64}$ ]]
[[ "$BC_BOOK_STUDIO_VERIFIED_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ -f compose.yml && -f compose.release.yml && -f .env ]] || { echo 'Missing Compose files or server environment'; exit 2; }
exec 9>.bookstudio-deploy.lock
flock -n 9 || { echo 'A Book Studio deployment is already running'; exit 2; }
compose=(docker compose -p bc-book-studio-runtime -f compose.yml)
[[ ! -f compose.edge.yml ]] || compose+=(-f compose.edge.yml)
compose+=(-f compose.resources.yml -f compose.release.yml)
# Refuse to operate on a newly created or different Compose database.
expected_project=bc-book-studio-runtime
expected_volume=bc-book-studio-runtime_bookstudio_pg
existing_db=$(docker ps -q --no-trunc --filter "name=^/bc-book-studio-runtime-db-1$" --filter "status=running")
[[ -n "$existing_db" ]] || { echo 'Existing production database container is not running'; exit 2; }
actual_project=$(docker inspect "$existing_db" --format '{{index .Config.Labels "com.docker.compose.project"}}')
actual_workdir=$(docker inspect "$existing_db" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')
[[ "$actual_project" == "$expected_project" && "$actual_workdir" == "/opt/bc-book-studio-runtime/source" ]] || { echo 'Database Compose identity mismatch'; exit 2; }
docker inspect "$existing_db" --format '{{range .Mounts}}{{println .Name}}{{end}}' | grep -qxF "$expected_volume" || { echo 'Existing production database volume mismatch'; exit 2; }
[[ -f compose.resources.yml ]] || { echo 'Existing database resource Compose file missing'; exit 2; }
# The active database uses compose.resources.yml; include it to preserve volume bindings.
"${compose[@]}" config --quiet
resolved_db=$("${compose[@]}" ps -q db)
[[ -n "$resolved_db" && "$resolved_db" == "$existing_db" ]] || { echo 'Compose resolves to a different database container'; exit 2; }
ACCESS_MODE="${BC_BOOK_STUDIO_ACCESS_MODE:-access}"
case "$ACCESS_MODE" in
  access|public) ;;
  *) echo "Invalid BC_BOOK_STUDIO_ACCESS_MODE: use access or public"; exit 2 ;;
esac
if [[ "$ACCESS_MODE" == access ]]; then
: "${BC_BOOK_STUDIO_EXPECTED_AUD:?Set the production Access application AUD}"
"${compose[@]}" config --format json | python3 -c '
import json,re,sys
env=json.load(sys.stdin)["services"]["web"]["environment"]
assert re.fullmatch(r"https://[a-z0-9-]+[.]cloudflareaccess[.]com",env.get("CF_ACCESS_TEAM_DOMAIN","")), "Missing/invalid beta Access team domain"
assert env.get("CF_ACCESS_AUD")==sys.argv[1], "Access AUD does not match the target application"
assert len(env.get("STUDIO_REVIEWER_API_KEY",""))>=24, "Missing separate reviewer credential"
print("PASS target Access configuration and reviewer credential")
' "$BC_BOOK_STUDIO_EXPECTED_AUD"
else
echo 'WARN ACCESS_MODE=public: Cloudflare Access check skipped by explicit operator choice'
"${compose[@]}" config --format json | python3 -c '
import json,sys
env=json.load(sys.stdin)["services"]["web"]["environment"]
aud=(env.get("CF_ACCESS_AUD") or "").strip()
team=(env.get("CF_ACCESS_TEAM_DOMAIN") or "").strip()
if aud or team:
    print("WARN CF_ACCESS_AUD and/or CF_ACCESS_TEAM_DOMAIN are set while ACCESS_MODE=public; Access checks are still skipped")
assert len(env.get("STUDIO_REVIEWER_API_KEY",""))>=24, "Missing separate reviewer credential"
print("PASS public mode reviewer credential")
'
fi
web=$("${compose[@]}" ps -q web)
db=$("${compose[@]}" ps -q db)
[[ -n "$web" && -n "$db" ]] || { echo 'Existing web/database not found; no changes made'; exit 2; }
previous=$(docker inspect "$web" --format '{{.Image}}')
docker ps --format '{{.ID}} {{.Names}} {{.Status}}'
free -m
df -h .
docker pull "$BC_BOOK_STUDIO_IMAGE"
docker pull "$BC_BOOK_STUDIO_MIGRATOR_IMAGE"
revision=$(docker image inspect "$BC_BOOK_STUDIO_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
[[ "$revision" == "$BC_BOOK_STUDIO_VERIFIED_SHA" ]] || { echo 'Image revision does not match selected CI commit'; exit 2; }
migration_revision=$(docker image inspect "$BC_BOOK_STUDIO_MIGRATOR_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
[[ "$migration_revision" == "$revision" ]] || { echo 'Migrator/runtime source revisions differ'; exit 2; }
# Never modify the schema implicitly. Pending migrations block the switch.
"${compose[@]}" --profile release run --rm --no-deps migrate migrate status
if [[ "$mode" == --check ]]; then
  echo 'Preflight passed. No application container, database schema, DNS or Access policy changed.'
  exit 0
fi
umask 077
mkdir -p backups/release
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="backups/release/$stamp.dump"
"${compose[@]}" exec -T db pg_dump -U bookstudio -d bookstudio -Fc > "$backup"
test -s "$backup"
"${compose[@]}" exec -T db pg_restore --list < "$backup" >/dev/null
printf '%s\n' "$previous" > "backups/release/$stamp.previous-image"
healthy() { curl -fsS --max-time 3 http://127.0.0.1:3100/api/health >/dev/null; }
rollback() {
  echo 'Web verification failed; restoring the previous web image. Database is unchanged.'
  BC_BOOK_STUDIO_IMAGE="$previous" "${compose[@]}" up -d --no-deps --no-build --pull never web
}
if ! "${compose[@]}" up -d --no-deps --no-build --pull never web; then rollback; exit 1; fi
ok=0
for i in $(seq 1 30); do if healthy; then ok=1; break; fi; sleep 2; done
if [[ "$ok" != 1 ]]; then rollback; exit 1; fi
code=$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/books)
if [[ "$code" != 401 ]]; then rollback; exit 1; fi
if ! curl -fsS --max-time 10 http://127.0.0.1:3100/ >/dev/null; then rollback; exit 1; fi
docker ps --format '{{.ID}} {{.Names}} {{.Status}}'
free -m
df -h .
echo "PASS web deployment, anonymous API rejection; backup: $backup"
echo 'Cloudflare Access and other applications are unchanged. Confirm a real user session before public release.'
