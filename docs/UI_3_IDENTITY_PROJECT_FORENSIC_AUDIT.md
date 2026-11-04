# UI-3A — Audit forensik identitas dan proyek

Tanggal: 2026-11-04. Branch: `feat/production-foundation-20261104`. **Gerbang identitas: BLOCKED.**

## Sumber yang diperiksa
Checkout branch kerja `F:\\bc-book-studio-stage1c`: `backend/app/main.py`, `backend/requirements.txt`, `backend/tests/test_api.py`, `infra/postgres/001_initial.sql`, `compose.staging.yml`, `src/app/page.tsx`, `src/components/book-command-form.tsx`, `src/components/studio-workspace.tsx`, pencarian kode autentikasi dan konfigurasi. Status git sebelum pemeriksaan: branch benar; terdapat dua file lokal belum terlacak `next-env.d.ts` dan `package-lock.json` dari pengujian sebelumnya; **tidak dihapus, ditambahkan, atau di-commit**.

## Temuan aktual — koreksi penting atas audit UI-2
**Skema PostgreSQL proyek ternyata SUDAH ADA di `infra/postgres/001_initial.sql`.** Audit UI-2 sebelumnya keliru menyatakan tidak menemukan model proyek. File SQL tersebut mendefinisikan:
- `users(id uuid PK, email UNIQUE, password_hash, active, created_at)`.
- `workspaces(id uuid PK, name, created_at)`, `memberships(user_id FK, workspace_id FK, role_id FK)`, `roles`, `permissions`, `role_permissions`.
- `book_projects(id uuid PK, workspace_id FK NOT NULL, title, status CHECK, created_by FK users(id), created_at, updated_at)`.
- `book_briefs(project_id UNIQUE FK, content jsonb, version)`, `book_outlines`, `chapters`, `sections` dan tabel terkait agen, aset, penerbitan, audit.
- Indeks `book_projects_workspace_idx` untuk `(workspace_id, created_at DESC)`.
**Belum ada bukti SQL tersebut telah diterapkan ke database staging**; adanya file migrasi bukan bukti tabel hidup. `001_initial.sql` menggunakan `CREATE TABLE IF NOT EXISTS`, tetapi tidak ditemukan migrator terpusat atau tabel versi migrasi dalam cakupan audit.

## Identitas dan autentikasi
- `backend/app/main.py` hanya mempunyai `require_editor`: membandingkan `Authorization: Bearer <STUDIO_API_KEY>` dengan environment server memakai `secrets.compare_digest`. Ini kredensial layanan bersama, **bukan sesi pengguna**.
- Tidak ditemukan endpoint login, logout, refresh, JWT validation/JWKS, session middleware, atau dependency `current_user` pada kode backend yang diaudit.
- Tabel `users` berisi `password_hash`, tetapi **tidak ada implementasi yang terverifikasi untuk memeriksa password dan menghasilkan sesi**.
- Proteksi Cloudflare Access pada hostname staging **bukan bukti** bahwa FastAPI memverifikasi JWT Access dan memetakan identitas ke `users.id`. Tidak ada kode pemeriksaan signature, issuer, audience, expiry atau mapping.
- `created_by` pada `book_projects` saat ini **nullable**; `workspace_id` wajib tetapi tidak ada kode yang memverifikasi membership pengguna saat membuat/membaca proyek.
- Frontend satu halaman client-side; tidak ada sesi autentikasi yang dapat dipakai wizard. Menyalurkan `STUDIO_API_KEY` ke browser dilarang.

## API dan infrastruktur
- API aktif yang dapat dibuktikan dari `main.py`: `GET /health` dan `POST /api/v1/drafts` dengan validasi Pydantic.
- Belum ada `/api/v1/projects`, list/detail/update, dependency pengguna, atau idempotensi proyek.
- `backend/requirements.txt` sudah menyertakan `psycopg[binary]`; belum ada penggunaan koneksi PostgreSQL untuk proyek di `main.py`.
- Compose staging menyediakan PostgreSQL 16 dengan volume `postgres_data`, Redis AOF, dan audit worker SQLite. `STUDIO_DB_PASSWORD` dibaca dari environment. **Jangan** menjalankan migrasi pada DB produksi.
- `backend/tests/test_api.py` menguji health, ketiadaan API key pada drafts, dan invalid input; belum ada tes autentikasi pengguna, cross-user, atau CRUD proyek.

