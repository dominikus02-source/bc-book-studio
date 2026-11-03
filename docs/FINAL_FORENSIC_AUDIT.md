# Audit forensik awal — 4 November 2026

## Lingkup dan batas verifikasi
Audit dilakukan terhadap berkas terpilih melalui konektor GitHub, riwayat delapan commit terbaru, dan keberadaan cabang kerja. Belum dilakukan clone penuh, inspeksi seluruh pohon Git, audit kerentanan dependensi, pembacaan log Actions terbaru, atau inspeksi rahasia dan lingkungan VPS. Oleh karena itu, dokumen ini bukan audit menyeluruh yang telah selesai.

## Kondisi repositori
- Cabang `main` memiliki backend Next.js/Prisma, migrasi PostgreSQL, ekspor PDF/EPUB, dan workflow CI; commit `361f933` pernah ditunjukkan lulus CI #27 oleh pemilik.
- Cabang `feat/frontend-agent-foundation` berisi frontend Next.js pada `src/app`, komponen perintah buku, katalog agen, dan dokumentasi rancangan FastAPI/Redis/Celery. Pada cabang ini belum ditemukan `prisma/schema.prisma` dan `.github/workflows/ci.yml` pada lokasi yang diperiksa.
- Kedua cabang memiliki fondasi yang berbeda. Penggabungan tanpa review berisiko menghilangkan fitur.
- Cabang implementasi baru `feat/production-foundation-20261104` dibuat dari cabang frontend, tanpa menyentuh `main`.

## Temuan prioritas
| Prioritas | Temuan | Bukti | Tindakan |
|---|---|---|---|
| P0 | Tidak ada bukti autentikasi produksi/RBAC yang kuat pada cabang frontend | Pemeriksaan awal komponen frontend dan README | Jangan deploy publik; bangun identitas pengguna dan peran |
| P0 | Belum ada bukti alur produksi satu buku yang berjalan end-to-end | README cabang frontend menyatakan backend belum aktif | Tahan klaim siap produksi |
| P1 | Divergensi arsitektur `main` vs cabang frontend | Berkas `app/page.tsx` vs `src/app/page.tsx`, dependensi berbeda | Pertahankan cabang, rencanakan integrasi teruji |
| P1 | Infrastruktur database, Redis, pekerja, storage belum terbukti aktif di cabang frontend | README dan pemeriksaan lokasi berkas | Implementasi bertahap dengan tes integrasi |
| P1 | Belum terverifikasi log Actions dan pemeriksaan kerentanan terbaru | Akses yang diperiksa tidak menyediakan daftar run terbaru | Verifikasi sebelum merge |
| P2 | UI katalog agen belum membuktikan eksekusi model nyata | Komponen workspace dan README | Mulai gerbang AI server-side yang nyata |
| P2 | DOCX, EPUB fixed-layout, EPUBCheck, Drive OAuth belum teruji | Tidak ada bukti pengujian dalam audit terbatas | Tetapkan acceptance test masing-masing |
| P3 | Dokumentasi deploy dan runbook perlu disatukan | Cabang mempunyai rancangan berbeda | Perbarui dokumen status dan prosedur |

## Keputusan
Tidak mengubah `main`, tidak menggunakan Vercel/Supabase, tidak memasukkan kredensial, tidak menjalankan perintah terhadap VPS produksi BahasaCerdas.
