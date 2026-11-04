"""Real subprocess crash tests; require isolated Redis (TEST_REDIS_URL).

Provider is replaced ONLY for reliability tests, never for AI quality evaluation.
"""
import asyncio
import json
import os
import signal
import sqlite3
import subprocess
import sys
import time
import queue
import threading
from pathlib import Path

import pytest
import redis.asyncio as redis

from app.worker import PENDING, PROCESSING, DEAD, claim, reclaim, process_claim, reconcile_audit

ROOT = Path(__file__).resolve().parents[2]
URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")
CHILD = r"""
import asyncio, json, os, sys, time
import redis.asyncio as redis
from app import worker
async def main():
    client = redis.from_url(os.environ['TEST_REDIS_URL'], decode_responses=True)
    item = await worker.claim(client, os.environ.get('TEST_WORKER_ID','child'))
    print('CLAIMED' if item else 'EMPTY', flush=True)
    if not item: return
    phase = os.environ['CRASH_PHASE']
    if phase == 'claim':
        await asyncio.sleep(120)
        return
    async def fake_complete(system, prompt, provider):
        print('PROVIDER_STARTED', flush=True)
        if phase == 'provider': await asyncio.sleep(120)
        if phase == 'provider_delay': await asyncio.sleep(3)
        print('PROVIDER_COMPLETED', flush=True)
        if phase in ('after_provider','before_save'): await asyncio.sleep(120)
        return {'content':'draft', 'provider':'test-double', 'model':'reliability-only'}
    worker.complete = fake_complete
    if phase == 'after_finish':
        original = worker.reconcile_audit
        async def halt(client):
            print('REDIS_COMMITTED', flush=True)
            await asyncio.sleep(120)
        worker.reconcile_audit = halt
    await worker.process_claim(client, item, 'child')
asyncio.run(main())
"""

def run(coro):
    return asyncio.run(coro)

def task(job_id):
    return json.dumps({"id":job_id,"topic":"Teks deskripsi","grade":"VII","objectives":"Menulis deskripsi","category":"writing"})

