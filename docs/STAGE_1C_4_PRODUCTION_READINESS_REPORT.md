# Tahap 1C.4 — Production Readiness & First Real Book

**Status: PARTIAL untuk engineering; BLOCKED untuk acceptance produksi dan evaluasi AI nyata.** Dokumen ini tidak menyatakan sistem siap produksi.

## 1. Ringkasan dan baseline
Baseline: `15cd88e938352b6b05c912666e0645a18905b46d`; dibandingkan dengan branch kerja sebelum perubahan: identical, ahead 0, behind 0. Salinan PC `F:\\bc-book-studio-stage1c` pada branch `feat/production-foundation-20261104` semula tertinggal 18 commit, working tree bersih, lalu fast-forward ke baseline. Folder main tidak disentuh. PR #1 tidak di-merge, tidak di-deploy.

Baseline CI:
- [Backend 41754665455](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754665455): SUCCESS.
- [Quarto 41754665378](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754665378): SUCCESS.
- [Buku VII 41754665409](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41754665409): SUCCESS.

## 2. Audit aktual dan perubahan
Dibaca: laporan 1C.1, 1C.2, 1C.3; `backend/app/worker.py`, `backend/app/audit_events.py`, `backend/app/main.py`, `backend/app/ai.py`, `compose.staging.yml`, tes Redis/SQLite dan daftar skenario. Runtime API memanggil `prepare_draft` dan `complete`, menghasilkan `perlu_tinjauan`. Worker memakai Redis Lua CLAIM/FINISH/FAIL/RECLAIM, lease, fencing dan outbox; SQLite WAL menyimpan event. Semantik at-least-once, bukan exactly-once.

**Temuan kritis:** `compose.staging.yml` belum memasang volume audit SQLite untuk worker walaupun `STUDIO_AUDIT_DB` diwajibkan. Perbaikan menambahkan `studio_audit_data` ke worker, menetapkan lokasi audit project-owned dan mengatur Redis AOF fsync everysec secara eksplisit. Tes kontrak staging ditambahkan. Ini belum membuktikan pemulihan Docker volume setelah container remove/recreate. `everysec` memiliki jendela kehilangan data saat crash sistem; tidak ada klaim zero data loss saat kehilangan daya.

## 3. Sepuluh skenario crash
| No | Skenario | Bukti / status |
|---|---|---|
| 1 | SIGKILL setelah claim | Tes subprocess di `test_worker_sigkill_process.py`; backend CI baseline SUCCESS |
| 2 | SIGKILL saat provider | Tes subprocess; baseline SUCCESS (provider test-double) |
| 3 | SIGKILL setelah respons | Tes subprocess; baseline SUCCESS |
| 4 | SIGKILL sebelum save | Tes subprocess; baseline SUCCESS |
| 5 | SIGKILL setelah save | Tes subprocess; baseline SUCCESS |
| 6 | SIGKILL sebelum ack | Belum diuji sebagai titik independen; FINISH menggabungkan result+ack |
| 7 | Restart worker dengan lease aktif | Belum diuji end-to-end |
| 8 | Dua worker bersaing | Tes dua subprocess; baseline SUCCESS |
| 9 | Lease kedaluwarsa saat worker lama hidup | Tes stale owner; baseline SUCCESS |
| 10 | Redis SIGKILL dan AOF restart | `test_redis_aof_restart.py`; baseline SUCCESS |

Tes CI baseline tidak sama dengan bukti pemulihan semua skenario dan belum memverifikasi data per-skenario di luar assertion. **Tidak boleh mengklaim 10/10 PASS.**

## 4. Redis, SQLite dan audit
- Redis: `compose.staging.yml` memakai named volume `redis_data` dan AOF; fsync everysec ditetapkan. Tes Redis AOF restart proses nyata lulus pada baseline. Docker volume recreation belum diuji.
- SQLite: `STUDIO_AUDIT_DB` diarahkan ke `studio_audit_data` pada staging; tes WAL backup/restore/integrity tersedia dan baseline backend SUCCESS. Backup terjadwal, restore container, retention, dan permission volume belum terbukti.
- Audit: CLAIM/RECLAIM/FINISH/FAIL memiliki outbox Redis, reconciler mengulang insert SQLite idempoten. Transisi job_created, heartbeat, provider_started/completed, approval_requested/granted/rejected belum semuanya durable dan belum seluruhnya diuji. Tidak ada transaksi atomik lintas Redis/SQLite. Kegagalan permanen Redis/disk belum dapat diklaim aman.

