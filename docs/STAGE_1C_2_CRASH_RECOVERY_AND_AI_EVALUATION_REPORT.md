# Tahap 1C.2 — Crash Recovery dan Evaluasi Chief Editor

**Status keseluruhan: BLOCKED.** Baseline `dca9f4df291543170a3d4931a89e8ea04e290223`: Backend run 41751970623 SUCCESS, Quarto 41751970649 SUCCESS, buku 41751970659 SUCCESS. Keberhasilan baseline tidak membuktikan commit baru.

## Audit dan arsitektur
Sebelum: Lua FINISH menulis result dan menghapus processing/lease; kemudian Python menulis event SQLite. Crash pada batas ini meninggalkan hasil tanpa event audit.

Sesudah: Lua FINISH menulis result, acknowledgment, dan event ke Redis hash `studio:audit:outbox` secara atomik. Lua FAIL juga menyimpan event kegagalan ke outbox saat perpindahan antrean. `reconcile_audit` mengulang event ke SQLite dengan `event_id` deterministik, INSERT OR IGNORE, dan menghapus outbox hanya setelah SQLite menyimpan event. Compare-and-delete menghindari menghapus payload yang telah berubah. Rekonsiliasi diulang pada siklus worker. **Redis dan SQLite tetap bukan transaksi lintas database.**

Alur: pending → CLAIM + lease → provider + heartbeat → FINISH(result + ack + outbox) → reconciler → SQLite WAL → hapus outbox. Gagal: FAIL(retry/dead + outbox) → reconciler. Crash sebelum FINISH: lease habis → reclaim → retry. Crash setelah FINISH: outbox diproses ulang secara idempoten.

## Hasil uji crash (10 skenario)
| Skenario | Status |
|---|---|
| 1 SIGKILL setelah claim | BLOCKED — belum dijalankan sebagai proses nyata |
| 2 SIGKILL saat provider | BLOCKED |
| 3 SIGKILL setelah respons provider | BLOCKED |
| 4 SIGKILL sebelum hasil disimpan | BLOCKED |
| 5 SIGKILL setelah hasil disimpan | BLOCKED |
| 6 SIGKILL sebelum ack | BLOCKED |
| 7 Restart worker dengan lease aktif | BLOCKED |
| 8 Dua proses worker paralel | BLOCKED |
| 9 Lease kedaluwarsa dengan worker lama hidup | BLOCKED |
| 10 Redis restart saat pekerjaan aktif | BLOCKED |

Unit/integration tests untuk lease, fencing, dead-letter dan outbox ada, termasuk injeksi kegagalan SQLite setelah Redis commit. **Tes ini bukan pengganti SIGKILL, uji persistensi AOF/RDB, atau uji restart Redis sungguhan.** Hasil CI terbaru harus diverifikasi sebelum PASS.

## Persistensi dan keamanan
SQLite menggunakan WAL dan indeks job/time. `STUDIO_AUDIT_DB` wajib menunjuk ke volume persisten milik BC Book Studio; belum dibuktikan volume, backup, retensi, restore, atau integritas sesudah restart. Redis AOF/RDB, fsync dan volume belum diverifikasi. Jika Redis kehilangan outbox sebelum flush, SQLite tidak dapat merekonstruksi event yang belum pernah tersimpan; jaminan audit tanpa kehilangan **belum tercapai**. Rekonsiliasi outbox mencakup FINISH/FAIL, tetapi CLAIM/RECLAIM masih memerlukan outbox durable untuk audit menyeluruh. Endpoint draf memakai autentikasi bearer dan tidak otomatis menerbitkan. Review tambahan diperlukan untuk input tidak tepercaya, pengamanan akses database audit, job ID, fencing token dan biaya retry.

## Evaluasi model nyata
**0/12 — BLOCKED.** Tidak ada kredensial provider yang ditemukan di lingkungan PC pengembangan pada audit sebelumnya. Tidak ada keluaran model atau skor yang direkayasa. Untuk menjalankan: gunakan environment variable `DEEPSEEK_API_KEY` atau provider terkonfigurasi melalui secret manager/CI secret dengan akses terbatas; jangan commit nilai kunci. Jalankan skenario melalui `prepare_draft` + `complete` pada runtime yang sama, simpan keluaran aktual, model, prompt/KB version, hash dokumen dan waktu pada storage aman; jangan unggah respons sensitif ke artefak publik. Rubrik 25/20/15/15/15/10; persetujuan editor dan guru terpisah, semua BELUM DISETUJUI.

## Acceptance dan rekomendasi
Outbox reconciliation: **PARTIAL**, karena hanya beberapa transisi terlindungi dan persistensi Redis belum terbukti. Sepuluh crash proses nyata, restart Redis, audit lengkap, seluruh test/build terbaru, dan 12 evaluasi nyata: **BLOCKED sampai bukti tersedia**. Jalankan pengujian pada runner Linux terisolasi dengan Redis AOF volume, SIGKILL worker child process, restart container, dan validasi hasil/SQLite; verifikasi CI dan review manusia sebelum keputusan PASS.

Tidak menyentuh main, tidak merge, tidak deploy, tidak mengubah database produksi.
