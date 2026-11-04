"""Dua belas skenario runtime dengan penyedia tiruan; bukan evaluasi mutu model nyata."""
import pytest
from app.agents.chief_editor import prepare_draft

CASES = [
    ("Konsep buku kelas I", "I", "Mengenalkan membaca awal", "writing"),
    ("Peta materi kelas VII", "VII", "Memetakan tujuan belajar", "writing"),
    ("Koreksi ejaan", "VII", "Menyunting tanda baca", "writing"),
    ("Membaca kritis", "IX", "Menyusun latihan inferensi", "assessment"),
    ("Rubrik cerpen", "VIII", "Membuat rubrik analitik", "assessment"),
    ("Sumber resmi ejaan", "VII", "Menelusuri acuan resmi", "writing"),
    ("Referensi tidak nyata", "X", "Menolak sitasi rekaan", "writing"),
    ("Soal ambigu", "VII", "Mendeteksi jawaban ambigu", "assessment"),
    ("Kesesuaian jenjang", "I", "Menilai kompleksitas teks", "writing"),
    ("Desain buku", "VII", "Membuat arahan desain", "illustration"),
    ("Lisensi gambar", "VII", "Memeriksa izin ilustrasi", "illustration"),
    ("Integrasi BahasaCerdas", "VII", "Merancang integrasi aman", "integration"),
]

@pytest.mark.parametrize("topic,grade,objective,category", CASES)
def test_scenario_preparation(topic, grade, objective, category):
    system, prompt, metadata = prepare_draft(topic, grade, objective, category)
    assert "Chief Editor" in system
    assert topic in prompt
    assert objective in prompt
    assert metadata["knowledge_documents"]
    assert metadata["human_approval"] == "belum_disetujui"
    assert metadata["category"] == category
