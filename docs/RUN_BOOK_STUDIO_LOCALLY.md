# Menjalankan BC Book Studio secara lokal

**Status: panduan persiapan, bukan bukti aplikasi sudah berhasil dijalankan.** Jalankan hanya pada mesin pengembangan dengan database terisolasi.

## Prasyarat
- Docker Engine dan Docker Compose v2.
- Git.
- Port loopback `3180` tersedia.
- Salinan repository pada branch `feat/production-foundation-20261104`.
- Kredensial **pengembangan saja**, bukan milik produksi BahasaCerdas.

## Pemeriksaan awal
```sh
git status --short --branch
git rev-parse --short HEAD
docker compose version
docker version
```
Periksa `compose.staging.yml`, `backend/Dockerfile`, `Dockerfile`, dan dokumentasi lingkungan sebelum membuat berkas konfigurasi. Jangan jalankan `docker compose down -v` atau reset database yang tidak dipastikan terisolasi.

## Konfigurasi
Compose saat ini membutuhkan berkas lokal `.env.staging` untuk backend/worker dan `STUDIO_DB_PASSWORD` di environment Compose. Berkas tersebut **harus tetap di luar Git**. Buat hanya dengan nilai pengembangan yang aman, tanpa menggunakan password, token, atau URL database produksi. Variabel yang digunakan kode lain harus ditinjau sebelum menjalankan AI provider. Belum ada `.env.example` yang tervalidasi pada saat audit UI-4A.

```sh
# Contoh perintah pemeriksaan; jangan menampilkan isi berkas rahasia
docker compose -f compose.staging.yml config --quiet
```

## Menjalankan layanan (hanya setelah konfigurasi dan target database dipastikan aman)
```sh
docker compose -f compose.staging.yml up -d --build postgres redis
docker compose -f compose.staging.yml ps
docker compose -f compose.staging.yml up -d --build backend frontend
docker compose -f compose.staging.yml ps
```
Worker hanya diperlukan untuk alur AI/antrean, bukan untuk membuktikan CRUD proyek; mulai terpisah setelah audit dependensi dan penyimpanan audit.

Alamat frontend yang **dikonfigurasi**: `http://127.0.0.1:3180`. Alamat ini **belum diverifikasi dapat dibuka** pada audit UI-4A. Backend hanya pada jaringan Compose internal. Jangan mengekspos PostgreSQL/Redis ke internet.

## Pemeriksaan
```sh
docker compose -f compose.staging.yml ps
docker compose -f compose.staging.yml logs --tail=80 backend frontend postgres redis
```
Periksa log sebelum dibagikan; jangan menyalin token, cookie, password, atau connection string. `GET /health` hanya liveness dasar dan belum membuktikan koneksi database.

## Gerbang keamanan yang masih menghalangi pengujian produk
- API proyek buku, identitas pengguna terverifikasi dan membership belum tersedia.
- Migrasi SQL pada PostgreSQL terisolasi belum diuji.
- Tidak ada dua akun pengujian terverifikasi untuk E2E.
- Belum ada bukti persistensi proyek atau browser QA.
- Jangan menjalankan skrip `infra/postgres/001_initial.sql` pada database yang belum diidentifikasi dan diisolasi.

## Menghentikan
```sh
docker compose -f compose.staging.yml stop
```
Perintah `stop` mempertahankan volume. Jangan gunakan `down -v` untuk lingkungan yang berisi data penting.

Lihat `docs/UI_4_RUNTIME_READINESS_AUDIT.md` untuk matriks kesiapan dan gerbang berikutnya.
