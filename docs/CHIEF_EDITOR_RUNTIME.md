# Runtime Chief Editor — Tahap 1B

Status: PARTIAL; perubahan kode tersedia, hasil CI terbaru belum diperiksa.

## Alur
API `POST /api/v1/drafts` memvalidasi bearer dan request, lalu memanggil `prepare_draft` di `backend/app/agents/chief_editor.py`. Modul itu menyusun aturan inti dan konteks proyek, memanggil `load_knowledge(category)`, dan mengirim system/prompt ke `complete`. Hasil menyertakan agent, prompt_version, knowledge_version, nama serta hash SHA-256 dokumen, kategori, timestamp, provider/model aktual, status review dan persetujuan manusia.

Worker memanggil `prepare_draft` yang sama. Tidak ada publikasi otomatis. Peran pada `agents/registry.py` adalah konfigurasi; belum ada eksekusi 15 model terpisah.

## Kategori dan pengetahuan
Writing: handbook, writing, bahasa, pedagogi, kurikulum, sumber. Assessment: asesmen, pedagogi, kurikulum, bahasa, QA. Illustration: visual, writing, QA. Publishing: penerbitan, QA, sumber. Integration: integrasi, protokol, QA.

Loader hanya membaca berkas dari allowlist; menolak dokumen kosong, tidak tersedia, symlink dan konteks lebih dari 24000 karakter. Tidak ada pemotongan diam-diam. Hash digunakan untuk identifikasi versi dokumen, bukan verifikasi fakta di dalamnya.

## Runtime container
Dockerfile sekarang memakai build context akar repo sehingga `docs/knowledge-base` disalin ke image backend dan worker. `compose.staging.yml` diperbarui; belum dideploy.

## Batasan
Worker memakai antrean processing dan dead-letter tetapi belum memiliki reclaimer otomatis untuk pekerjaan tertinggal saat crash, transaksi Redis atomik hasil+ack, atau audit trail permanen. Metadata berada di hasil API/Redis, belum di basis data audit permanen. Kegagalan loader menghasilkan 503 dan tidak boleh jatuh ke prompt generik. Persetujuan manusia wajib.

## Pengujian
`PYTHONPATH=backend pytest -q backend/tests` dan workflow backend CI; tes baru memeriksa pemilihan dokumen, error, metadata, API mock, worker mock dan registry. Pengujian model nyata dan 12 evaluasi masih perlu bukti.


## Pembaruan Tahap 1C.1

Worker produksi telah memperoleh Lua lease/heartbeat/fencing, reclaimer, batas retry dan dead-letter serta audit SQLite pada volume khusus proyek yang dikonfigurasi. Ini belum membuktikan seluruh simulasi crash nyata atau ketahanan terhadap Redis restart. Evaluasi 12 skenario provider nyata tetap **0/12 — BLOCKED**; tidak ada skor atau persetujuan manusia. Lihat `docs/STAGE_1C_1_RELIABILITY_AND_AI_EVALUATION_REPORT.md` untuk risiko dan bukti yang belum tersedia.
