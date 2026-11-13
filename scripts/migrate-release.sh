#!/usr/bin/env bash
# Run from the existing BC Book Studio Compose directory on the VPS.
# Applies pending Prisma migrations only in --apply, after a custom-format
# backup. Never uses prisma db push, db reset, or direct writes to
# _prisma_migrations.
set -euo pipefail
umask 077
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
[[ ! -f compose.smtp-relay.yml ]] || compose+=(-f compose.smtp-relay.yml)
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
db=$("${compose[@]}" ps -q db)
[[ -n "$db" ]] || { echo 'Existing database not found; no changes made'; exit 2; }
docker ps --format '{{.ID}} {{.Names}} {{.Status}}'
free -m
df -h .
docker pull "$BC_BOOK_STUDIO_IMAGE"
docker pull "$BC_BOOK_STUDIO_MIGRATOR_IMAGE"
revision=$(docker image inspect "$BC_BOOK_STUDIO_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
[[ "$revision" == "$BC_BOOK_STUDIO_VERIFIED_SHA" ]] || { echo 'Image revision does not match selected CI commit'; exit 2; }
migration_revision=$(docker image inspect "$BC_BOOK_STUDIO_MIGRATOR_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
[[ "$migration_revision" == "$revision" ]] || { echo 'Migrator/runtime source revisions differ'; exit 2; }

run_migrate_status() {
  "${compose[@]}" --profile release run --rm --no-deps migrate migrate status
}

if [[ "$mode" == --check ]]; then
  set +e
  status_out="$(run_migrate_status 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$status_out"
  if [[ "$status" -eq 0 ]]; then
    echo 'migrate status: database matches the migrator image. No backup or schema changes were made.'
    exit 0
  fi
  if printf '%s\n' "$status_out" | grep -Eqi 'not yet been applied|have not yet been applied|following migrations? have not yet been applied'; then
    echo 'Pending migrations are listed above. --check does not take a backup or apply schema changes.'
    echo 'Run --apply during an approved maintenance window to back up and apply them.'
    exit 0
  fi
  echo 'migrate status failed for a reason other than pending migrations. No backup or schema changes were made.'
  exit "$status"
fi

mkdir -p backups/release
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="backups/release/${stamp}.pre-migrate.dump"
"${compose[@]}" exec -T db pg_dump -U bookstudio -d bookstudio -Fc > "$backup"
test -s "$backup"
"${compose[@]}" exec -T db pg_restore --list < "$backup" >/dev/null
printf '%s\n' "$backup" > "backups/release/${stamp}.pre-migrate.path"
echo "Backup recorded at: $backup"
echo "Record file: backups/release/${stamp}.pre-migrate.path"

"${compose[@]}" --profile release run --rm --no-deps migrate migrate deploy
run_migrate_status

echo "PASS migrations applied. Backup for this change: $backup"
echo 'Database rollback is not automatic. To roll back, restore that custom-format dump into the bookstudio database during a maintenance window (pg_restore), then confirm migrate status and application health. Do not edit _prisma_migrations by hand.'
