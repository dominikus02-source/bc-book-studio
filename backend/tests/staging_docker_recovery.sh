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
for service in worker redis postgres; do
  container_id=$("${compose[@]}" ps -q "$service")
  stamp "Inspect persistent mount for $service"
  docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}:{{.Destination}}{{println}}{{end}}{{end}}' "$container_id" | grep -F "${COMPOSE_PROJECT_NAME}_" >/dev/null
done
check "${compose[@]}" ps -a
check "${compose[@]}" exec -T worker python -c "import os,stat; p='/var/lib/bc-book-studio/audit'; assert os.getuid()==10001,os.getuid(); assert os.stat(p).st_uid==10001; assert stat.S_IMODE(os.stat(p).st_mode)==0o700"
check "${compose[@]}" exec -T worker python -c "from app.audit_events import record_event,has_event; record_event('docker-test-job','job_created',event_id='docker-created'); assert has_event('docker-created')"
check "${compose[@]}" exec -T worker python -c "import sqlite3,os; p=os.environ['STUDIO_AUDIT_DB']; d=sqlite3.connect(p); assert d.execute('pragma integrity_check').fetchone()[0]=='ok'; assert d.execute('select count(*) from job_events where event_id=?',('docker-created',)).fetchone()[0]==1; print('SQLITE_WAL_OK')"
stamp "Seed Redis AOF and PostgreSQL staging marker"
check "${compose[@]}" exec -T redis redis-cli SET docker:marker persistent
check "${compose[@]}" exec -T redis redis-cli BGREWRITEAOF
check "${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U studio -d studio -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS docker_persistence_test (id text PRIMARY KEY);" -c "INSERT INTO docker_persistence_test VALUES ('"'"'persisted'"'"') ON CONFLICT DO NOTHING;"'
stamp "Recreate worker with existing named audit volume"
check "${compose[@]}" stop worker
check "${compose[@]}" rm -f worker
check "${compose[@]}" up -d --no-deps worker
check "${compose[@]}" exec -T worker python -c "from app.audit_events import has_event; assert has_event('docker-created'); print('SQLITE_AFTER_WORKER_RECREATE_OK')"
stamp "Stop worker before seeding outbox so its reconciler cannot consume test evidence"
check "${compose[@]}" stop worker
check "${compose[@]}" exec -T redis redis-cli HSET studio:audit:outbox docker-outbox '{"event_id":"docker-outbox","job_id":"docker-test-job","event_type":"job_claimed","status":"processing"}'
check "${compose[@]}" exec -T redis redis-cli BGREWRITEAOF
stamp "Recreate Redis container with same named AOF volume"
check "${compose[@]}" stop redis
check "${compose[@]}" rm -f redis
check "${compose[@]}" up -d --no-deps redis
stamp "Poll Redis Docker health (60s max), then PING; do not conflate readiness with data loss"
redis_ready=0
for i in $(seq 1 30); do
  health=$(docker inspect --format '{{.State.Health.Status}}' "$("${compose[@]}" ps -q redis)" 2>/dev/null || true)
  if [[ "$health" == healthy ]] && "${compose[@]}" exec -T redis redis-cli ping | grep -qx PONG; then redis_ready=1; break; fi
  sleep 2
done
if [[ "$redis_ready" != 1 ]]; then
  stamp "FAIL Redis health timeout; showing status and limited sanitized logs"
  "${compose[@]}" ps -a
  "${compose[@]}" logs --tail=35 redis | sed -E 's/(password|token|secret|key)=([^ ]+)/\\1=[REDACTED]/Ig' || true
  exit 1
fi
stamp "Redis healthy and responding to PING"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$("${compose[@]}" ps -q redis)" | grep -Fx "${COMPOSE_PROJECT_NAME}_redis_data"
check "${compose[@]}" exec -T redis sh -ec 'test "$(redis-cli GET docker:marker)" = persistent; test "$(redis-cli HEXISTS studio:audit:outbox docker-outbox)" = 1; test "$(redis-cli HGET studio:audit:outbox docker-outbox)" = "{\"event_id\":\"docker-outbox\",\"job_id\":\"docker-test-job\",\"event_type\":\"job_claimed\",\"status\":\"processing\"}"'
stamp "Redis AOF marker and full outbox payload retained"
stamp "Recreate PostgreSQL container with same named volume"
check "${compose[@]}" stop postgres
check "${compose[@]}" rm -f postgres
check "${compose[@]}" up -d --no-deps postgres
postgres_ready=0
for i in $(seq 1 30); do
  health=$(docker inspect --format '{{.State.Health.Status}}' "$("${compose[@]}" ps -q postgres)" 2>/dev/null || true)
  if [[ "$health" == healthy ]] && "${compose[@]}" exec -T postgres pg_isready -U studio -d studio >/dev/null; then postgres_ready=1; break; fi
  sleep 2
