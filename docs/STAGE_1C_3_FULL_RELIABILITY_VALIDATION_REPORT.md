# Tahap 1C.3 — Full Reliability Validation & Chief Editor Proof

**Status: BLOCKED (belum layak PASS).** Laporan ini membedakan implementasi, tes yang telah dibuat, dan bukti eksekusi yang sudah diverifikasi.

## Baseline
- Baseline pengguna: `88f1c004625cf1281a7b3784f15f696fa669ae5a`.
- Pada awal tahap, perbandingan GitHub menunjukkan branch identik dengan baseline (ahead 0, behind 0).
- Baseline CI: Backend [41752871006](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41752871006), Quarto [41752871301](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41752871301), Buku VII [41752871621](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41752871621), ketiganya SUCCESS.
- Salinan kerja PC terpisah `F:\\bc-book-studio-stage1c` berada pada branch yang benar, working tree bersih, tetapi tertinggal dari origin (HEAD lokal `b5c633f`); folder `main` tidak diubah. Perubahan tahap ini dibuat langsung melalui GitHub API pada branch kerja.

## Audit kode dan arsitektur
`worker.py` menjalankan Lua CLAIM → Redis processing + lease; provider dipanggil dengan heartbeat; FINISH menulis result, menghapus processing dan memasukkan event ke outbox dalam satu operasi Redis; reconciler memindahkan outbox ke SQLite WAL dan menghapusnya setelah insert idempoten. FAIL menulis event kegagalan ke outbox. Tahap ini menambahkan event outbox `job_claimed` dan `job_reclaimed`/`job_dead_lettered` pada Lua CLAIM/RECLAIM. Event `started` masih ditulis langsung ke SQLite; transisi `job_created`, heartbeat, provider_started/completed, approval_requested/granted/rejected belum semuanya terjamin secara durabel. Audit **belum lengkap**.

Alur: `pending → [CLAIM+lease+outbox] → processing → provider → [FINISH+result+ack+outbox] → waiting_approval → [reconciler] → SQLite`. Crash sebelum FINISH menyebabkan retry (at-least-once); fencing token mencegah hasil stale disimpan. Outbox tidak setara transaksi lintas Redis/SQLite.

## Sepuluh skenario crash proses
Tes `backend/tests/test_worker_sigkill_process.py` menggunakan subprocess Python dan `SIGKILL` nyata di Linux CI, Redis terisolasi, lalu memeriksa pemulihan; tidak memakai penghapusan lease sebagai pengganti SIGKILL (penghapusan lease setelah proses mati hanya mempercepat waktu kedaluwarsa dalam pengujian).

| # | Skenario | Bukti/status |
|---|---|---|
| 1 | SIGKILL setelah claim | Tes subprocess ditambahkan; eksekusi CI terbaru perlu diperiksa |
| 2 | SIGKILL saat provider | Tes subprocess ditambahkan; eksekusi CI terbaru perlu diperiksa |
| 3 | SIGKILL setelah respons provider | Tes subprocess ditambahkan; eksekusi CI terbaru perlu diperiksa |
| 4 | SIGKILL sebelum save | Tahap subprocess `before_save` ditambahkan; eksekusi perlu diperiksa |
| 5 | SIGKILL setelah save | Tahap `after_finish` ditambahkan; eksekusi perlu diperiksa |
| 6 | SIGKILL sebelum acknowledgment | Belum diuji sebagai titik terpisah; FINISH menggabungkan result+ack secara atomik |
| 7 | Restart worker saat lease aktif | Belum diuji dengan proses restart lengkap |
| 8 | Dua worker paralel | Dua subprocess worker bersaing mengambil pekerjaan; tes ditambahkan, hasil CI perlu diperiksa |
| 9 | Lease habis saat worker lama hidup | Tes subprocess worker lama tetap hidup dan hasilnya ditolak fencing; hasil CI perlu diperiksa |
| 10 | Redis restart saat pekerjaan aktif | Tes baru mematikan proses Redis via SIGKILL dan menjalankan ulang Redis dengan AOF pada volume sama; hasil CI terbaru perlu diperiksa |

**Tidak boleh dianggap 10/10 PASS.** Tes menggunakan provider test-double khusus reliability, bukan evaluasi model nyata.

