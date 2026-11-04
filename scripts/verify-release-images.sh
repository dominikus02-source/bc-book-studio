#!/usr/bin/env bash
set -euo pipefail
: "${WEB_IMAGE:?Required}" "${MIGRATOR_IMAGE:?Required}"
db='postgresql://bookstudio:ci-only-password@127.0.0.1:5432/bookstudio_release_ci?schema=public'
# GitHub's ephemeral PostgreSQL service; never a production database.
docker run --rm --network host -e DATABASE_URL="$db" "$MIGRATOR_IMAGE" migrate deploy
docker run --rm --network host -e DATABASE_URL="$db" "$MIGRATOR_IMAGE" migrate status
name="bookstudio-release-smoke-$RANDOM"
page_file=$(mktemp)
cleanup() { docker logs "$name" || true; docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$page_file"; }
trap cleanup EXIT
docker run -d --name "$name" --network host -e PORT=3184 -e DATABASE_URL="$db" "$WEB_IMAGE"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3184/api/health >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3184/api/health
curl -fsS http://127.0.0.1:3184/ -o "$page_file"
grep -q 'BC Book Studio' "$page_file"
test "$(docker exec "$name" id -u)" != 0
for header in 'x-smoke: anonymous' 'cf-access-authenticated-user-email: fake@example.com' 'cf-access-jwt-assertion: invalid.jwt.token'; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -H "$header" http://127.0.0.1:3184/api/books)
  test "$code" = 401
done
# A real query detects missing Prisma clients/native engines in standalone output.
docker exec "$name" node -e 'const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();db.book.count().then(n=>console.log("Prisma runtime query PASS:",n)).finally(()=>db.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1})'
docker image inspect "$WEB_IMAGE" --format 'Runtime image bytes: {{.Size}}'
echo 'PASS: migrations, non-root runtime, homepage, database engine and unauthorized API checks'