done
if [[ "$postgres_ready" != 1 ]]; then stamp "FAIL PostgreSQL readiness timeout"; "${compose[@]}" ps -a; exit 1; fi
check "${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U studio -d studio -Atqc "SELECT id FROM docker_persistence_test WHERE id='"'"'persisted'"'"'" | grep -qx persisted'
stamp "PostgreSQL persisted marker verified after recreate"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$("${compose[@]}" ps -q postgres)" | grep -Fx "${COMPOSE_PROJECT_NAME}_postgres_data"
stamp "Negative control: an unrelated fresh named volume must NOT contain the audit event"
negative_volume="${COMPOSE_PROJECT_NAME}_negative_audit"
docker volume create "$negative_volume" >/dev/null
docker run --rm -v "$negative_volume:/audit:ro" alpine:3.20 sh -ec 'test -d /audit; test -z "$(ls -A /audit)"'
stamp "PASS negative control: fresh volume is empty"
stamp "Reconcile Redis outbox into durable SQLite while worker remains stopped"
check "${compose[@]}" run --rm --no-deps worker python -c "import asyncio,redis.asyncio as redis; from app.worker import reconcile_audit; from app.audit_events import has_event; url='redis://redis:6379/0'; assert asyncio.run(reconcile_audit(redis.from_url(url,decode_responses=True)))>=1; assert asyncio.run(reconcile_audit(redis.from_url(url,decode_responses=True)))==0; assert has_event('docker-outbox'); print('OUTBOX_RECONCILED_OK')"
stamp "Restart worker after outbox reconciliation"
check "${compose[@]}" up -d --no-deps worker
stamp "SIGKILL an active claimed worker and prove lease-expiry recovery without duplicate result"
check "${compose[@]}" stop worker
sigkill_container="${COMPOSE_PROJECT_NAME}-sigkill-probe"
docker rm -f "$sigkill_container" >/dev/null 2>&1 || true
check "${compose[@]}" exec -T redis redis-cli LPUSH studio:pending '{"id":"sigkill-recovery-test","topic":"Recovery test","grade":"VII","objectives":"Verify fenced recovery"}'
check "${compose[@]}" run -d --name "$sigkill_container" --no-deps worker python -c "import asyncio, time, redis.asyncio as redis; from app.worker import claim; c=redis.from_url('redis://redis:6379/0',decode_responses=True); item=asyncio.run(claim(c,'sigkill-probe')); assert item and item[1]=='sigkill-recovery-test',item; print('ACTIVE_CLAIMED',flush=True); time.sleep(300)"
sigkill_claimed=0
for i in $(seq 1 30); do
  if [[ "$("${compose[@]}" exec -T redis redis-cli HGET studio:inflight:sigkill-recovery-test worker)" == sigkill-probe ]]; then sigkill_claimed=1; break; fi
  sleep 1
done
if [[ "$sigkill_claimed" != 1 ]]; then stamp "FAIL active SIGKILL probe did not claim job"; exit 1; fi
check docker kill --signal=SIGKILL "$sigkill_container"
check docker rm "$sigkill_container"
stamp "Simulate lease expiration without waiting 120 seconds (real worker was SIGKILLed)"
check "${compose[@]}" exec -T redis redis-cli DEL studio:lease:sigkill-recovery-test
check "${compose[@]}" run --rm --no-deps worker python -c "import asyncio,redis.asyncio as redis; from app.worker import reclaim,claim,PENDING,PROCESSING; c=redis.from_url('redis://redis:6379/0',decode_responses=True); assert 'recovered' in asyncio.run(reclaim(c)); assert asyncio.run(c.llen(PROCESSING))==0; assert asyncio.run(c.llen(PENDING))==1; item=asyncio.run(claim(c,'recovery-probe')); assert item and item[1]=='sigkill-recovery-test' and item[3]==2,item; assert asyncio.run(c.llen(PENDING))==0; assert asyncio.run(c.llen(PROCESSING))==1; print('SIGKILL_RECLAIM_AND_SINGLE_RECLAIMED_CLAIM_OK')"
stamp "SIGKILL recovery assertions passed; no duplicate queue entry"
stamp "All isolated Docker volume recovery assertions passed"
