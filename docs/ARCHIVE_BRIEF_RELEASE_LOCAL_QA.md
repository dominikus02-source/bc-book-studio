# Arsip bab, riwayat brief, dan gerbang publikasi — QA lokal

Baseline integrasi Windows, preview 127.0.0.1:32979. Data uji menggunakan PostgreSQL QA lokal.

| Kebutuhan | Perubahan | Bukti |
|---|---|---|
| CRUD bab dan pemulihan | DELETE mengarsipkan bab, PATCH memulihkan dengan expectedVersion. ID, isi, dan revisi dipertahankan. Restore menempatkan bab di akhir daftar. Owner dapat membaca daftar arsip. Mutasi dan audit satu transaksi. | Chromium 390 px mengarsipkan lalu memulihkan ID yang sama. PostgreSQL menyimpan dan membersihkan archivedAt. Akses lintas pemilik ditolak. |
| Riwayat brief | PATCH menyimpan nilai brief sebelumnya dalam BookBriefRevision pada transaksi yang sama saat ada perubahan. Riwayat dibatasi 50 entri terbaru untuk pemilik. | Chromium membuka riwayat, API memverifikasi snapshot dan menolak akses lintas pemilik. |
| Pengurutan | Drag-and-drop HTML pada desktop memakai endpoint yang sama dengan tombol Naik/Turun untuk ponsel dan keyboard. | Chromium 1440 px menguji drag-and-drop; 390 px menguji tombol dan area tanpa luapan horizontal. Urutan tetap setelah refresh. |
| Review dan Terbit | Submit dan approve memeriksa isi bab aktif, penguncian baris menyelaraskan mutasi bab dan review, dan publish mewajibkan konfirmasi serta snapshot persetujuan. | E2E menolak bab kosong, self-approval, reviewer tak ditugaskan, publikasi tanpa konfirmasi dan publikasi ganda. Publikasi HTML dan pencabutan lulus. |

Migrasi 20261107133000_chapter_archive menambah archivedAt dan BookBriefRevision. Prisma migrate deploy dan schema diff exit 0. Typecheck dan diff check exit 0. Bukti ini tidak mencakup validasi semua format terbit, layout persisten, matriks lengkap peran/viewport, atau QA produksi. Status rilis NO_GO.
