# Matriks integrasi cabang — audit parsial

| Kemampuan | main | feat/frontend-agent-foundation | Arah integrasi |
|---|---|---|---|
| Dashboard editorial | UI sederhana terhubung API | UI komprehensif, sebagian simulasi | Pertahankan UX cabang frontend; hubungkan API bertahap |
| Katalog agen | Belum lengkap | 11 peran dan dokumen katalog | Pertahankan katalog; tambahkan eksekusi nyata |
| PostgreSQL | Prisma schema dan migrasi | Belum ditemukan pada lokasi standar | Gunakan PostgreSQL mandiri, migrasi backend terkontrol |
| API buku | Next.js API | Belum terhubung | Rancang kontrak FastAPI berversi; migrasi endpoint bertahap |
| Ekspor | PDF dan EPUB sederhana | UI rancangan | Port setelah tes format dan hak akses |
| Persetujuan | Token editor/reviewer terpisah | Kebijakan manusia dalam dokumen | Ganti token statis dengan identitas dan RBAC |
| AI | Draf berbasis chat completions | Katalog peran | DeepSeek utama; adaptor multi-provider di backend |
| Redis/worker | Belum terbukti | Belum aktif | Redis dan worker terpisah dengan DB checkpoint |
| DOCX/fixed-layout | Belum | Belum | Tahap lanjutan |
| Drive OAuth | Belum | Belum | Tahap lanjutan |

Risiko P0: migrasi UI dan API tanpa kontrak dapat memutus fitur. Risiko P1: skema Prisma dan SQL berbeda; jangan menjalankan keduanya pada database yang sama tanpa migrasi data yang disetujui.

Keputusan sementara: frontend Next.js cabang frontend + FastAPI berversi + PostgreSQL mandiri; kode ekspor main dipertahankan sebagai referensi porting, tidak dihapus. Perbandingan ini berdasarkan berkas yang berhasil dibaca, bukan audit seluruh pohon repository.
