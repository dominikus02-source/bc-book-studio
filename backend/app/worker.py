"""Worker awal; memproses tugas antrean Redis. Belum terhubung ke persistensi proyek."""
import asyncio
import json
import os
import redis.asyncio as redis
from .ai import complete

async def run() -> None:
    client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)
    try:
        while True:
            item = await client.brpop("studio:pending", timeout=5)
            if not item:
                continue
            _, raw = item
            try:
                task = json.loads(raw)
                if not isinstance(task, dict) or not all(k in task for k in ("id", "prompt")):
                    raise ValueError("Invalid task payload")
                result = await complete("Anda penulis buku pendidikan. Hasil wajib ditinjau editor.", str(task["prompt"])[:4000])
                await client.hset("studio:result:" + str(task["id"]), mapping={"status": "waiting_approval", "content": result["content"]})
            except Exception:
                await client.lpush("studio:dead", raw)
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run())
