# UI-3 — Laporan implementasi sementara

Tanggal: 2026-11-04. **Status akhir: BLOCKED**.

## Selesai
- Audit kode identitas dan model database: `docs/UI_3_IDENTITY_PROJECT_FORENSIC_AUDIT.md`.
- Inventaris migrasi dan rencana pemulihan: `docs/UI_3_DATABASE_MIGRATION_REPORT.md`.
- Koreksi temuan UI-2: `infra/postgres/001_initial.sql` **sudah** mendefinisikan tabel pengguna, workspace, proyek, brief, bab, dan naskah.
- Branch kerja tetap `feat/production-foundation-20261104`; tidak ada merge, perubahan base PR, deployment, atau perubahan produksi.

## Belum dikerjakan karena gerbang keamanan
- Verifikasi sesi/JWT pengguna pada FastAPI, pemetaan ke `users.id`, membership dan hak akses proyek.
- Migrasi PostgreSQL pada database terisolasi, pengujian rollback dan skema aktual.
- API `POST/GET/PATCH /api/v1/projects`, idempotensi, tes paralel, dan pengujian lintas pengguna.
- Integrasi Perpustakaan Buku dan aktivasi tombol wizard.
- Browser QA, screenshot, dan bukti CI khusus UI-3.

## Bukti kode dan pengujian
- `backend/app/main.py` hanya memverifikasi `STUDIO_API_KEY` untuk endpoint drafts; itu bukan autentikasi pengguna.
- `backend/tests/test_api.py` hanya menguji health, API key drafts, dan validasi input.
- Pengujian TypeScript, lint, dan build dari UI-2 **tidak** membuktikan fitur UI-3.
- **Tidak menjalankan tes UI-3, migrasi, atau browser QA.** Tidak ada hasil tes yang diklaim lulus.

## Keputusan yang harus dibuktikan
Identitas mana yang menjadi sumber tepercaya untuk pengguna Book Studio: sesi pengguna BahasaCerdas yang sudah ada, atau identitas Cloudflare Access staging? Keduanya memerlukan verifikasi server dan pemetaan stabil ke tabel `users`; Cloudflare Access pada hostname saja tidak cukup untuk otorisasi proyek.

## Langkah selanjutnya
Setelah kontrak identitas terverifikasi: buat dependency identitas terpusat, uji token invalid/expired dan cross-user; uji migrasi PostgreSQL terisolasi; implementasikan endpoint dengan transaksi idempotensi; hubungkan wizard dan perpustakaan; jalankan CI dan browser QA. Jangan menaikkan status ke PASS tanpa bukti end-to-end.
