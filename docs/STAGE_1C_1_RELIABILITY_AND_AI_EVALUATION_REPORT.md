# Tahap 1C.1 — Reliability Worker dan Evaluasi Chief Editor

**Status: PARTIAL untuk implementasi; BLOCKED untuk evaluasi model nyata dan kelulusan akhir.**

## Audit awal
HEAD baseline `b5c633f76d9c05513229a047d1286f026480bb93`. Salinan terpisah `F:\\bc-book-studio-stage1c` bersih pada branch kerja; folder `F:\\bc-book-studio` di branch main tidak digunakan untuk modifikasi. Pada baseline, worker memindahkan pekerjaan ke processing dan mencatat inflight, tetapi tidak memiliki lease, heartbeat, reclaim, retry limit, fencing, atau audit di luar Redis.

## Perubahan
- `backend/app/worker.py`: Lua claim atomik (pindah antrean, validasi ID, increment attempt, pasang lease, metadata), heartbeat CAS token, penyimpanan hasil + acknowledgement dalam satu Lua script dengan fencing token, failure retry/dead-letter, dan reclaimer untuk processing dengan lease kedaluwarsa. Semantik **at-least-once**: pemanggilan provider dapat berulang setelah crash sebelum commit; hanya hasil dari pemegang lease yang sah dapat disimpan. Ini bukan exactly-once.
- `backend/app/audit_events.py`: SQLite WAL dengan event_id, job_id, timestamp, worker_id, attempt, agent, prompt/KB version, hash dokumen, provider/model, status, kategori error, durasi, status approval, dan referensi hasil. Lokasi database **harus** disetel melalui `STUDIO_AUDIT_DB` ke volume persisten khusus proyek; tanpa variabel ini worker fail-closed.
- `backend/tests/test_worker_redis_integration.py`: pengujian Redis nyata untuk claim, duplicate, lease recovery, fencing stale worker, retry/dead-letter, dan ledger SQLite. Simulasi menggunakan penghapusan lease untuk mewakili crash/expiry, **bukan** SIGKILL proses atau restart Redis sungguhan.
- Workflow backend menjalankan Redis service isolated DB 15 dan menyimpan JUnit XML.

## Alur
Sebelum: pending → BRPOPLPUSH → processing → provider → HSET result → LREM; crash meninggalkan pekerjaan di processing.

Sesudah: pending → Lua CLAIM+lease+attempt → heartbeat → provider → Lua FINISH (fencing+result+ack) → waiting_approval. Jika gagal: Lua FAIL → pending atau dead. Jika lease kedaluwarsa: Lua RECLAIM → pending/dead. Audit event disimpan pada SQLite independen Redis.

## Keterbatasan dan risiko kritis
1. Audit SQLite dan Redis tidak berada dalam satu transaksi lintas penyimpanan. Crash di antara Redis FINISH dan pencatatan event completed dapat membuat event completion hilang; perlu outbox/reconciler untuk jaminan audit lengkap.
2. Redis memerlukan AOF/RDB persistence yang diuji untuk menjamin state setelah restart; konfigurasi runtime belum diverifikasi.
3. Redis test CI bukan pengganti uji proses SIGKILL, restart Redis, dan dua worker yang benar-benar berjalan paralel. Seluruh 10 skenario crash belum dibuktikan.
4. `process_task` adalah helper kompatibilitas dan tidak memakai lease; hanya `run` → `claim` → `process_claim` yang memakai jalur terlindungi.
5. Tidak ada pemantauan/retensi/backup SQLite yang telah diverifikasi. Database staging proyek belum ditinjau.
6. Heartbeat saat model request berlangsung bergantung pada event loop dan Redis yang tetap tersedia; keterlambatan dapat menyebabkan eksekusi provider ulang. Hasil lama ditolak oleh fencing.

## Bukti tes
Pada baseline GitHub Actions sebelumnya berhasil. Percobaan pytest pada PC pengembangan sebelumnya gagal karena Python Desktop Commander tidak memiliki pytest/pip; Docker dan redis-server juga tidak tersedia pada PATH PC. Workflow CI baru memiliki Redis service dan upload JUnit, tetapi hasil terbaru harus dibaca dari run GitHub Actions sebelum mengklaim PASS. Tidak ada hasil pengujian yang direkayasa.

## Evaluasi Chief Editor (12 skenario)
**0/12 keluaran provider nyata tersedia.** Di PC pengembangan tidak ditemukan variabel lingkungan DEEPSEEK_API_KEY, OPENAI_API_KEY, atau GEMINI_API_KEY. Tidak ada pemanggilan model nyata, skor atau bukti verifikasi sumber. Seluruh skenario **BLOCKED / BELUM DISETUJUI**. Jangan menyimpan kunci di Git; konfigurasi kredensial secara aman di lingkungan pengujian terisolasi diperlukan. Rubrik: akurasi 25, pedagogi 20, struktur 15, KB 15, sumber 15, kepatuhan 10. Penilaian editor/guru belum dilakukan.

## Acceptance
- Lease/fencing/retry/dead-letter: kode ada, sebagian skenario integrasi ditambahkan, hasil CI menunggu verifikasi.
- Crash proses dan restart Redis: BLOCKED.
- Audit independen Redis: implementasi tersedia; konsistensi end-to-end PARTIAL.
- Seluruh test dan build: belum terbukti pada commit terbaru.
- 12 skenario nyata dan penilaian manusia: BLOCKED.
- Tanpa publikasi otomatis, tanpa deploy, tanpa merge, tanpa perubahan database produksi.

**Keputusan: BLOCKED untuk kelulusan Tahap 1C.1.**
