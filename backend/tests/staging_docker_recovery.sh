#!/usr/bin/env bash
set -euo pipefail
export COMPOSE_PROJECT_NAME="bc-studio-ci-${GITHUB_RUN_ID:-local}"
compose=(docker compose -p "$COMPOSE_PROJECT_NAME" -f compose.staging.yml)
stamp() { printf '%s | %s\n' "$(date -u +%FT%TZ)" "$*"; }
check() { stamp "RUN: $*"; "$@"; stamp "PASS: $*"; }
trap 'stamp "Container status"; "${compose[@]}" ps -a || true; stamp "Sanitized service status"; "${compose[@]}" ps --format json || true' EXIT

stamp "Build and launch complete isolated staging stack"
check "${compose[@]}" up -d --build --wait --wait-timeout 180
stamp "Verify audit-init completion, worker nonroot identity and volume permission"
check "${compose[@]}" ps -a
check "${compose[@]}" exec -T worker python -c "import os,stat; p='/var/lib/bc-book-studio/audit'; assert os.getuid()==10001,os.getuid(); assert os.stat(p).st_uid==10001; assert stat.S_IMODE(os.stat(p).st_mode)==0o700"
check "${compose[@]}" exec -T worker python -c "from app.audit_events import record_event,has_event; record_event('docker-test-job','job_created',event_id='docker-created'); assert has_event('docker-created')"
check "${compose[@]}" exec -T worker python -c "import sqlite3,os; p=os.environ['STUDIO_AUDIT_DB']; d=sqlite3.connect(p); assert d.execute('pragma integrity_check').fetchone()[0]=='ok'; assert d.execute('select count(*) from job_events where event_id=?',('docker-created',)).fetchone()[0]==1; print('SQLITE_WAL_OK')"
stamp "Seed Redis AOF and outbox; seed PostgreSQL staging"
check "${compose[@]}" exec -T redis redis-cli SET docker:marker persistent
check "${compose[@]}" exec -T redis redis-cli HSET studio:audit:outbox docker-outbox '{"event_id":"docker-outbox","job_id":"docker-test-job","event_type":"job_claimed","status":"processing"}'
check "${compose[@]}" exec -T redis redis-cli BGREWRITEAOF
check "${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U studio -d studio -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS docker_persistence_test (id text PRIMARY KEY);" -c "INSERT INTO docker_persistence_test VALUES ('"'"'persisted'"'"') ON CONFLICT DO NOTHING;"'
stamp "Recreate worker with existing named audit volume"
check "${compose[@]}" stop worker
check "${compose[@]}" rm -f worker
check "${compose[@]}" up -d --no-deps worker
check "${compose[@]}" exec -T worker python -c "from app.audit_events import has_event; assert has_event('docker-created'); print('SQLITE_AFTER_WORKER_RECREATE_OK')"
stamp "Recreate Redis container with same named AOF volume"
check "${compose[@]}" stop redis
check "${compose[@]}" rm -f redis
check "${compose[@]}" up -d --no-deps redis
for i in $(seq 1 30); do if "${compose[@]}" exec -T redis redis-cli ping | grep -q PONG; then break; fi; sleep 2; done
check "${compose[@]}" exec -T redis sh -c 'test "$(redis-cli GET docker:marker)" = persistent && test "$(redis-cli HEXISTS studio:audit:outbox docker-outbox)" = 1'
stamp "Recreate PostgreSQL container with same named volume"
check "${compose[@]}" stop postgres
check "${compose[@]}" rm -f postgres
check "${compose[@]}" up -d --no-deps postgres
for i in $(seq 1 30); do if "${compose[@]}" exec -T postgres pg_isready -U studio -d studio >/dev/null; then break; fi; sleep 2; done
check "${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U studio -d studio -Atqc "SELECT id FROM docker_persistence_test WHERE id='"'"'persisted'"'"'" | grep -qx persisted'
stamp "Reconcile Redis outbox into durable SQLite"
check "${compose[@]}" exec -T worker python -c "import asyncio,redis.asyncio as redis; from app.worker import reconcile_audit; from app.audit_events import has_event; async def_main=''; exec('async def main():\\n c=redis.from_url(\"redis://redis:6379/0\",decode_responses=True)\\n await reconcile_audit(c)\\n await reconcile_audit(c)\\n assert not await c.hexists(\"studio:audit:outbox\",\"docker-outbox\")\\n await c.aclose()'); asyncio.run(locals()['main']()); assert has_event('docker-outbox'); print('OUTBOX_RECONCILED_OK')"
stamp "All isolated Docker volume recovery assertions passed"
