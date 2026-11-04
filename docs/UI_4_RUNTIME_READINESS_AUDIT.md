# UI-4A — Audit kesiapan runtime

Tanggal: 2026-11-04. Branch: `feat/production-foundation-20261104`. **Status: BLOCKED untuk E2E dan aktivasi staging.**

## Bukti yang diperiksa
- `backend/app/main.py` pada branch kerja: `GET /health` dan `POST /api/v1/drafts` dengan kunci layanan `STUDIO_API_KEY`; tidak ada CRUD `/api/v1/projects`, current-user, atau verifikasi JWT.
- `compose.staging.yml`: frontend Next.js, backend FastAPI, PostgreSQL 16, Redis 7 AOF, worker dan audit-init; volume `postgres_data`, `redis_data`, `studio_audit_data`; frontend dibind hanya ke `127.0.0.1:3180`.
- `docs/UI_3_IDENTITY_PROJECT_FORENSIC_AUDIT.md`: model `users`, `workspaces`, `memberships`, `book_projects`, `book_briefs`, `chapters` tersedia dalam `infra/postgres/001_initial.sql`; penerapan migrasi belum dibuktikan.
- `docs/UI_3_IMPLEMENTATION_REPORT.md`: UI-3 masih BLOCKED, belum ada tes identitas, API, idempotensi, browser QA.
- `.env.example`: tidak ditemukan pada branch saat pemeriksaan.
- Perbaikan regresi SIGKILL terakhir commit `d8e175af6be2545a239cd3101f0ae7e48aaf0333`; hasil CI terbaru belum diverifikasi pada audit ini.

## Matriks kesiapan
| Komponen | Status | Bukti/kekurangan |
|---|---|---|
| Frontend | READY terbatas | Kode Next.js dan wizard tersedia, alur simpan belum aktif |
| Backend | READY terbatas | Health dan drafts; API proyek tidak ada |
| Autentikasi | BLOCKED | Kunci layanan bukan identitas pengguna; kontrak Supabase lintas aplikasi belum diuji |
| PostgreSQL | BLOCKED untuk aplikasi | Compose dan SQL tersedia, koneksi/skema nyata belum diuji |
| Migrasi | BLOCKED | Belum dijalankan dan diverifikasi pada PostgreSQL terisolasi |
| API proyek | BLOCKED | POST/GET/PATCH projects belum tersedia |
| Kepemilikan | BLOCKED | Tidak ada dependency user/membership yang terverifikasi |
| Redis/worker | READY terbatas | Compose dan tes regresi ada, CI SIGKILL terbaru belum dibuktikan lulus |
| Persistensi | BLOCKED untuk proyek | Volume didefinisikan, proyek belum bisa disimpan |
| Browser testing | BLOCKED | Tidak ada alur login → proyek → logout yang dapat diuji |

## Risiko konfigurasi runtime
1. `/health` saat ini hanya mengembalikan `ok` tanpa memeriksa PostgreSQL/Redis; healthcheck backend Compose tidak membuktikan dependensi database.
2. `postgres` memakai `pg_isready` yang membuktikan kesiapan server menerima koneksi, bukan skema/migrasi aplikasi.
3. `studio` network disetel `internal: false`; penilaian exposure/reverse proxy diperlukan sebelum staging publik.
4. `STUDIO_API_KEY` tidak boleh diberikan ke browser; identitas pengguna harus diverifikasi di server.
5. `.env.example` belum ada; contoh konfigurasi harus memisahkan variabel publik dan rahasia, tanpa nilai kredensial asli.
6. Frontend bind loopback `127.0.0.1:3180`; itu bukan bukti URL staging publik dapat diakses.
7. Sumber identitas BahasaCerdas memakai Supabase Auth; cookie/sesi lintas aplikasi, JWT issuer/audience/JWKS, mapping ke `users.id` dan membership harus diverifikasi sebelum API proyek diaktifkan.

## Gerbang implementasi dan uji
**UI-4B:** dokumentasi konfigurasi dan langkah lokal dapat disiapkan tanpa kredensial produksi. Jangan menerapkan migrasi ke target yang tidak diverifikasi.

**UI-4C–E:** setelah identitas pengguna server-side dan mapping disepakati, implementasikan dan uji migrasi terisolasi, CRUD projects, transaksi idempotensi, serta integrasi wizard/perpustakaan.

**UI-4F–G:** Playwright dengan dua akun pengujian sungguhan, persistensi restart/recreate dan penolakan akses lintas pengguna. Jangan gunakan mock API.

**UI-4H:** periksa CI pada commit terbaru, dokumentasikan bukti hasil aktual dan tangkapan layar dari browser nyata.

## Batas keamanan
PR #1 tetap Draft; tidak ada merge, force push, perubahan main/base, deployment VPS, perubahan DNS, atau akses database produksi. Status **BLOCKED** sampai bukti identitas, penyimpanan, dan browser E2E tersedia.
