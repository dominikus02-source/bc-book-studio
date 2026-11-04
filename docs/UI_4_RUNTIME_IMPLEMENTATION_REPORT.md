# UI-4 — Laporan implementasi runtime (sementara)

Tanggal: 2026-11-04. **Status: BLOCKED**.

## Pekerjaan yang terbukti
- Audit `docs/UI_4_RUNTIME_READINESS_AUDIT.md` dibuat dari kode backend, Compose, dan laporan UI-3 aktual.
- Panduan persiapan lokal `docs/RUN_BOOK_STUDIO_LOCALLY.md` dibuat tanpa menambahkan kredensial.
- Tidak ada perubahan pada layanan produksi, VPS, DNS, database produksi, main, atau base PR.

## Arsitektur saat ini
Next.js frontend; FastAPI backend dengan endpoint health dan drafts; PostgreSQL 16 dan Redis 7 AOF pada Compose; worker dengan volume SQLite audit. Compose memetakan frontend ke loopback `127.0.0.1:3180`, bukan URL staging publik.

## Konfigurasi
`.env.example` belum tersedia pada pemeriksaan awal. Compose menggunakan `.env.staging` dan `STUDIO_DB_PASSWORD` dari environment. Konfigurasi login Supabase lintas aplikasi belum terbukti.

## Bukti yang belum tersedia
- URL lokal/staging yang **sudah dibuka dan diverifikasi**: belum ada.
- Database hidup, migrasi, CRUD proyek dan transaksi: belum diuji.
- Autentikasi pengguna dan dua akun pengujian: belum ada bukti.
- Browser E2E Playwright dan screenshot: belum dilakukan.
- Restart/recreate persistence proyek: belum diuji.
- Pengujian cross-user, expired token, idempotensi: belum dilakukan.
- CI terbaru untuk perubahan UI-4: belum diverifikasi lulus.
- Kinerja API/memori container: belum diukur.

## Masalah dan prioritas
1. UI-3 identity foundation masih BLOCKED: gunakan Supabase Auth yang sudah dipakai BahasaCerdas, tetapi validasi server-side dan pemetaan pengguna/membership Book Studio belum tersedia.
2. `backend/app/main.py` belum mempunyai endpoint proyek; wizard dan perpustakaan tidak boleh diaktifkan sebagai fungsi palsu.
3. `infra/postgres/001_initial.sql` ada tetapi belum diverifikasi pada database terisolasi.
4. `/health` belum memeriksa dependensi DB/Redis.
5. Docker Compose dan konfigurasi environment memerlukan validasi runtime sebelum mengklaim siap.

## Langkah berikutnya
Selesaikan kontrak identitas terverifikasi, migrasi terisolasi, API proyek dengan otorisasi dan idempotensi, lalu integrasikan UI dan jalankan browser E2E dengan dua pengguna nyata. Tidak boleh mengubah status menjadi PASS berdasarkan build atau dokumen saja.
