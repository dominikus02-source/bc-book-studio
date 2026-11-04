"""Real child-process SIGKILL after Redis claim, on isolated Linux CI Redis.

This verifies one crash boundary; it does not stand in for all ten scenarios.
"""
import asyncio
import json
import os
import signal
import subprocess
import sys
import time
import pytest
import redis.asyncio as redis
from app.worker import PENDING, PROCESSING, reclaim

@pytest.mark.skipif(sys.platform != "linux", reason="SIGKILL scenario requires Linux")
def test_sigkill_after_claim_recovers(tmp_path):
    url = os.getenv("TEST_REDIS_URL")
    if not url:
        pytest.skip("isolated Redis required")
    async def reset():
        client = redis.from_url(url, decode_responses=True)
        await client.flushdb()
        raw = json.dumps({"id": "sigkill1", "topic": "Cerpen", "grade": "VII", "objectives": "Analisis teks"})
        await client.lpush(PENDING, raw)
        await client.aclose()
    asyncio.run(reset())
    child_code = """import asyncio,os,time,redis.asyncio as redis
from app.worker import claim
async def main():
 c=redis.from_url(os.environ['TEST_REDIS_URL'],decode_responses=True)
 x=await claim(c,'killed-worker')
 assert x
 print('CLAIMED',flush=True)
 await asyncio.sleep(120)
asyncio.run(main())
"""
    env = dict(os.environ)
    env["PYTHONPATH"] = "backend"
    proc = subprocess.Popen([sys.executable, "-c", child_code], env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        assert proc.stdout.readline().strip() == "CLAIMED"
        os.kill(proc.pid, signal.SIGKILL)
        proc.wait(timeout=5)
        assert proc.returncode < 0
        async def check():
            client = redis.from_url(url, decode_responses=True)
            try:
                assert await client.llen(PROCESSING) == 1
                # Fast-forward the lease/grace clock without waiting 120 seconds.
                await client.delete("studio:lease:sigkill1")
                await client.hset("studio:inflight:sigkill1", "started_at", time.time() - 130)
                assert await reclaim(client) == ["recovered"]
                assert await client.llen(PENDING) == 1
                assert await client.llen(PROCESSING) == 0
            finally:
                await client.aclose()
        asyncio.run(check())
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)
