# Tahap 1C — Evaluasi Chief Editor dan Keandalan Runtime

**Status: PARTIAL untuk rekayasa runtime; BLOCKED untuk evaluasi kecerdasan model.**

## Baseline dan bukti
HEAD awal `adc4256a3a3abb55ddf9745825ac1a6517a49696`. GitHub Actions baseline: Buku kelas VII run 41749468004 SUCCESS, Backend run 41749468027 SUCCESS, Quarto run 41749468118 SUCCESS. Ini membuktikan workflow baseline, bukan hasil perubahan Tahap 1C.

Audit kode menemukan API dan worker memakai `prepare_draft` yang sama; loader memakai kategori dan hash dokumen. Worker memakai `BRPOPLPUSH` ke `studio:processing`, tanpa pemulihan otomatis setelah crash.

## Eksekusi pengujian
Salinan bersih dibuat di PC pengembangan `F:\\bc-book-studio-stage1c` pada HEAD baseline; salinan `F:\\bc-book-studio` yang berada pada `main` tidak diubah. Percobaan `python -m pytest` di PC tidak dapat berjalan karena Python lingkungan Desktop Commander tidak memiliki modul pytest. Hasilnya **bukan PASS**. CI terbaru belum memberikan hasil saat laporan disusun.

## Perubahan Tahap 1C
Worker kini mencatat `studio:inflight:<id>` (worker ID, waktu mulai) dan memeriksa `studio:result:<id>` untuk melewati pekerjaan yang sudah selesai. Tes tambahan memeriksa payload rusak, duplicate completed, dan status waiting_approval. Ini mitigasi parsial, **bukan pemulihan crash yang aman**. Celah yang tersisa: tidak ada reclaimer untuk `studio:processing`, tidak ada retry limit, hasil+ack belum atomik, dan dua worker masih dapat memproses ID sama bersamaan. Jangan mengklaim exactly-once.

## Dua belas skenario model nyata
**0 dari 12 dijalankan terhadap provider nyata.** Tes persiapan prompt yang sudah ada bukan evaluasi keluaran model. Tidak ada keluaran aktual, metadata model nyata, maupun skor yang sah untuk dipublikasikan. Rubrik yang ditetapkan: akurasi 25, pedagogi 20, struktur 15, pemanfaatan KB 15, sumber 15, kepatuhan 10. Skor tiap skenario: **BELUM DINILAI**. Penilaian manusia tetap wajib; sumber resmi harus dibaca dan diverifikasi sebelum diberi nilai.

## Audit trail
Metadata Chief Editor, prompt version, knowledge version, hash dokumen, provider/model dan status berada di respons API atau Redis result. Tidak ada bukti persistensi audit independen Redis. Database staging belum diverifikasi; tidak ada migrasi produksi.

## Risiko dan tindak lanjut
1. Jalankan pytest dan build di CI commit terbaru, simpan log.
2. Jalankan 12 skenario via endpoint autentikasi pada lingkungan pengujian dengan provider terkonfigurasi; simpan keluaran dan audit metadata tanpa rahasia.
3. Implementasikan lease/reclaimer, retry limit, dead-letter dan transaksi hasil+ack yang aman; uji crash/restart dengan Redis test instance.
4. Tambahkan audit store staging terpisah dan review keamanan sebelum deploy.
5. Minta penilaian editor dan guru pada keluaran model nyata.

**Tidak ada merge, deployment atau perubahan database produksi.**


## Pembaruan Tahap 1C.1

Worker produksi telah memperoleh Lua lease/heartbeat/fencing, reclaimer, batas retry dan dead-letter serta audit SQLite pada volume khusus proyek yang dikonfigurasi. Ini belum membuktikan seluruh simulasi crash nyata atau ketahanan terhadap Redis restart. Evaluasi 12 skenario provider nyata tetap **0/12 — BLOCKED**; tidak ada skor atau persetujuan manusia. Lihat `docs/STAGE_1C_1_RELIABILITY_AND_AI_EVALUATION_REPORT.md` untuk risiko dan bukti yang belum tersedia.


## Tahap 1C.2 — status verifikasi

Outbox Redis atomik untuk penyelesaian/kegagalan worker dan rekonsiliasi SQLite idempoten telah ditambahkan, tetapi persistensi Redis, SIGKILL nyata, dan 10 skenario crash belum terbukti. Evaluasi 12 skenario provider nyata tetap **0/12 — BLOCKED**; skor dan persetujuan manusia belum tersedia. Rincian: `docs/STAGE_1C_2_CRASH_RECOVERY_AND_AI_EVALUATION_REPORT.md`.
