# Tahap 1C.4.2 — Docker Recovery Test Hardening

**Keputusan sementara: PARTIAL; tidak boleh PASS sebelum CI commit akhir dan pemulihan active job dibuktikan.**

## Baseline dan akar kegagalan
Baseline: `46945e506975c348fb6e36c9e9666f74caaa3fc1`. Docker workflow gagal: [41757022320](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41757022320). Berdasarkan bukti log yang dikonfirmasi Founder: stack Docker berhasil dijalankan; UID 10001, permission audit, SQLite write/read, integrity check, dan SQLite setelah worker recreate berhasil. Redis container dibuat ulang, tetapi pemeriksaan marker dijalankan saat health masih `starting`; workflow gagal sebelum PostgreSQL recreate.

Audit script menemukan **dua kemungkinan penyebab yang berbeda**: (1) readiness Redis tidak ditunggu sampai Docker health `healthy`; (2) worker hidup ketika outbox marker disimpan dan secara otomatis menjalankan `reconcile_audit`, sehingga dapat menghapus marker sebelum pemeriksaan Redis. Kegagalan marker **tidak membuktikan kehilangan data AOF** tanpa membedakan kedua kondisi tersebut.

## Perbaikan
- Poll status Docker health Redis hingga `healthy` dan `PING=PONG` dengan batas 60 detik; gagal eksplisit dengan status container dan log Redis terbatas/disanitasi.
- Stop worker **sebelum** menulis marker outbox; marker disimpan ketika tidak ada consumer aktif. Periksa marker Redis serta **payload outbox penuh** setelah container recreate. Reconcile secara manual saat worker masih berhenti, ulang dua kali untuk memastikan idempotensi, baru restart worker.
- Poll PostgreSQL health `healthy` dan `pg_isready`, verifikasi marker database setelah container recreate.
- Buat volume audit negatif terpisah dan buktikan tidak berisi SQLite event lama. Volume utama tidak dihapus.
- Workflow CI membuat kredensial sekali pakai, mendaftarkan nilai ke GitHub Actions masking sebelum digunakan, menyimpan `.env.staging` mode 0600, tidak mencetak nilai, dan menghapus file setelah selesai.
- `docker compose down` cleanup tidak memakai `-v`; volume tidak dihapus sebelum pemeriksaan. Runner ephemeral tetap perlu kebijakan retensi sesuai CI.

## Bukti dan batasan
| Uji | Status |
|---|---|
| Docker build dan stack up pada run 41757022320 | PASS (bukti run sebelumnya) |
| Worker UID 10001, permission audit | PASS (run sebelumnya) |
| SQLite write/read/integrity | PASS (run sebelumnya) |
| SQLite setelah worker recreate | PASS (run sebelumnya) |
| Redis readiness + marker/outbox setelah recreate | **Belum lulus pada baseline**; pengujian ulang menunggu CI |
| PostgreSQL marker setelah recreate | **Belum diuji pada baseline**; tes ditambahkan |
| Volume negatif baru | **Belum diuji pada baseline**; tes ditambahkan |
| Reconcile outbox dua kali | **Belum terbukti** |
| Worker active job SIGKILL, reclaim, fencing, final unik | **PARTIAL / belum dibuktikan dalam Docker workflow ini** |
| Secret masking | Perbaikan kode dilakukan; pemeriksaan kebocoran log aktual menunggu CI |
| Backend, Quarto, Buku VII pada commit akhir | Menunggu hasil workflow |

**Penting:** Tes worker active job membutuhkan proses worker terpisah, lease dan fencing, audit claim/reclaim/final yang diverifikasi. Tes Docker ini belum memenuhi seluruh syarat tersebut. Pengujian proses worker pada tahap sebelumnya tidak boleh disamakan dengan tes active job pada Docker staging.

## Batas keamanan dan operasional
Semua container, Redis, PostgreSQL, SQLite, dan volume tes memakai project name CI terisolasi. Tidak menggunakan VPS, database produksi, atau kunci provider nyata. `appendfsync everysec` bukan bukti ketahanan power-loss. Log Docker tidak boleh menampilkan env dump/secret. Jika log pernah menampilkan kredensial sementara, perlakukan sebagai terekspos dan jangan digunakan ulang.

## Acceptance
**PARTIAL / BLOCKED** sampai Redis, PostgreSQL, kontrol negatif, outbox, dan tiga workflow CI terbukti sukses, serta worker active job recovery dan fencing dibuktikan. Tidak ada merge/deploy/force push.
