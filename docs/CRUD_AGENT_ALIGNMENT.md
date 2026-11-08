# CRUD per tahap — keselarasan dengan 11 agen Pak Domi

Sumber kebutuhan: Prompt Pengembangan CRUD per Tahap — BC Book Studio (7 November 2026).
Sumber agen: agents/agent-registry.json, AGENT_CATALOG.md, AGENT_ROUTING_MATRIX.md.
Status registry: design_only. Agen adalah peran logis, bukan 11 worker yang sudah aktif.

| Tahap backend | Tahap UI | Agen utama | Pendukung | Gerbang manusia |
| --- | --- | --- | --- | --- |
| BRIEF | Ide | chief_editor | research | Pemilik mengesahkan brief |
| OUTLINE | Rancang | curriculum | chief_editor, author, pedagogy | Pemilik menerapkan outline usulan AI |
| DRAFT | Tulis | author | research, exercise, visual | Pemilik menerima setiap usulan AI |
| REVIEW | Review | editorial | pedagogy, qa | Reviewer lain dari penulis memutuskan |
| APPROVED | Review | qa | chief_editor, editorial, pedagogy | Reviewer/admin yang berwenang menyetujui snapshot |
| EXPORTED | Terbit | publisher | layout, qa | Persetujuan manusia sebelum publikasi |

Subagen qmd-book-agent hanya boleh dipanggil layout, qa, publisher dan bukan agen ke-12.

Urutan implementasi: Prompt 0 blocks/revisions/actor/API/font, Brief, Outline, Draft, quality, Review/Approval, Export, E2E. Migrasi lama harus aditif dan backfill aman, tidak boleh menghapus Chapter.content atau ChapterRevision sebelum pembaca lama dipindah. Status Book.status yang sekarang DRAFT/REVIEW/APPROVED tidak boleh langsung diganti tanpa backfill dan compatibility tests. Jangan ubah produksi, secret, atau PR yang belum lulus QA.

Kontrak UI: 5 tahap, 6 status backend, satu bookId sepanjang perjalanan, status transisi hanya lewat lib/workflow, CRUD tiap resource dan RBAC server-side, optimistic locking 409, soft delete, audit log. Next aktif hanya jika validator server mengizinkan. Data AI selalu proposal sampai user accept. Ekspor dari approval snapshot immutable, bukan draft terbaru.

Status saat dokumen ini ditulis: fondasi block Zod mulai diimplementasikan di lib/blocks.ts; revisi append-only, migrasi DB, workflow, CRUD baru, dispatcher agen, dan E2E belum selesai. Jangan menyatakan fitur tersebut sudah tersedia.