## Risiko yang harus diselesaikan sebelum UI-3B/C/D
1. **Sumber identitas belum ditetapkan/terverifikasi.** Pilih integrasi identitas yang sudah dipakai ekosistem (mis. penyedia sesi yang ada) berdasarkan bukti konfigurasi dan token nyata, bukan membuat login kedua atau menerima header identitas tanpa verifikasi.
2. **Pemetaan identitas** ke `users.id`, membership workspace, dan kebijakan siapa boleh membuat workspace perlu desain yang disetujui. Jangan auto-provision akun dari email/header yang belum tervalidasi.
3. **Model eksisting harus digunakan kembali**, bukan membuat tabel `book_projects` duplikat. Perubahan yang mungkin diperlukan: `created_by NOT NULL` untuk proyek baru, brief metadata, dan tabel idempotensi; semuanya perlu kajian data lama, kompatibilitas, migrasi bertahap, rollback.
4. **Hak akses** harus memeriksa user aktif, workspace membership, dan kepemilikan; jangan menganggap seluruh anggota workspace otomatis boleh membaca seluruh proyek.
5. **Kebocoran**: API key editor dan cookie/token tidak boleh muncul di bundle frontend, log, maupun pesan error.
6. **Bukti database**: inventaris `information_schema` dan history migrasi hanya pada PostgreSQL **terisolasi** setelah dipastikan targetnya, tanpa mengakses server/DB produksi.

## Keputusan gerbang
Sesuai instruksi untuk berhenti bila arsitektur belum terbukti, **UI-3B (identity), UI-3C (migrasi), UI-3D (API), dan aktivasi wizard/perpustakaan belum aman dikerjakan** sampai sumber identitas terverifikasi dan kontrak pemetaan ke `users.id` disepakati. Tidak ada migrasi atau API yang diklaim selesai. Tidak ada deployment.

## Jalur aman selanjutnya
1. Verifikasi apakah BC Book Studio harus memakai identitas pengguna BahasaCerdas yang sudah ada atau identitas Cloudflare Access staging; inspeksi kontrak server-side secara read-only pada repositori/integrasi yang relevan, **tanpa menyentuh server produksi**.
2. Tetapkan verifikasi token signature, issuer, audience, expiry, replay/CSRF, user mapping, membership dan logout; tambah tes negatif.
3. Uji `001_initial.sql` pada PostgreSQL baru terisolasi, catat migrasi dan rollback; audit kemungkinan data existing.
4. Baru tambahkan migrasi aditif bila diperlukan, endpoint terotorisasi, transaksi idempotensi, tes paralel, dan integrasi UI.

## Temuan lanjutan: identitas BahasaCerdas (audit baca-saja)
Repository lokal `F:\\bahasa-cerdas` pada branch `feat/jumpa-simple-scheduling` diperiksa tanpa memodifikasi kode maupun mengakses layanan produksi. `README.md` menyebut Supabase Auth dan `@supabase/ssr`; `app/api/auth/login/route.ts` menggunakan `supabase.auth.signInWithPassword`, `app/api/auth/logout/route.ts` memanggil `supabase.auth.signOut`, dan sejumlah endpoint menggunakan `supabase.auth.getUser()`. README menjelaskan helper aplikasi `getUser()` memakai `supabase.auth.getClaims()` untuk validasi JWT via JWKS lalu memeriksa ulang baris User dan wewenangnya.

**Rekomendasi arsitektur:** gunakan **Supabase Auth BahasaCerdas sebagai sumber identitas**, tanpa membuat login kedua. Tetapi token sesi lintas aplikasi/subdomain, issuer/JWKS/audience, dan mapping `sub` ke `users.id` Book Studio belum dibuktikan. Jangan menganggap cookie dapat langsung dipakai lintas subdomain atau menerima header email/user ID dari proxy tanpa validasi. Lakukan integrasi server-side dengan validasi signature dan claim `iss`, `aud`, `exp`, `sub`; verifikasi kebijakan akun aktif dan mapping ke workspace secara eksplisit. Uji rotasi kunci, token expired, revoked/logout dan pembatasan CORS/CSRF. Jangan memindahkan secret Supabase ke frontend.

Keputusan sumber identitas kini memiliki dasar kode; **gerbang implementasi tetap BLOCKED** sampai kontrak token, sesi lintas aplikasi, dan provisioning/membership terbukti.
