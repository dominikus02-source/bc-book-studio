# Inventaris endpoint dan kandidat kontrol RBAC — 2026-11-08

**Metode:** inspeksi statis 33 file route.ts pada integration/unified-book-workflow-20261107. Penanda di tabel adalah kemunculan kode, **bukan pembuktian otorisasi benar atau PASS keamanan**. Bukti izin memerlukan pengujian negatif per peran dan tindakan.

| Endpoint | Metode | Mekanisme autentikasi terdeteksi | Kontrol statis terkait | Status |
|---|---|---|---|---|
| /api/auth/[action] | GET, POST | sessionUser | Perlu pemeriksaan manual | PERLU UJI TIAP PERAN |
| /api/books | GET, POST | sessionUser, identity( | resource-owner, reviewer-assignment | PERLU UJI TIAP PERAN |
| /api/books/[id] | GET, PATCH, DELETE | sessionUser, identity( | resource-owner, reviewer-assignment, optimistic-version, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/assets | GET, POST | identity( | resource-owner, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/assets/[assetId] | GET, PATCH, DELETE | sessionUser | resource-owner, reviewer-assignment, optimistic-version, schema-validator | PERLU UJI TIAP PERAN |
| /api/books/[id]/bulk-outline | GET, POST | identity( | resource-owner, optimistic-version, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/chapters | GET, POST | identity( | resource-owner, schema-validator | PERLU UJI TIAP PERAN |
| /api/books/[id]/chapters/[chapterId] | GET, PATCH, DELETE | identity( | resource-owner, optimistic-version, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/chapters/[chapterId]/sections | GET, POST | identity( | resource-owner, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/chapters/[chapterId]/sections/[sectionId] | PATCH, DELETE | identity( | resource-owner, optimistic-version, schema-validator | PERLU UJI TIAP PERAN |
| /api/books/[id]/chapters/[chapterId]/sections/reorder | PATCH | identity( | resource-owner, schema-validator | PERLU UJI TIAP PERAN |
| /api/books/[id]/chapters/reorder | PATCH | identity( | resource-owner, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/export | GET | sessionUser | resource-owner, reviewer-assignment | PERLU UJI TIAP PERAN |
| /api/books/[id]/generate | POST | identity( | resource-owner, schema-validator | PERLU UJI TIAP PERAN |
| /api/books/[id]/layout | GET, PATCH | sessionUser | resource-owner, optimistic-version, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/publication | GET, POST | sessionUser | resource-owner, reviewer-assignment, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/publishing-readiness | GET, POST | sessionUser | resource-owner, reviewer-assignment, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/restore | POST | identity( | resource-owner, optimistic-version, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/review | POST | sessionUser | resource-owner, reviewer-assignment, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/reviewers | GET, POST, DELETE | sessionUser | resource-owner, reviewer-assignment, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/books/[id]/workflow | GET, POST | sessionUser | schema-validator | PERLU UJI TIAP PERAN |
| /api/books/template | POST | identity( | resource-owner | PERLU UJI TIAP PERAN |
| /api/form-drafts | GET, POST | identity( | resource-owner | PERLU UJI TIAP PERAN |
| /api/form-drafts/[id] | PATCH, DELETE | identity( | resource-owner | PERLU UJI TIAP PERAN |
| /api/health | Lainnya | Periksa akses publik/manual | Perlu pemeriksaan manual | PERLU UJI TIAP PERAN |
| /api/reviewer | GET | sessionUser | resource-owner, reviewer-assignment | PERLU UJI TIAP PERAN |
| /api/reviewer/ai | POST | Periksa akses publik/manual | schema-validator | PERLU UJI TIAP PERAN |
| /api/reviewer/notes | POST | Periksa akses publik/manual | reviewer-assignment, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/reviewer/notes/[id] | PATCH, DELETE | Periksa akses publik/manual | reviewer-assignment, schema-validator, audit-or-revision | PERLU UJI TIAP PERAN |
| /api/settings/providers | GET, POST | administrator( | Perlu pemeriksaan manual | PERLU UJI TIAP PERAN |
| /api/settings/providers/[id] | PATCH, DELETE | administrator( | Perlu pemeriksaan manual | PERLU UJI TIAP PERAN |
| /api/settings/providers/[id]/test | POST | administrator( | Perlu pemeriksaan manual | PERLU UJI TIAP PERAN |
| /api/studio/status | GET | identity(, administrator( | Perlu pemeriksaan manual | PERLU UJI TIAP PERAN |

**Skenario uji:** owner/editor, reviewer ditugaskan, admin ditugaskan independen, admin tidak ditugaskan, editor lain, anonim, serta pembaca publik pada endpoint yang memang publik. Gunakan status DRAFT/REVIEW/APPROVED/arsip, akses ke buku lain, replay/stale version, data berbahaya, dan perubahan setelah approval.

DILARANG menyimpulkan keamanan dari penamaan route, tombol tersembunyi, atau keberadaan sessionUser saja.
