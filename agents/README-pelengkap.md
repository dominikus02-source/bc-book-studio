# Pelengkap Agents BC Book Studio (DRAFT)

File-file ini dibuat sebagai draft pelengkap untuk branch `integration/unified-book-workflow-20261107`.

## Isi
- `schemas/agent-output.schema.json` — Kontrak JSON Schema standar untuk semua agent output.
- `grade-profiles/kelas-01-enhanced.json` dan `kelas-07-enhanced.json` — Struktur diperkaya dengan deskripsi kualitatif berdasarkan fase Kurikulum Merdeka (bukan nilai final).
- `roles/author-enhanced.md`, `curriculum-enhanced.md`, `qa-enhanced.md` — Prompt yang lebih detail.
- `specialists/isbn-rights-specialist.md` — Contoh specialist tambahan.

## Status
Semua **DRAFT / PLANNED**. Wajib:
- Validasi ahli pendidikan untuk grade profiles
- Review manusia sebelum dimasukkan ke repo
- Tes dengan fixture nyata
- Diselaraskan dengan constitution.md dan anti-hallucination protocol

## Cara pakai
1. Review dan sesuaikan.
2. Salin ke repo jika disetujui.
3. Update `agent-registry.json` dan routing matrix jika menambah specialist.
4. Jangan klaim status `verified` atau production-ready sampai ada evidence.

Dibuat untuk mendukung implementasi efektif dengan vibe coding sambil tetap mematuhi constitution.
