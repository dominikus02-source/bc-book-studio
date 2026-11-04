import pytest
from pathlib import Path
from app.editorial_knowledge import ALL_DOCUMENTS, CATEGORIES, KnowledgeLoadError, load_knowledge
from app.agents.chief_editor import AGENT_NAME, prepare_draft
from app.agents.registry import ROLES, select_specialists

def test_all_twelve_documents_exist():
    assert len(ALL_DOCUMENTS) == 12
    from app.editorial_knowledge import KB_ROOT
    assert all((KB_ROOT / name).is_file() for name in ALL_DOCUMENTS)

@pytest.mark.parametrize("category", list(CATEGORIES))
def test_selective_loading(category):
    text, metadata = load_knowledge(category)
    assert metadata["category"] == category
    assert len(metadata["documents"]) == len(CATEGORIES[category])
    assert all(len(item["sha256"]) == 64 for item in metadata["documents"])
    assert all(name in text for name in CATEGORIES[category])
    assert len(text) <= 24000

def test_context_limit_fails():
    with pytest.raises(KnowledgeLoadError, match="batas"):
        load_knowledge("writing", max_chars=1)

def test_missing_and_empty_files_fail(tmp_path):
    with pytest.raises(KnowledgeLoadError, match="tidak tersedia"):
        load_knowledge("publishing", root=tmp_path)
    for name in CATEGORIES["publishing"]:
        (tmp_path / name).write_text("ok", encoding="utf-8")
    (tmp_path / CATEGORIES["publishing"][0]).write_text("", encoding="utf-8")
    with pytest.raises(KnowledgeLoadError, match="kosong"):
        load_knowledge("publishing", root=tmp_path)

def test_chief_editor_context():
    system, prompt, metadata = prepare_draft("Teks deskripsi", "VII", "Menganalisis ciri teks")
    assert "Chief Editor" in system
    assert "BOOK_WRITING_STANDARDS" in system
    assert metadata["agent"] == AGENT_NAME
    assert metadata["human_approval"] == "belum_disetujui"
    assert metadata["knowledge_documents"]
    assert "Teks deskripsi" in prompt

def test_registry_has_fifteen_distinct_roles():
    assert len(ROLES) == len({r.id for r in ROLES}) == 15
    assert select_specialists("illustration")
