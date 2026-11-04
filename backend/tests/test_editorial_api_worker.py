import os
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
HEADERS = {"Authorization": "Bearer " + "x" * 32}
BODY = {"topic": "Teks narasi", "grade": "VII", "objectives": "Menganalisis struktur cerita"}

def test_draft_uses_chief_editor(monkeypatch):
    monkeypatch.setenv("STUDIO_API_KEY", "x" * 32)
    fake = {"content": "Draf narasi untuk tinjauan", "provider": "deepseek", "model": "mock-model", "usage": {}}
    with patch("app.main.complete", new_callable=AsyncMock, return_value=fake) as call:
        response = client.post("/api/v1/drafts", headers=HEADERS, json=BODY)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "perlu_tinjauan"
    assert result["execution"]["human_approval"] == "belum_disetujui"
    assert result["execution"]["model"] == "mock-model"
    assert result["execution"]["knowledge_documents"]
    assert "Chief Editor" in call.await_args.args[0]
    assert "BOOK_WRITING_STANDARDS" in call.await_args.args[0]

def test_loader_failure_never_falls_back(monkeypatch):
    monkeypatch.setenv("STUDIO_API_KEY", "x" * 32)
    with patch("app.main.prepare_draft", side_effect=__import__("app.editorial_knowledge", fromlist=["KnowledgeLoadError"]).KnowledgeLoadError("missing")):
        with patch("app.main.complete", new_callable=AsyncMock) as call:
            response = client.post("/api/v1/drafts", headers=HEADERS, json=BODY)
    assert response.status_code == 503
    call.assert_not_awaited()

def test_provider_failure(monkeypatch):
    monkeypatch.setenv("STUDIO_API_KEY", "x" * 32)
    from app.ai import AIProviderError
    with patch("app.main.complete", new_callable=AsyncMock, side_effect=AIProviderError("provider unavailable")):
        response = client.post("/api/v1/drafts", headers=HEADERS, json=BODY)
    assert response.status_code == 503

def test_worker_same_chief_editor(monkeypatch):
    from app.worker import process_task
    fake = {"content": "Draf", "provider": "deepseek", "model": "mock-model"}
    redis_client = AsyncMock()
    with patch("app.worker.complete", new_callable=AsyncMock, return_value=fake) as call:
        import asyncio, json
        asyncio.run(process_task(redis_client, json.dumps({"id": "job1", **BODY, "topic": BODY["topic"], "grade": BODY["grade"], "objectives": BODY["objectives"]})))
    assert "Chief Editor" in call.await_args.args[0]
    assert "BOOK_WRITING_STANDARDS" in call.await_args.args[0]
    assert redis_client.hset.await_args.kwargs["mapping"]["status"] == "waiting_approval"
