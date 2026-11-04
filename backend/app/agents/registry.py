"""Registri konfigurasi peran; bukan proses agent independen."""
from dataclasses import dataclass

@dataclass(frozen=True)
class Specialist:
    id: str
    name: str
    responsibility: str
    competency: str
    categories: tuple[str, ...]
    knowledge: tuple[str, ...]
    output: str
    quality_gate: str

ROLES = (
    Specialist("chief_editor", "Chief Editor", "Keputusan editorial", "Pengendalian mutu", ("writing", "assessment", "publishing"), ("MASTER_EDITORIAL_HANDBOOK.md",), "Keputusan dan risiko", "Persetujuan manusia"),
    Specialist("research", "Research Specialist", "Riset sumber", "Verifikasi referensi", ("writing",), ("SOURCE_AND_FACT_VERIFICATION.md",), "Register sumber", "Sumber terbaca"),
    Specialist("curriculum", "Curriculum Architect", "Pemetaan kurikulum", "CP dan tujuan", ("writing", "assessment"), ("CURRICULUM_FRAMEWORK.md",), "Matriks keselarasan", "Dokumen resmi"),
    Specialist("subject", "Subject Matter Expert", "Akurasi bahasa", "Linguistik", ("writing",), ("BAHASA_INDONESIA_KNOWLEDGE.md",), "Ulasan konsep", "Akurasi"),
    Specialist("learning", "Learning Designer", "Aktivitas belajar", "Pedagogi", ("writing", "assessment"), ("PEDAGOGY_STANDARDS.md",), "Rancangan aktivitas", "Tujuan terukur"),
    Specialist("author", "Book Author", "Naskah", "Penulisan", ("writing",), ("BOOK_WRITING_STANDARDS.md",), "Draf bab", "Struktur lengkap"),
    Specialist("assessment", "Assessment Specialist", "Butir dan rubrik", "Evaluasi", ("assessment",), ("ASSESSMENT_STANDARDS.md",), "Soal dan pembahasan", "Kunci valid"),
    Specialist("literature", "Literature Specialist", "Karya sastra", "Apresiasi sastra", ("writing",), ("BAHASA_INDONESIA_KNOWLEDGE.md",), "Telaah sastra", "Ketepatan genre"),
    Specialist("visual", "Visual Director", "Ilustrasi", "Komunikasi visual", ("illustration",), ("VISUAL_AND_ILLUSTRATION_STANDARDS.md",), "Brief ilustrasi", "Lisensi jelas"),
    Specialist("editorial", "Editorial Specialist", "Sunting bahasa", "EYD dan gaya", ("writing",), ("BAHASA_INDONESIA_KNOWLEDGE.md",), "Revisi terjelaskan", "Bahasa baku"),
    Specialist("pedagogical", "Pedagogical Reviewer", "Audit pembelajaran", "Keselarasan", ("assessment",), ("PEDAGOGY_STANDARDS.md",), "Temuan pedagogi", "Kesesuaian tujuan"),
    Specialist("fact_checker", "Fact Checker", "Cek klaim", "Sumber primer", ("writing",), ("SOURCE_AND_FACT_VERIFICATION.md",), "Daftar verifikasi", "Bukti tersedia"),
    Specialist("layout", "Layout Designer", "Tata letak", "Tipografi dan ekspor", ("publishing",), ("PUBLISHING_STANDARDS.md",), "Spesifikasi desain", "Keterbacaan"),
    Specialist("publishing_qa", "Publishing QA", "Validasi", "Pemeriksaan artefak", ("publishing",), ("EDITORIAL_QA_STANDARDS.md",), "Laporan QA", "Bukti lintasformat"),
    Specialist("integration", "Integration Specialist", "Integrasi produk", "Hak akses", ("integration",), ("BAHASA_CERDAS_INTEGRATION.md",), "Rencana integrasi", "Izin Founder"),
)

def select_specialists(category):
    return tuple(role for role in ROLES if category in role.categories)
