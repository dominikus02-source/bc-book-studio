"""At-least-once Redis worker with fenced leases and idempotent final result.

Redis must be configured with durable persistence for restart guarantees.
"""
import asyncio
import json
import os
import re
import time
import uuid
import redis.asyncio as redis
from .ai import complete
from .agents.chief_editor import prepare_draft
from .audit_events import record_event

PENDING, PROCESSING, DEAD = "studio:pending", "studio:processing", "studio:dead"
LEASE_SECONDS = 120
MAX_ATTEMPTS = 3

CLAIM = """
local raw = redis.call('RPOPLPUSH', KEYS[1], KEYS[2])
if not raw then return nil end
local ok, task = pcall(cjson.decode, raw)
if not ok or type(task) ~= 'table' or type(task.id) ~= 'string' or not string.match(task.id, '^[%w_%-]+$') then
  redis.call('LREM', KEYS[2], 1, raw)
  redis.call('LPUSH', KEYS[3], raw)
  return {'invalid', raw}
end
local id = task.id
local result = 'studio:result:' .. id
local lock = 'studio:lease:' .. id
if redis.call('HGET', result, 'status') == 'waiting_approval' then
  redis.call('LREM', KEYS[2], 1, raw)
  return {'completed', id}
end
if redis.call('EXISTS', lock) == 1 then
  redis.call('LREM', KEYS[2], 1, raw)
  return {'duplicate', id}
end
local attempts = redis.call('HINCRBY', 'studio:attempts', id, 1)
if attempts > tonumber(ARGV[3]) then
  redis.call('LREM', KEYS[2], 1, raw)
  redis.call('LPUSH', KEYS[3], raw)
  return {'exhausted', id}
end
redis.call('SET', lock, ARGV[1], 'EX', ARGV[2])
redis.call('HSET', 'studio:inflight:' .. id, 'worker', ARGV[4], 'started_at', ARGV[5], 'token', ARGV[1], 'raw', raw, 'attempt', attempts)
return {'claimed', raw, id, tostring(attempts)}
"""

FINISH = """
local id = ARGV[1]
local lock = 'studio:lease:' .. id
if redis.call('GET', lock) ~= ARGV[2] then return 'stale' end
local key = 'studio:result:' .. id
if redis.call('HGET', key, 'status') ~= 'waiting_approval' then
  redis.call('HSET', key, 'status', 'waiting_approval', 'content', ARGV[4], 'execution', ARGV[5])
end
redis.call('LREM', KEYS[1], 1, ARGV[3])
redis.call('DEL', lock, 'studio:inflight:' .. id)
return 'committed'
"""

RENEW = """
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
"""

FAIL = """
local lock = 'studio:lease:' .. ARGV[1]
if redis.call('GET', lock) ~= ARGV[2] then return 'stale' end
redis.call('LREM', KEYS[1], 1, ARGV[3])
if tonumber(ARGV[4]) >= tonumber(ARGV[5]) then
  redis.call('LPUSH', KEYS[3], ARGV[3])
else
  redis.call('LPUSH', KEYS[2], ARGV[3])
end
redis.call('DEL', lock, 'studio:inflight:' .. ARGV[1])
return 'requeued'
"""

RECLAIM = """
local raw = ARGV[1]
local ok, task = pcall(cjson.decode, raw)
if not ok or type(task) ~= 'table' or type(task.id) ~= 'string' then
  redis.call('LREM', KEYS[1], 1, raw)
  redis.call('LPUSH', KEYS[3], raw)
  return 'invalid'
end
local id = task.id
if redis.call('EXISTS', 'studio:lease:' .. id) == 1 then return 'active' end
local meta = 'studio:inflight:' .. id
local started = tonumber(redis.call('HGET', meta, 'started_at') or '0')
if started > 0 and tonumber(ARGV[2]) - started < tonumber(ARGV[3]) then return 'grace' end
if redis.call('LREM', KEYS[1], 1, raw) == 0 then return 'gone' end
if redis.call('HGET', 'studio:result:' .. id, 'status') == 'waiting_approval' then
  redis.call('DEL', meta)
  return 'completed'
end
local attempts = tonumber(redis.call('HGET', 'studio:attempts', id) or '0')
if attempts >= tonumber(ARGV[4]) then
  redis.call('LPUSH', KEYS[3], raw)
  redis.call('DEL', meta)
  return 'dead'
end
redis.call('LPUSH', KEYS[2], raw)
redis.call('DEL', meta)
return 'recovered'
"""

