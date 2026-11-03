# Integrasi Agen Quarto/QMD dengan 11 Agen BC Book Studio

**Status:** desain integrasi untuk review; **tidak** mengklaim renderer/orkestrator sudah aktif. 
**Basis:** `feat/frontend-agent-foundation` (11 agen inti, 12 profil kelas), tidak mengubah `main` atau draft backend `feat/production-foundation-20261104`.
**Playbook:** [QMD Book Agent](../agents/skills/qmd-book-agent.md).

## Keputusan kompatibilitas

| Bagian | Kontrak yang harus dihormati |
|---|---|
| Katalog `agents/agent-registry.json` | Tetap 11 **peran logis**; QMD adalah spesialis yang dipanggil sesuai tahap, bukan proses atau agen independen baru. `logicalAgentCount` tidak berubah. |
| `chief_editor` | Menentukan jalur kerja, risiko, dan handoff; tidak menerbitkan atau memberikan approval manusia. |
| `author`, `editorial`, `research` | Memegang naskah, penyuntingan isi dan sumber. QMD tidak menulis ulang substansi atau menciptakan sitasi. |
| `curriculum`, `exercise`, `pedagogy` | Materi formal, latihan dan edisi guru hanya berdasarkan hasil tervalidasi dari peran tersebut; untuk buku fiksi/nonkurikuler, tahap ini kondisional. |
| `visual` | Memasok aset, alt text, caption, izin dan provenance. QMD hanya mengatur representasi/layout. |
| `layout` | **Owner** generator .qmd, template, stylesheet dan rencana render. |
| `qa` | **Owner** hasil uji teknis/visual/aksesibilitas, wajib memperlakukan unresolved ref atau aset hilang sebagai blocking. |
| `publisher` | **Owner** bundel, metadata, manifest, arsip; tindakan penerbitan menunggu approval manusia eksplisit G9. |
| `AGENT_ROUTING_MATRIX.md` | Routing berbasis stage/risiko/biaya; QMD dipanggil melalui layout/qa/publisher, tidak menambah proses permanen. |
| `BOOK_PRODUCTION_WORKFLOW.md` | Ikuti G1–G9, khususnya G7 (QA), G8 (layout/accessibility), G9 (approval manusia). |

## Perbedaan cabang yang harus direkonsiliasi oleh agent lain

- `main` adalah MVP Next.js/Prisma; `Book.status=APPROVED`, `Chapter.position`, `Review`, dan ekspor `GET /api/books/[id]/export?format=pdf|epub` menggunakan `pdf-lib`/`jszip`. **Jangan mengganti/memecahkan endpoint ini pada PR dokumen**.
- `feat/frontend-agent-foundation` membawa dashboard dan spesifikasi agen (belum merupakan backend aktif). Agent registry berstatus `design_only`.
- `feat/production-foundation-20261104` adalah backend FastAPI, PostgreSQL, Redis worker awal, staging Compose, **PR #1 masih draft**. Worker belum durable, skema SQL belum migrasi produksi, RBAC belum terverifikasi. Jangan melakukan integrasi otomatis DB/endpoint sebelum kontrak API final dan migrasi terkelola.
- **Konflik potensial:** pemakaian Prisma dan backend SQL/Python pada tabel yang sama, approval di status saja vs audit identitas, API ekspor sinkron vs worker async. Putuskan interface snapshot/kontrak antarsistem dulu melalui review lintas agent.

## Hand-off QMD (target, belum diimplementasikan)

```text
author/research/curriculum/exercise/visual/editorial/pedagogy
     -> qa review G7
     -> layout + QMD (.qmd generator, preview DRAFT, visual QA G8)
     -> editor/human approval G9
     -> publisher + QMD (render release in sandbox, output QA, manifest)
     -> download/archive/distribution after permission
```

**Aturan preview:** tidak boleh membuat artefak final tanpa approval; rendering draft hanya dalam lingkungan privat dengan label `DRAFT`. 
**Data flow:** snapshot konten terversi dan metadata yang disetujui → adapter QMD idempoten → folder kerja isolasi → worker Quarto tanpa jaringan/eksekusi kode naskah → validasi → manifest → handoff publisher.
**Contract output:** `status`, `summary`, `artifacts`, `evidence`, `issues`, `assumptions`, `handoff`, `human_decisions_required` beserta versi prompt/model dan checksum artefak.

## Gate untuk PR implementasi berikutnya

1. Verifikasi dan sepakati adapter API + identitas approval pada data terversi tanpa mengubah produksi.
2. Tulis fixture satu buku fiksi dan satu nonfiksi; generator aman dan deterministik. Tidak ada raw code/shortcode dari naskah.
3. Pin Quarto dan render worker terisolasi (non-root, no network, memory/CPU/time/disk limits), antrean durable dan retry/idempotency.
4. Uji `quarto --version`, `quarto check`, HTML/Typst/PDF, EPUB, DOCX; validator referensi, glyph/font dan accessibility sesuai target.
5. Review security, copyright, status G1–G9, dan regresi PDF/EPUB lama sebelum menyalakan jalur baru. Deploy hanya setelah staged approval.

## Daftar verifikasi terbuka

- Tidak ada instalasi Quarto atau pengujian render yang dilakukan oleh PR dokumentasi ini.
- Belum ada tanda tangan approval yang setara pada backend WIP, sehingga `approvalDecisionId` belum punya kontrak persisted final.
- Lisensi dan ketersediaan font/asset belum diuji.
- Hasil `epubcheck`/`veraPDF` dan validitas opsi Typst/EPUB Quarto belum diuji terhadap versi yang akan dipakai.
- Rencana worker dan pengelolaan biaya perlu mengikuti keputusan arsitektur lintas agent; jangan klaim siap produksi.

**Rujukan resmi:** https://quarto.org/docs/get-started/ dan https://quarto.org/docs/reference/
