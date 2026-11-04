# UI-3 — Laporan migrasi PostgreSQL

Tanggal: 2026-11-04. Status: **BELUM DIJALANKAN / BLOCKED**.

## Inventaris skema yang ada
`infra/postgres/001_initial.sql` merupakan skrip skema awal dengan `users`, `workspaces`, `memberships`, `roles`, `book_projects`, `book_briefs`, `chapters`, `sections`, dan tabel produksi lain. `book_projects.created_by` adalah FK nullable ke `users.id`; `workspace_id` adalah FK NOT NULL. Status proyek dibatasi `draft, planned, running, review, approved, published, failed`. Indeks proyek saat ini hanya `(workspace_id, created_at DESC)`.

## Hasil pemeriksaan
- **Tidak ada migrasi baru yang dibuat atau dijalankan.**
- Belum ada bukti `001_initial.sql` telah diterapkan pada PostgreSQL staging.
- Belum ada bukti pengujian constraint, migrasi gagal, rollback, atau backup pada database terisolasi.
- Tidak mengakses atau mengubah database produksi.
- Tidak menghapus history migrasi, tidak melakukan reset database.

## Perubahan yang mungkin dibutuhkan (belum disetujui)
- Menjamin `created_by` selalu berisi pemilik proyek baru, tanpa memaksa `NOT NULL` pada data lama sebelum inventarisasi.
- Menyimpan atribut wizard di `book_briefs.content` JSONB dengan validasi versi dan batas ukuran; jangan membuat kolom/tabel duplikat sebelum kontrak final.
- Idempotensi pembuatan proyek memerlukan constraint unik per identitas terverifikasi + kunci dan transaksi atomik.
- Menambah indeks query berdasarkan pola pencarian aktual, bukan spekulasi.

## Rencana pengujian dan pemulihan
1. Siapkan PostgreSQL 16 **baru, terisolasi**, dengan nama dan kredensial khusus pengujian; verifikasi target sebelum koneksi.
2. Simpan snapshot/backup dan daftar objek, catat hash skrip migrasi.
3. Terapkan `001_initial.sql` pada database kosong, verifikasi FK, CHECK, UNIQUE, dan indeks melalui katalog PostgreSQL.
4. Uji constraint negatif dan transaksi gagal; ulangi migrasi hanya jika idempoten dan tidak merusak data.
5. Rancang migrasi aditif berversi; jalankan di salinan data uji dan uji aplikasi versi lama/baru.
6. Dokumentasikan rollback teruji: migrasi balik untuk perubahan yang reversibel, atau pemulihan snapshot untuk perubahan tak reversibel.
7. Jangan menjalankan migrasi staging/produksi sebelum identitas, kepemilikan, dan prosedur pemulihan disetujui.

Status gerbang: **BLOCKED**, tidak boleh dilaporkan PASS.
