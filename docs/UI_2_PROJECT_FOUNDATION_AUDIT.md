# UI-2A — Audit fondasi proyek dan kontrak backend

Tanggal: 2026-11-04. Status: **BLOCKED untuk penyimpanan proyek** sampai autentikasi per pengguna dan model proyek disediakan secara aman.

## Pemeriksaan
- Checkout lokal `F:\\bc-book-studio-stage1c` berada pada branch kerja dan bersih sebelum diselaraskan secara fast-forward dengan origin. Tidak menyentuh checkout `main` terpisah.
- Frontend: Next.js 15, React 19, TypeScript; `src/app/page.tsx`, `src/components/book-command-form.tsx`, `studio-workspace.tsx`, `globals.css`.
- Backend: FastAPI `backend/app/main.py`, Redis worker `backend/app/worker.py`, PostgreSQL pada `compose.staging.yml`, SQLite untuk audit worker.
- Pemeriksaan file pada branch kerja tidak menemukan `prisma/schema.prisma` atau migrasi proyek pada checkout ini; jangan menganggap PostgreSQL staging sudah memiliki tabel proyek.
- Pengujian backend tersedia di `backend/tests`, termasuk tes Redis, SIGKILL, audit, dan API.

## Klasifikasi kemampuan

| Kemampuan | Bukti | Status |
|---|---|---|
| Beranda dan navigasi modul | Komponen halaman berbasis state lokal | UI saja |
| Formulir produksi | `book-command-form.tsx` menyusun prompt teks di browser | UI saja, belum menyimpan proyek |
| Penulisan | `studio-workspace.tsx` menggunakan state React dan menampilkan peringatan belum disimpan | UI saja |
| Kesehatan backend | `GET /health` | Ada |
| Draf berbantuan AI | `POST /api/v1/drafts`, bearer `STUDIO_API_KEY`, respons `perlu_tinjauan` | Ada, bukan endpoint proyek |
| Proyek/bab/pemilik | Tidak ada endpoint dalam `backend/app/main.py` yang diaudit | **Tidak tersedia pada API yang terverifikasi** |
| Identitas pengguna | Kunci API bersama, bukan sesi pengguna individual | **Belum memadai untuk multi-user** |
| PostgreSQL | Layanan dan volume staging terdefinisi di Compose | Infrastruktur ada, model proyek belum terverifikasi |
| Redis | Worker memakai lease/outbox dan pemulihan | Bukan penyimpanan proyek |
| Ekspor/ilustrasi | Dokumen dan fondasi publishing tersedia, tetapi tidak ada endpoint proyek yang dapat dipakai dari UI | Belum terintegrasi |

## Risiko
1. Cloudflare Access membatasi akses hostname, tetapi bukan pengganti otorisasi pemilik proyek pada API.
2. Mengirim `STUDIO_API_KEY` ke browser akan membocorkan rahasia. Jangan lakukan.
3. Menambahkan tabel proyek sebelum menentukan identitas pemilik berisiko menciptakan data tanpa pemilik sah.
4. Menyimpan konsep hanya di state React kehilangan data saat muat ulang; jangan tampilkan “Tersimpan”.
5. Pengiriman ulang harus memakai idempotency key unik per maksud pembuatan, dibatasi oleh pemilik dan payload.
6. Database PostgreSQL staging bukan database produksi BahasaCerdas; migrasi wajib diuji di database terisolasi dan punya rollback.

## Rencana aman dan gerbang
- **UI-2B:** komponen global, aksesibilitas, token tema dan status yang jujur.
- **UI-2C:** wizard lima langkah dengan validasi dan ringkasan; aksi simpan dinonaktifkan sampai sesi dan endpoint aman tersedia.
- **UI-2D:** setelah sesi terautentikasi tersedia, buat model `BookProject` dan `Chapter` dengan owner_id, versi, tanggal, status; migration up/down teruji di database staging terisolasi. Implementasikan API daftar/buat/detail dengan pemeriksaan owner, transaksi, idempotensi.
- **UI-2E:** tampilkan proyek nyata dari API dengan loading, empty, error dan retry; jangan pakai data tiruan.
- **UI-2F:** uji lint, typecheck, build, backend authz, idempotensi, database failure, browser/mobile dan screenshot.

## Keputusan
**Tidak membuat endpoint atau tabel proyek pada tahap audit** karena identitas pengguna terautentikasi dan kontrak kepemilikan belum tersedia. Tidak ada perubahan skema atau produksi. Status UI-2 keseluruhan tetap **BLOCKED** sampai jalur proyek nyata tersedia dan teruji.
