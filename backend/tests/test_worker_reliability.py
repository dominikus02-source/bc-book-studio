import asyncio
import json
from unittest.mock import AsyncMock, patch
import pytest
from app.worker import process_task, validate_task

def task():
    return json.dumps({"id": "unique-1", "topic": "Cerpen", "grade": "VII",
                       "objectives": "Menganalisis unsur intrinsik"})

def test_rejects_bad_payload():
    with pytest.raises((ValueError, json.JSONDecodeError)):
        validate_task("{bad")
    with pytest.raises(ValueError, match="ID"):
        validate_task(json.dumps({"id": "../escape", "topic": "a", "grade": "VII", "objectives": "x"}))

def test_duplicate_completed_task_skips_model():
    client = AsyncMock()
    client.hget.return_value = "waiting_approval"
    with patch("app.worker.complete", new_callable=AsyncMock) as provider:
        result = asyncio.run(process_task(client, task()))
    assert result == "unique-1"
    provider.assert_not_awaited()

def test_new_task_writes_review_state():
    client = AsyncMock()
    client.hget.return_value = None
    response = {"content": "Draf", "provider": "deepseek", "model": "mock"}
    with patch("app.worker.complete", new_callable=AsyncMock, return_value=response):
        asyncio.run(process_task(client, task()))
    assert client.hset.await_args.kwargs["mapping"]["status"] == "waiting_approval"
