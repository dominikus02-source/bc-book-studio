# Matriks Penugasan Agen

Status: rancangan untuk backend. Matriks ini menjadi aturan awal, bukan eksekusi agen aktif.

| Tahap | Agen utama | Agen pendukung | Spesialisasi yang lazim |
|---|---|---|---|
| Riset kebutuhan | Riset dan Referensi | Pemimpin Redaksi | Literasi, sastra, literasi digital |
| Pemetaan kurikulum | Kurikulum | Riset dan Referensi, Penelaah Pedagogis | Asesmen, literasi |
| Perencanaan buku | Pemimpin Redaksi | Kurikulum, Penulis | Sesuai kategori buku |
| Penulisan | Penulis | Riset dan Referensi, Penyunting Bahasa | Linguistik, sastra, genre dan keterampilan menulis |
| Latihan | Latihan dan Asesmen | Kurikulum, Penelaah Pedagogis | Asesmen, tata bahasa dan ortografi |
| Visual | Ilustrasi dan Visual | Penulis, Penelaah Pedagogis | Literasi, literasi digital |
| Penyuntingan | Penyunting Bahasa | Riset dan Referensi | Linguistik, tata bahasa dan ortografi |
| Telaah pedagogis | Penelaah Pedagogis | Kurikulum, Latihan dan Asesmen | Asesmen, literasi |
| QA | Penjamin Mutu | Semua agen terkait | Semua yang relevan |
| Tata letak | Tata Letak | Penulis, Ilustrasi dan Visual | Literasi digital |
| Penerbitan | Penerbit | Pemimpin Redaksi, Penjamin Mutu | Sesuai kategori buku |

## Aturan pemilihan
1. Pilih agen utama berdasarkan tahap; agen pendukung hanya dipanggil jika kebutuhan eksplisit.
2. Cocokkan spesialisasi dengan topik dan jenis keluaran, bukan hanya jenjang.
3. Terapkan profil kelas sebagai konteks terpisah dari identitas agen.
4. Hitung risiko, batas biaya, ketersediaan model, dan kebutuhan sumber sebelum dispatch.
5. Jika tugas berdampak pada hak cipta, keselamatan anak, kurikulum, atau klaim faktual berisiko tinggi, wajibkan peninjauan manusia.
6. Catat alasan pemilihan dan versi matriks untuk setiap run.

## Batas concurrency awal
Pada VPS 4 vCPU / 8 GB RAM, mulai dengan 1 pekerjaan produksi aktif, maksimum 2 setelah uji beban dan pemantauan memori. Agen adalah peran logis, bukan 11 proses permanen.

## Spesialis produksi Quarto (QMD)

`qmd-book-agent` adalah **subagen kemampuan teknis**, bukan agen inti ke-12 atau proses permanen. Hanya `layout`, `qa`, dan `publisher` yang boleh dispatch subtask ini. Agen lain mengajukan kebutuhan melalui pemilik tahap terkait.

| Pemanggil | Handoff | Kewenangan tetap pada |
|---|---|---|
| `layout` | Generate `.qmd`, konfigurasi Quarto, tipografi, preview `DRAFT` | Layout: keputusan layout |
| `qa` | Lint, render uji, accessibility/format validation, bukti G7/G8 | QA: pass/fail |
| `publisher` | Artefak & manifest dari approved immutable snapshot | Publisher + manusia: keputusan rilis/G9 |

Kontrak lengkap: [`agents/specialists/qmd-book-agent.md`](specialists/qmd-book-agent.md). Rendering produksi tetap **nonaktif** sampai ada worker durable, sandbox aman, snapshot/approval terverifikasi, dan tes end-to-end. `logicalAgentCount` tetap 11.

## Scientific/multiformat publishing routing (contract v1.0.0)

Maintain **11 logical core agents** and dispatch `qmd-book-agent` only through `layout`, `qa`, or `publisher`.

| Requirement | Accountable core agent | Technical handoff |
|---|---|---|
| EYD V/KBBI VI, glossary, tracked changes, bilingual copy | `editorial` | `qa` reviews discrepancies |
| Scientific claims, physics/chemistry/mathematics | `research` and relevant specialization | `qa` checks evidence; subject expert human review where needed |
| Images, QR, maps, graphs, code and multimedia fallback specs | `visual` | `layout` calls QMD only for render preparation |
| Paper presets/custom, fonts, crop/bleed, portrait/landscape, templates | `layout` | `qmd-book-agent` for QMD and DRAFT preview |
| Export cross-format checks, accessibility, layout preflight | `qa` | `qmd-book-agent` for offline test rendering and evidence |
| Approved snapshot, release manifest, human signoff | `publisher` | `qmd-book-agent` generates artifacts only after snapshot/approval verification |
| AI provider selection incl. DeepSeek default policy | `chief_editor` and orchestration/provider gateway | No unrestricted model access by QMD renderer |

Detailed acceptance rules: [Scientific & Multiformat Publishing Contract](../docs/SCIENTIFIC_MULTIFORMAT_PUBLISHING_CONTRACT.md). These are **specifications, not implemented runtime capabilities**.