def validate_task(raw):
    task = json.loads(raw)
    if not isinstance(task, dict):
        raise ValueError("Payload harus objek")
    task_id = task.get("id")
    if not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", task_id):
        raise ValueError("ID tugas tidak valid")
    for key, maximum in (("topic", 250), ("grade", 20), ("objectives", 2000)):
        if not isinstance(task.get(key), str) or not 1 <= len(task[key]) <= maximum:
            raise ValueError("Kolom tugas tidak valid: " + key)
    if task.get("category", "writing") not in ("writing", "assessment", "illustration", "publishing", "integration"):
        raise ValueError("Kategori tidak dikenal")
    return task

async def process_task(client, raw):
    """Backward-compatible direct helper; production must use fenced process_claim."""
    task = validate_task(raw)
    if await client.hget("studio:result:" + task["id"], "status") == "waiting_approval":
        return task["id"]
    system, prompt, metadata = prepare_draft(task["topic"], task["grade"], task["objectives"], task.get("category", "writing"))
    result = await complete(system, prompt, provider=task.get("provider", "deepseek"))
    if not isinstance(result.get("content"), str) or not result["content"].strip():
        raise ValueError("Respons AI kosong")
    await client.hset("studio:result:" + task["id"], mapping={
        "status": "waiting_approval", "content": result["content"],
        "execution": json.dumps({**metadata, "provider": result["provider"], "model": result["model"]}, ensure_ascii=False)})
    return task["id"]

async def claim(client, worker_id):
    token = uuid.uuid4().hex
    result = await client.eval(CLAIM, 3, PENDING, PROCESSING, DEAD, token,
                               LEASE_SECONDS, MAX_ATTEMPTS, worker_id, time.time())
    if result and result[0] == "claimed":
        return result[1], result[2], token, int(result[3])
    return None

async def heartbeat(client, job_id, token, stop):
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=LEASE_SECONDS / 3)
        except asyncio.TimeoutError:
            if not await client.eval(RENEW, 1, "studio:lease:" + job_id, token, LEASE_SECONDS):
                return

async def process_claim(client, claim_data, worker_id):
    raw, job_id, token, attempt = claim_data
    started = time.monotonic()
    stop = asyncio.Event()
    pulse = asyncio.create_task(heartbeat(client, job_id, token, stop))
    metadata = {}
    try:
        task = validate_task(raw)
        system, prompt, metadata = prepare_draft(task["topic"], task["grade"], task["objectives"], task.get("category", "writing"))
        record_event(job_id, "started", worker_id=worker_id, attempt=attempt, metadata=metadata, status="processing")
        result = await complete(system, prompt, provider=task.get("provider", "deepseek"))
        if not isinstance(result.get("content"), str) or not result["content"].strip():
            raise ValueError("Respons AI kosong")
        metadata.update(provider=result["provider"], model=result["model"])
        execution = json.dumps(metadata, ensure_ascii=False)
        state = await client.eval(FINISH, 1, PROCESSING, job_id, token, raw, result["content"], execution)
        if state == "committed":
            record_event(job_id, "completed", worker_id=worker_id, attempt=attempt, metadata=metadata,
                         status="waiting_approval", output_ref="studio:result:" + job_id,
                         duration_ms=int((time.monotonic()-started)*1000))
        else:
            record_event(job_id, "stale_result_rejected", worker_id=worker_id, attempt=attempt, metadata=metadata, status="stale")
        return state
    except Exception as exc:
        category = type(exc).__name__
        state = await client.eval(FAIL, 3, PROCESSING, PENDING, DEAD, job_id, token, raw, attempt, MAX_ATTEMPTS)
        record_event(job_id, "failed", worker_id=worker_id, attempt=attempt, metadata=metadata,
                     status=state, error_category=category, duration_ms=int((time.monotonic()-started)*1000))
        return state
    finally:
        stop.set()
        await pulse

async def reclaim(client):
    states = []
    for raw in await client.lrange(PROCESSING, 0, -1):
        state = await client.eval(RECLAIM, 3, PROCESSING, PENDING, DEAD, raw, time.time(),
                                  LEASE_SECONDS, MAX_ATTEMPTS)
        states.append(state)
        if state in ("recovered", "dead", "completed"):
            try:
                job_id = validate_task(raw)["id"]
                record_event(job_id, state, status=state)
            except ValueError:
                pass
    return states

async def run():
    worker_id = uuid.uuid4().hex
    client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)
    try:
        while True:
            await reclaim(client)
            item = await claim(client, worker_id)
            if item:
                await process_claim(client, item, worker_id)
            else:
                await asyncio.sleep(1)
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run())