@pytest.fixture
def environment(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_AUDIT_DB", str(tmp_path / "audit.sqlite3"))
    async def clear():
        c = redis.from_url(URL, decode_responses=True)
        try:
            await c.ping()
        except Exception:
            pytest.skip("isolated Redis unavailable")
        await c.flushdb()
        await c.aclose()
    run(clear())
    yield tmp_path

def child(phase, env):
    variables = {**os.environ, "TEST_REDIS_URL":URL,"CRASH_PHASE":phase,
                 "STUDIO_AUDIT_DB":str(env/"audit.sqlite3"), "PYTHONPATH":str(ROOT/"backend")}
    return subprocess.Popen([sys.executable,"-u","-c",CHILD],env=variables,
                            stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)

def until_line(proc, expected):
    q = queue.Queue()
    def reader():
        for line in proc.stdout:
            q.put(line.strip())
    threading.Thread(target=reader, daemon=True).start()
    deadline = time.monotonic()+15
    while time.monotonic()<deadline:
        try:
            line = q.get(timeout=0.2)
        except queue.Empty:
            if proc.poll() is not None:
                raise AssertionError("child exited: "+proc.stderr.read())
            continue
        if line == expected:
            return
    raise AssertionError("missing child marker "+expected)

def kill(proc):
    proc.kill()  # SIGKILL on Linux CI, not a Redis key deletion
    proc.wait(timeout=8)
    assert proc.returncode == -signal.SIGKILL

async def expire_for_test(client, job_id):
    # accelerate expiry for deterministic test; the PROCESS itself was SIGKILLed.
    await client.delete("studio:lease:"+job_id)
    await client.hset("studio:inflight:"+job_id, "started_at", time.time()-300)

@pytest.mark.parametrize("phase,marker",[
    ("claim","CLAIMED"),
    ("provider","PROVIDER_STARTED"),
    ("after_provider","PROVIDER_COMPLETED"),
    ("before_save","PROVIDER_COMPLETED"),
    ("after_finish","REDIS_COMMITTED"),
])
def test_sigkill_recovery(environment,phase,marker):
    async def seed():
        c=redis.from_url(URL,decode_responses=True)
        await c.lpush(PENDING,task("crash_"+phase))
        await c.aclose()
    run(seed())
    proc=child(phase,environment)
    try:
        until_line(proc,marker)
        kill(proc)
    finally:
        if proc.poll() is None: proc.kill()
    async def verify():
        c=redis.from_url(URL,decode_responses=True)
        jid="crash_"+phase
        assert await c.llen(PENDING)+await c.llen(PROCESSING) <= 1
        if phase=="after_finish":
            assert await c.hget("studio:result:"+jid,"status")=="waiting_approval"
            assert await c.llen(PROCESSING)==0
            assert await c.hlen("studio:audit:outbox")>=1
            assert await reconcile_audit(c)>=1
            assert await reconcile_audit(c)==0
            assert await c.hlen("studio:audit:outbox")==0
            assert await c.hget("studio:result:"+jid,"content")=="draft"
        else:
            assert await c.llen(PROCESSING)==1
            await expire_for_test(c,jid)
            assert await reclaim(c)==["recovered"]
            assert await c.llen(PENDING)==1
            item=await claim(c,"recovery")
            assert item and item[3]==2
            from unittest.mock import AsyncMock,patch
            with patch("app.worker.complete",new_callable=AsyncMock,
                       return_value={"content":"recovered","provider":"test-double","model":"reliability-only"}) as model:
                assert await process_claim(c,item,"recovery")=="committed"
                assert model.await_count==1
            assert await c.hget("studio:result:"+jid,"content")=="recovered"
        assert await c.llen(PROCESSING)==0
        assert await c.llen(DEAD)==0
        assert await c.hlen("studio:result:"+jid)>0
        await c.aclose()
    run(verify())
    with sqlite3.connect(environment/"audit.sqlite3") as db:
        assert db.execute("select count(*) from job_events where job_id=?",("crash_"+phase,)).fetchone()[0]>=1

def test_two_workers_compete(environment):
    async def scenario():
        c=redis.from_url(URL,decode_responses=True)
        await c.lpush(PENDING,task("competition"))
        results=await asyncio.gather(claim(c,"w1"),claim(c,"w2"))
        assert sum(bool(r) for r in results)==1
        assert await c.llen(PROCESSING)==1
        assert await c.hget("studio:attempts","competition")=="1"
        await c.aclose()
    run(scenario())


def test_two_real_worker_processes(environment):
    async def seed():
        c=redis.from_url(URL,decode_responses=True)
        await c.lpush(PENDING,task("two_processes"))
        await c.aclose()
    run(seed())
    first=child("claim",environment)
    second=None
    try:
        until_line(first,"CLAIMED")
        second=child("claim",environment)
        until_line(second,"EMPTY")
        second.wait(timeout=8)
        assert second.returncode==0
        async def verify():
            c=redis.from_url(URL,decode_responses=True)
            assert await c.llen(PROCESSING)==1
            assert await c.hget("studio:attempts","two_processes")=="1"
            await c.aclose()
        run(verify())
        kill(first)
    finally:
        if first.poll() is None: first.kill()
        if second is not None and second.poll() is None: second.kill()


def test_expired_lease_while_original_process_alive(environment):
    async def seed():
        c=redis.from_url(URL,decode_responses=True)
        await c.lpush(PENDING,task("live_stale"))
        await c.aclose()
    run(seed())
    first=child("provider_delay",environment)
    try:
        until_line(first,"PROVIDER_STARTED")
        async def replace():
            c=redis.from_url(URL,decode_responses=True)
            await expire_for_test(c,"live_stale")
            assert await reclaim(c)==["recovered"]
            replacement=await claim(c,"new_owner")
            from unittest.mock import AsyncMock,patch
            with patch("app.worker.complete",new_callable=AsyncMock,
                       return_value={"content":"new-owner-result","provider":"test-double","model":"reliability-only"}):
                assert await process_claim(c,replacement,"new_owner")=="committed"
            await c.aclose()
        run(replace())
        first.wait(timeout=12)
        assert first.returncode==0
        async def verify():
            c=redis.from_url(URL,decode_responses=True)
            assert await c.hget("studio:result:live_stale","content")=="new-owner-result"
            assert await c.llen(PROCESSING)==0
            await c.aclose()
        run(verify())
    finally:
        if first.poll() is None: first.kill()
