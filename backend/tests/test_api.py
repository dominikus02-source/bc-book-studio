import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_draft_requires_auth():
    response = client.post("/api/v1/drafts", json={"topic": "Teks narasi", "grade": "7", "objectives": "Mengenali struktur narasi"})
    assert response.status_code == 401

def test_draft_rejects_invalid_input():
    os.environ["STUDIO_API_KEY"] = "a" * 32
    response = client.post("/api/v1/drafts", headers={"Authorization": "Bearer " + "a" * 32}, json={"topic": "a", "grade": "7", "objectives": "x"})
    assert response.status_code == 422
