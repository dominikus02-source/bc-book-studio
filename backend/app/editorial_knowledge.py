"""Pemuatan pengetahuan editorial berdasarkan kategori tugas."""
from pathlib import Path
import hashlib

KB_ROOT = Path(__file__).resolve().parents[2] / "docs" / "knowledge-base"
KB_VERSION = "1.1.0"
ALL_DOCUMENTS = (
    "MASTER_EDITORIAL_HANDBOOK.md",
    "BAHASA_INDONESIA_KNOWLEDGE.md",
    "CURRICULUM_FRAMEWORK.md",
    "PEDAGOGY_STANDARDS.md",
    "BOOK_WRITING_STANDARDS.md",
    "ASSESSMENT_STANDARDS.md",
    "VISUAL_AND_ILLUSTRATION_STANDARDS.md",
    "EDITORIAL_QA_STANDARDS.md",
    "PUBLISHING_STANDARDS.md",
    "BAHASA_CERDAS_INTEGRATION.md",
    "SOURCE_AND_FACT_VERIFICATION.md",
    "AGENT_OPERATING_PROTOCOL.md",
)
CATEGORIES = {
    "writing": ("MASTER_EDITORIAL_HANDBOOK.md", "BOOK_WRITING_STANDARDS.md", "BAHASA_INDONESIA_KNOWLEDGE.md", "PEDAGOGY_STANDARDS.md", "CURRICULUM_FRAMEWORK.md", "SOURCE_AND_FACT_VERIFICATION.md"),
    "assessment": ("ASSESSMENT_STANDARDS.md", "PEDAGOGY_STANDARDS.md", "CURRICULUM_FRAMEWORK.md", "BAHASA_INDONESIA_KNOWLEDGE.md", "EDITORIAL_QA_STANDARDS.md"),
    "illustration": ("VISUAL_AND_ILLUSTRATION_STANDARDS.md", "BOOK_WRITING_STANDARDS.md", "EDITORIAL_QA_STANDARDS.md"),
    "publishing": ("PUBLISHING_STANDARDS.md", "EDITORIAL_QA_STANDARDS.md", "SOURCE_AND_FACT_VERIFICATION.md"),
    "integration": ("BAHASA_CERDAS_INTEGRATION.md", "AGENT_OPERATING_PROTOCOL.md", "EDITORIAL_QA_STANDARDS.md"),
}

class KnowledgeLoadError(RuntimeError):
    pass

def load_knowledge(category="writing", max_chars=24000, root=None):
    if category not in CATEGORIES:
        raise KnowledgeLoadError("Kategori pekerjaan tidak dikenal")
    directory = Path(root) if root is not None else KB_ROOT
    sections, metadata = [], []
    for name in CATEGORIES[category]:
        if name not in ALL_DOCUMENTS:
            raise KnowledgeLoadError("Dokumen tidak diizinkan")
        path = directory / name
        if not path.is_file() or path.is_symlink():
            raise KnowledgeLoadError("Dokumen tidak tersedia: " + name)
        raw = path.read_bytes()
        if not raw or len(raw) > 60000:
            raise KnowledgeLoadError("Dokumen kosong atau terlalu besar: " + name)
        try:
            body = raw.decode("utf-8")
        except UnicodeError as exc:
            raise KnowledgeLoadError("Encoding dokumen tidak valid: " + name) from exc
        if not body.strip():
            raise KnowledgeLoadError("Dokumen kosong: " + name)
        sections.append("## " + name + "\n" + body)
        metadata.append({"name": name, "sha256": hashlib.sha256(raw).hexdigest()})
    text = "\n\n".join(sections)
    if len(text) > max_chars:
        raise KnowledgeLoadError("Konteks melebihi batas; tidak dipotong")
    return text, {"version": KB_VERSION, "category": category, "documents": metadata}

def load_editorial_guidance():
    return load_knowledge("writing")[0]
