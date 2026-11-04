"""API fondasi BC Book Studio. Tidak melakukan penerbitan otomatis."""
import os
import secrets
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from .ai import AIProviderError, complete
from .agents.chief_editor import prepare_draft
from .editorial_knowledge import KnowledgeLoadError

app = FastAPI(title="BC Book Studio API", docs_url=None, redoc_url=None)

class DraftRequest(BaseModel):
    topic: str = Field(min_length=4, max_length=250)
    grade: str = Field(min_length=1, max_length=20)
    objectives: str = Field(min_length=10, max_length=2000)
    provider: str = "deepseek"
    category: str = "writing"

def require_editor(authorization: str | None) -> None:
    expected = os.getenv("STUDIO_API_KEY", "")
    if len(expected) < 24 or not authorization or not secrets.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(status_code=401, detail="Akses tidak sah")

@app.get("/health")
def health():
    return {"status": "ok", "service": "bc-book-studio-api"}

@app.post("/api/v1/drafts")
async def draft(request: DraftRequest, authorization: str | None = Header(default=None)):
    require_editor(authorization)
    try:
        system, prompt, metadata = prepare_draft(request.topic, request.grade, request.objectives, request.category)
        result = await complete(system, prompt, provider=request.provider)
    except KnowledgeLoadError as exc:
        raise HTTPException(status_code=503, detail="Pengetahuan editorial tidak tersedia") from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "perlu_tinjauan", "draft": result, "execution": {
        **metadata, "provider": result["provider"], "model": result["model"],
        "execution_status": "completed"}}
