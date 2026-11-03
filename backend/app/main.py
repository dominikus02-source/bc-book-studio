"""API fondasi BC Book Studio. Tidak melakukan penerbitan otomatis."""
import os
import secrets
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from .ai import AIProviderError, complete

app = FastAPI(title="BC Book Studio API", docs_url=None, redoc_url=None)

class DraftRequest(BaseModel):
    topic: str = Field(min_length=4, max_length=250)
    grade: str = Field(min_length=1, max_length=20)
    objectives: str = Field(min_length=10, max_length=2000)
    provider: str = "deepseek"

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
        result = await complete(
            "Anda penulis buku pendidikan Bahasa Indonesia. Hasil adalah draf yang wajib diverifikasi editor. Jangan mengarang referensi.",
            f"Topik: {request.topic}\nJenjang: {request.grade}\nTujuan pembelajaran: {request.objectives}\nBuat penjelasan, contoh, dan latihan.",
            provider=request.provider,
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "perlu_tinjauan", "draft": result}