## Persistensi
- SQLite: tes baru membuat database WAL, menguji insert idempoten, backup melalui SQLite backup API, restore, `PRAGMA integrity_check`, indeks dan pembacaan event. Hasil CI terbaru harus diverifikasi.
- Redis: tes baru menggunakan AOF, fsync always, volume temporer dan SIGKILL proses Redis lalu restart pada direktori sama. Hasilnya perlu diverifikasi melalui CI. **Container remove/recreate dan restore volume Docker belum diuji.** Belum ada deployment konfigurasi yang boleh diklaim aman.
- Audit: CLAIM, FINISH, FAIL dan RECLAIM kini memiliki sebagian event outbox. Redis durability tetap prasyarat; perbandingan komprehensif state Redis versus SQLite belum teruji.

## Keamanan
Autentikasi endpoint draf memakai bearer `STUDIO_API_KEY`. `validate_task` membatasi format ID, panjang input dan kategori. Fencing token memeriksa kepemilikan lease. Chief Editor menandai draf perlu tinjauan; tidak ada publikasi otomatis dalam alur worker ini. Belum ada pembuktian Redis ACL, proteksi penuh terhadap prompt injection, rate/budget limiting dan isolasi multi-tenant. Helper `process_task` masih melewati jalur fenced dan harus dibatasi pemakaiannya.

## Dua belas evaluasi Chief Editor
**0/12 keluaran provider nyata terverifikasi pada tahap ini. Seluruhnya BLOCKED / BELUM DISETUJUI.** Kredensial provider tidak boleh dicetak atau diunggah. Perlu environment pengujian dengan secret terkonfigurasi secara aman dan biaya dibatasi. Rubrik: akurasi 25, pedagogi 20, struktur 15, knowledge 15, fakta 15, kepatuhan 10; target 85. Editor dan guru belum memberikan persetujuan. Satu draf kelas VII end-to-end belum dijalankan dengan provider nyata.

## Gerbang acceptance dan risiko
Baseline tiga CI PASS; commit tahap ini memerlukan hasil CI tersendiri. Bukti SIGKILL lengkap 10/10, Redis restart/persistensi, audit seluruh transisi, evaluasi 12 model nyata, penilaian manusia, security gate, dan satu draf end-to-end **belum tersedia**. Jangan deploy, merge, atau menyatakan production ready.

## Tindak lanjut
1. Pastikan CI terbaru lulus, perbaiki tes tanpa mengurangi cakupan.
2. Tambahkan pengujian SIGKILL/restart yang belum ada dan konfigurasi Redis AOF pada container ephemeral.
3. Tutup celah audit event seluruh transisi, rekonsiliasi lintas store dan validasi keamanan.
4. Jalankan 12 skenario serta satu draf kelas VII pada environment nonproduksi dengan secret aman; simpan keluaran aktual, minta penilaian editor dan guru.

**Keputusan: BLOCKED untuk kelulusan Tahap 1C.3.**

## Catatan eksekusi lanjutan
- CI pada commit `a7e9b7c`: Backend [41754454968](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754454968), Quarto [41754454939](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754454939), Buku VII [41754454961](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754454961). Saat pertama diperiksa ketiganya `in_progress`; hasil akhir harus diperiksa lagi.
- Pemeriksaan PC pengembangan hanya membaca keberadaan environment variables tanpa nilainya: `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, dan `STUDIO_AUDIT_DB` semuanya tidak tersedia. Ini bukan bukti tidak adanya GitHub Secrets atau secret manager lain.
- Pengujian SIGKILL yang ditambahkan memerlukan runner Linux. Tidak ada klaim telah dijalankan lokal pada PC Windows.

## Bukti dan perubahan berikutnya
- Backend run [41754454968](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754454968) pada commit `a7e9b7c`: **SUCCESS**. Ini bukti tes yang ada pada commit itu, bukan tes Redis AOF yang ditambahkan sesudahnya.
- Tes Redis AOF `backend/tests/test_redis_aof_restart.py` dan instalasi `redis-server` dalam CI ditambahkan pada commit `849b5387`. Run Backend [41754551041](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754551041) belum selesai saat pertama diperiksa.
- Runbook evaluasi model aman: `docs/CHIEF_EDITOR_REAL_PROVIDER_EVALUATION_RUNBOOK.md`.
