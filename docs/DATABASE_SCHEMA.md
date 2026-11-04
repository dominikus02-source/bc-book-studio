# Skema database

Rancangan tabel dan indeks berada pada `infra/postgres/001_initial.sql`. Entitas mencakup pengguna, peran, izin, workspace, proyek buku, brief, outline, bab, bagian, agen, tugas, dependensi, run, dokumen, versi, ilustrasi, latihan, review, quality check, approval, export job, aset, provider, penggunaan AI, dan audit log.

Batasan utama: FK untuk kepemilikan, unique per posisi bab dan versi dokumen, unique idempotency key per proyek, CHECK untuk status tugas/proyek, indeks untuk antrean, audit, dan penggunaan AI.

Belum dijalankan pada PostgreSQL. Sebelum deploy: tambahkan mekanisme migrasi dengan versi, uji rollback/restore, validasi konsistensi workspace lintas relasi, dan transaksi untuk pembaruan status tugas.