## 5. Provider dan evaluasi Chief Editor
`backend/app/ai.py`: DeepSeek default, OpenAI dan Gemini tersedia; masing-masing membaca environment variable key, model dapat dioverride, timeout 45 detik, maksimum 2500 output token, retry terbatas. Fallback otomatis lintas provider **tidak ditemukan** pada fungsi `complete`; jangan mengklaim tersedia. Pemeriksaan PC sebelumnya: key environment tidak tersedia, tanpa membaca nilainya. Tidak ada bukti provider nyata dapat dipanggil pada tahap ini.

**12 evaluasi provider nyata: 0/12, BLOCKED, tanpa skor.** Daftar 12 tema baru pada instruksi 1C.4 berbeda dari daftar 12 kasus pada `MASTER_AGENT_TRAINING_EVALUATION.md`; keduanya tidak boleh diam-diam disamakan. Penilaian manusia editor/guru: belum dilakukan, BELUM DISETUJUI.

## 6. First real book
Judul kerja `Bahasa Indonesia — Kelas VII`. **Belum diproduksi sebagai satu draf buku utuh melalui provider nyata**. Pipeline penerbitan tiga format memiliki CI baseline SUCCESS, tetapi bukan bukti draf baru yang telah melalui review manusia. Tidak ada penerbitan otomatis atau persetujuan sintetis.

## 7. Keamanan dan biaya
API memakai `STUDIO_API_KEY` bearer untuk draf. Worker memvalidasi job ID dan input, membatasi retry; hasil status `waiting_approval`. Belum terbukti: otorisasi per-user/per-proyek, Redis ACL, isolasi data multi-tenant, batas biaya per buku, sanitasi seluruh sumber, hardening SQLite permissions, dan ketahanan terhadap prompt injection. Tidak ada rahasia ditambahkan ke Git. Konfigurasi staging masih membutuhkan penilaian keamanan sebelum digunakan.

## 8. CI dan acceptance
Perubahan tahap ini: perbaikan `compose.staging.yml`, tes `backend/tests/test_staging_persistence_contract.py`, dan laporan ini. **Hasil CI commit final harus diverifikasi setelah workflow selesai.**

| Gerbang | Status |
|---|---|
| Sepuluh skenario crash terbukti | PARTIAL |
| Redis AOF restart | PASS baseline untuk proses; volume Docker BLOCKED |
| SQLite backup/restore/integritas | PASS baseline untuk tes SQLite; volume Docker BLOCKED |
| Audit seluruh transisi | PARTIAL |
| No job loss / no duplicate final across all failure modes | PARTIAL |
| Fencing | PASS pada tes yang tersedia |
| Keamanan dan biaya menyeluruh | PARTIAL |
| 12 evaluasi provider nyata | BLOCKED 0/12 |
| Nilai minimal 85 | BLOCKED |
| Review editor dan guru | BLOCKED |
| Draf buku kelas VII utuh | BLOCKED |
| DOCX/PDF/EPUB untuk draf baru | BLOCKED; validasi pipeline baseline SUCCESS |
| CI commit final | Menunggu verifikasi |

## 9. Keputusan dan rekomendasi
**Tidak layak dinyatakan production ready.** Prioritas berikutnya: (1) tes Docker volume removal/recreate dan crash yang belum tercakup; (2) lengkapi audit durable untuk seluruh transisi dan approval; (3) validasi authz, ACL, cost cap, prompt injection; (4) jalankan 12 skenario provider nyata dengan secret staging aman, reviewer manusia; (5) produksi satu draf kelas VII lalu validasi DOCX/PDF/EPUB dan human approval. Tidak ada merge, deployment, atau perubahan database produksi.
