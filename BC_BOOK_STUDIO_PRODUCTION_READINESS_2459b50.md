# BC BOOK STUDIO PRODUCTION READINESS — 2459b50

Tanggal: 2026-11-07
Commit: 2459b504dc87abecf66fa8e4618d40154d4791ba
PR: https://github.com/dominikus02-source/bc-book-studio/pull/20
Workflow: 42328802168
Keputusan: **HOLD**

## Matriks gate

| Gate | Status | Bukti |
|---|---|---|
| A — CI | PASS (jobs) / BLOCKED (image availability) | GitHub jobs verify dan image success, artifact build ada; GHCR tag sha-2459...: manifest unknown |
| B — Migration compatibility | PARTIAL PASS | Backup SHA-256 verified; 5 migrasi produksi; 2 SQL additive diterapkan ke klon; 10->14 tabel, FK 9, 6 kolom baru; StudioUser 4->4; klon dihapus; belum CRUD app terhadap klon |
| C — Canary | BLOCKED | Image immutable untuk commit 2459b50 belum dapat di-resolve dari registry |
| D — Canary E2E | NOT RUN | Menunggu C |
| E — Security | NOT RUN | Menunggu canary; belum audit lengkap |
| F — Rollback rehearsal | NOT RUN | Menunggu image kandidat dan canary |

## Gate B — bukti eksekusi

Backup: /opt/bc-book-studio-runtime/backups/pre-crud-2459b50-20261107-0931/bookstudio.dump
Checksum: 4293b9cea2756a9f78f0bb9a86bc5bca1f0dd8e361fd914f81c897d02ae4e4a4
Perintah: sha256sum -c SHA256SUMS => OK
Production migrations: 20261104000000_init, 20261105000000_owner_isolation, 20261105010000_usage_limits, 20261105020000_provider_credentials, 20261105000000_studio_accounts.
Klon: bookstudio_migration_qa_2459b50.
Apply SQL:
- 20261106070000_quality_book_chapters/migration.sql
- 20261106120000_studio_form_drafts/migration.sql
Hasil: tabel 10->14, new_tables=4, new_book_columns=6, fk=9, Book=0, Chapter=0, StudioUser=4.
Cleanup: CLONE_DROPPED; exit code 0.
Catatan: belum memvalidasi metadata _prisma_migrations untuk 2 SQL baru; belum aplikasi CRUD pada klon.

## Gate C — blocker

Perintah: docker manifest inspect ghcr.io/dominikus02-source/bc-book-studio:sha-2459b504dc87abecf66fa8e4618d40154d4791ba
Output: manifest unknown.
Perintah: docker image ls --digests ghcr.io/dominikus02-source/bc-book-studio
Hasil: hanya image lama termasuk sha-ca34a99... yang terdaftar.
GitHub Actions run 42328802168: verify/verify SUCCESS, image SUCCESS; artifact dockerbuild ada, tetapi digest artifact bukan digest OCI image.

## Langkah berikutnya

1. Periksa workflow apakah image publish hanya berjalan untuk tag/release dan apakah PR build menggunakan push:false.
2. Publikasikan image immutable setelah workflow/provenance diverifikasi; jangan mengubah produksi.
3. Uji Prisma migrate deploy dan CRUD di klon, dengan riwayat migrasi benar.
4. Jalankan canary terisolasi setelah digest image tersedia.
5. E2E, security, rollback rehearsal. Minta persetujuan eksplisit sebelum perubahan produksi.

Tidak ada container produksi direstart, tidak ada DNS diubah, tidak ada migrasi produksi, tidak ada PR merge.
