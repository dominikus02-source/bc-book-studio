# Runbook penyimpanan dan pemulihan staging BC Book Studio

**Hanya untuk lingkungan staging BC Book Studio. Jangan jalankan terhadap VPS atau database produksi BahasaCerdas.**

## Prasyarat
- `compose.staging.yml` memasang `redis_data` untuk `/data`, `studio_audit_data` untuk `/var/lib/bc-book-studio/audit` pada worker, dan `postgres_data` terpisah.
- `audit-init` menyiapkan ownership UID 10001 serta mode 0700 sebelum worker berjalan. Worker dan API memakai user nonroot dari `backend/Dockerfile`.
- `STUDIO_AUDIT_DB=/var/lib/bc-book-studio/audit/audit.sqlite3` ditetapkan pada service worker; jangan arahkan ke volume BahasaCerdas.
- Redis menggunakan `appendonly yes` dan `appendfsync everysec`. Ini bukan jaminan zero data loss saat crash host/power failure.
- Simpan credential hanya melalui environment/secret store yang diizinkan; jangan memasukkan ke laporan atau log.

## Prosedur uji yang belum dieksekusi
1. Buat deployment staging sementara dengan nama proyek dan volume khusus. Pastikan `audit-init` selesai sukses dan worker bisa menulis SQLite WAL.
2. Buat job test yang teridentifikasi; catat ID, attempt, status antrean, lease, hasil, outbox, dan jumlah event SQLite.
3. Jalankan worker lalu hentikan paksa proses di titik pengujian; hidupkan kembali, biarkan lease kedaluwarsa, jalankan reclaimer dan reconciler. Periksa event_id tidak berulang, tidak ada dua hasil final.
4. Lakukan backup SQLite menggunakan SQLite online backup API, bukan menyalin hanya file `.sqlite3` ketika WAL aktif. Verifikasi `PRAGMA integrity_check` pada hasil restore.
5. Hentikan dan hapus **container staging saja**, pertahankan named volumes. Buat ulang container dengan volume yang sama; periksa Redis AOF dan SQLite beserta job, outbox, dan event. Jangan menjalankan `docker compose down -v`.
6. Simulasikan Redis SIGKILL dengan data aktif, lalu restart. Verifikasi job, attempts, result, outbox dan lease. Pastikan tidak ada status selesai tanpa hasil tersimpan.
7. Bandingkan setiap job yang memiliki `studio:result:<id>` dengan event `completed:<id>` di SQLite. Jalankan reconciler berulang dan pastikan outbox terhapus **hanya setelah** event tersimpan.
8. Catat durasi pemulihan, semua hash/metadata dan hasil tes per-skenario di laporan 1C.4.

## Operasional
- Cadangkan SQLite dan Redis AOF secara konsisten; hindari mengambil snapshot parsial ketika penulisan sedang berlangsung.
- Pantau ukuran `studio:audit:outbox`, `studio:processing`, `studio:dead`, dan usia lease. Outbox yang terus bertambah berarti SQLite/reconciler gagal dan harus diinvestigasi.
- Hak akses audit hanya untuk service account worker dan operator staging yang ditunjuk. Tetapkan retensi, backup terenkripsi, dan uji restore berkala sebelum go-live.
- Pengujian manual di atas **belum dibuktikan dijalankan**. Tes otomatis Redis SIGKILL dan SQLite backup/restore yang sudah ada tidak menggantikan uji volume Docker.
