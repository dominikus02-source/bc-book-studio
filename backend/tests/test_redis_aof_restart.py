"""Actual Redis SIGKILL and AOF restart on a private port and volume."""
import asyncio
import os
import shutil
import signal
import socket
import subprocess
import time
from pathlib import Path

import pytest
import redis.asyncio as redis
from app.worker import claim, PENDING, PROCESSING

def run(coro):
    return asyncio.run(coro)

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1",0))
        return s.getsockname()[1]

def launch(directory, port):
    p=subprocess.Popen(["redis-server","--bind","127.0.0.1","--port",str(port),
        "--dir",str(directory),"--appendonly","yes","--appendfsync","always",
        "--save","","--daemonize","no"],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    async def wait():
        client=redis.from_url(f"redis://127.0.0.1:{port}/0",decode_responses=True,
                              socket_connect_timeout=0.2)
        try:
            for _ in range(60):
                try:
                    await client.ping()
                    return
                except (redis.ConnectionError,redis.TimeoutError):
                    await asyncio.sleep(0.1)
            raise AssertionError("Redis failed to start")
        finally:
            await client.aclose()
    run(wait())
    return p

def kill(p):
    p.kill()
    p.wait(timeout=10)
    assert p.returncode==-signal.SIGKILL

def test_redis_aof_persists_active_job_across_sigkill_and_restart(tmp_path):
    if not shutil.which("redis-server"):
        pytest.skip("redis-server binary unavailable")
    port=free_port()
    proc=launch(tmp_path,port)
    url=f"redis://127.0.0.1:{port}/0"
    try:
        async def prepare():
            c=redis.from_url(url,decode_responses=True)
            await c.lpush(PENDING,'{"id":"aofjob","topic":"Literasi","grade":"VII","objectives":"Membaca kritis"}')
            item=await claim(c,"before-restart")
            assert item and item[1]=="aofjob"
            assert await c.llen(PROCESSING)==1
            assert await c.hget("studio:attempts","aofjob")=="1"
            assert await c.hlen("studio:audit:outbox")==1
            await c.aclose()
        run(prepare())
        kill(proc)
        proc=launch(tmp_path,port)
        async def verify():
            c=redis.from_url(url,decode_responses=True)
            assert await c.llen(PROCESSING)==1
            assert await c.hget("studio:attempts","aofjob")=="1"
            assert await c.hlen("studio:audit:outbox")==1
            assert await c.exists("studio:lease:aofjob")==1
            await c.aclose()
        run(verify())
    finally:
        if proc.poll() is None:
            proc.terminate()
            proc.wait(timeout=10)
