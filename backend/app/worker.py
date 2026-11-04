"""Worker draf: Chief Editor yang sama dengan API, tanpa penerbitan otomatis."""
import asyncio
import json
import os
import re
import redis.asyncio as redis
from .ai import complete
from .agents.chief_editor import prepare_draft

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
    task = validate_task(raw)
    system, prompt, metadata = prepare_draft(task["topic"], task["grade"], task["objectives"], task.get("category", "writing"))
    result = await complete(system, prompt, provider=task.get("provider", "deepseek"))
    await client.hset("studio:result:" + task["id"], mapping={
        "status": "waiting_approval", "content": result["content"],
        "execution": json.dumps({**metadata, "provider": result["provider"], "model": result["model"]}, ensure_ascii=False)})
    return task["id"]

async def run():
    client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)
    try:
        while True:
            item = await client.brpoplpush("studio:pending", "studio:processing", timeout=5)
            if item is None:
                continue
            try:
                await process_task(client, item)
            except Exception as exc:
                await client.lpush("studio:dead", item)
                await client.hset("studio:worker_errors", mapping={"last_error_type": type(exc).__name__})
            finally:
                await client.lrem("studio:processing", 1, item)
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run())
