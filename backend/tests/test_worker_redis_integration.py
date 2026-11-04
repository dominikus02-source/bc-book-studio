"""Redis integration tests against a dedicated ephemeral Redis service.

These test interrupted state transitions, not OS-level SIGKILL or Redis power loss.
"""
import asyncio
import json
import os
from unittest.mock import AsyncMock, patch
import pytest
import redis.asyncio as redis
from app.worker import claim, reclaim, process_claim, PENDING, PROCESSING, DEAD
from app.audit_events import record_event

def payload(job_id):
    return json.dumps({"id": job_id, "topic": "Teks deskripsi", "grade": "VII",
                       "objectives": "Menulis paragraf", "category": "writing"})

async def setup():
    client = redis.from_url(os.getenv("TEST_REDIS_URL", "redis://localhost:6379/15"), decode_responses=True)
    try:
        await client.ping()
    except Exception:
        await client.aclose()
        pytest.skip("Redis test instance unavailable")
    await client.flushdb()
    return client

def test_claim_recovery_and_duplicate(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_AUDIT_DB", str(tmp_path / "audit.sqlite3"))
    async def scenario():
        client = await setup()
        try:
            raw = payload("case1")
            await client.lpush(PENDING, raw)
            first = await claim(client, "worker-a")
            assert first and first[1] == "case1"
            assert await client.llen(PROCESSING) == 1
            assert await claim(client, "worker-b") is None
            assert await reclaim(client) == ["active"]
            # Simulate crash and lease expiry by removing the abandoned lease.
            await client.delete("studio:lease:case1")
            assert await reclaim(client) == ["recovered"]
            assert await client.llen(PENDING) == 1
            second = await claim(client, "worker-b")
            assert second and second[2] != first[2]
            fake = {"content": "Materi", "provider": "deepseek", "model": "mock"}
            with patch("app.worker.complete", new_callable=AsyncMock, return_value=fake) as provider:
                assert await process_claim(client, second, "worker-b") == "committed"
                assert provider.await_count == 1
            assert await client.llen(PROCESSING) == 0
            assert await client.hget("studio:result:case1", "status") == "waiting_approval"
            assert await client.hget("studio:result:case1", "content") == "Materi"
            await client.lpush(PENDING, raw)
            assert await claim(client, "worker-c") is None
            assert await client.llen(PROCESSING) == 0
        finally:
            await client.aclose()
    asyncio.run(scenario())
    import sqlite3
    with sqlite3.connect(tmp_path / "audit.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM job_events WHERE job_id='case1'").fetchone()[0] >= 2

def test_failed_attempts_dead_letter(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_AUDIT_DB", str(tmp_path / "audit.sqlite3"))
    async def scenario():
        client = await setup()
        try:
            raw = payload("case2")
            await client.lpush(PENDING, raw)
            with patch("app.worker.complete", new_callable=AsyncMock, side_effect=RuntimeError("offline")) as provider:
                for attempt in range(3):
                    item = await claim(client, "worker-a")
                    assert item and item[3] == attempt + 1
                    await process_claim(client, item, "worker-a")
                assert provider.await_count == 3
            assert await client.llen(DEAD) == 1
            assert await client.llen(PENDING) == 0
            assert await client.llen(PROCESSING) == 0
            assert await client.exists("studio:result:case2") == 0
        finally:
            await client.aclose()
    asyncio.run(scenario())

def test_stale_worker_cannot_commit(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_AUDIT_DB", str(tmp_path / "audit.sqlite3"))
    async def scenario():
        client = await setup()
        try:
            await client.lpush(PENDING, payload("case3"))
            item = await claim(client, "worker-a")
            await client.delete("studio:lease:case3")
            await reclaim(client)
            replacement = await claim(client, "worker-b")
            fake = {"content": "Draf", "provider": "deepseek", "model": "mock"}
            with patch("app.worker.complete", new_callable=AsyncMock, return_value=fake):
                assert await process_claim(client, item, "worker-a") == "stale"
                assert await client.exists("studio:result:case3") == 0
                assert await process_claim(client, replacement, "worker-b") == "committed"
                assert await client.hget("studio:result:case3", "content") == "Draf"
        finally:
            await client.aclose()
    asyncio.run(scenario())
