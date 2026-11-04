# Audit mesin penerbitan — Tahap 3A (4 November 2026)

Audit kode pada cabang kerja, bukan audit seluruh deployment. Berkas diperiksa: `publishing/qmd_pipeline.py`, `render_job.py`, `run-sandbox.sh`, `Dockerfile`, `tests/render_smoke.py`, `tests/test_qmd_pipeline.py`, `discipline-profiles.json`.

## Temuan
- **P0 — Persetujuan editorial**: `generate(release=True)` memeriksa string `approvalId` dan `approvalStatus` dalam snapshot, bukan tanda tangan/persetujuan yang diverifikasi terhadap database. Fixture sintetis tidak boleh diperlakukan sebagai persetujuan manusia.
- **P0 — Bukti produksi**: belum ada satu buku kelas VII lengkap yang terbukti lolos pemeriksaan isi dan render DOCX/PDF/EPUB.
- **P1 — Render**: Quarto mengosongkan `_book` pada render berikutnya. `render_job.py` sudah menyalin output per format dan `render_smoke.py` memeriksa setiap format langsung; regresi lama pada commit `bcf8bae` tidak tampak pada versi cabang saat ini.
- **P1 — PDF**: `typst` menghasilkan PDF tetapi tidak membuktikan ukuran A4, margin, font, overflow, halaman kosong, atau keterbacaan.
- **P1 — DOCX/EPUB**: pemeriksaan sekarang hanya keberadaan file; EPUBCheck dijalankan pada worker, tetapi inspeksi konsistensi konten, navigasi, dan gambar belum ada.
- **P1 — Keamanan**: `run-sandbox.sh` mengisolasi network, user, capabilities, resource, dan mount; tetap mensyaratkan Docker rootless/user namespaces di host. Tidak boleh dieksekusi di produksi tanpa verifikasi host.
- **P1 — Ilustrasi**: validasi hash aset tersedia, tetapi tidak ada bukti gambar berkualitas cetak, metadata lisensi terpercaya, dan alt-text teruji pada semua format.
- **P2 — Konten**: `discipline-profiles.json` adalah daftar cek editorial, bukan validator fakta. Materi Bahasa Indonesia kelas VII belum memiliki profil spesifik.
- **P2 — Konsistensi**: satu sumber Quarto dapat merender banyak format, tetapi verifikasi heading/latihan/tabel lintas format belum otomatis.
- **P2 — Integrasi**: frontend dan backend belum terbukti menjalankan persetujuan, pembuatan snapshot, antrean, render sandbox, dan penyimpanan artefak secara end-to-end.

## Ketergantungan
Quarto 1.11.9, Typst via Quarto, EPUBCheck, Poppler pdfinfo, Java/EPUBCheck sesuai lingkungan, Docker untuk sandbox. Unduhan Quarto pada Dockerfile memiliki checksum SHA-256 yang dipin.

## Keputusan
Bangun fixture buku **pratinjau yang belum disetujui** menggunakan `generate(..., release=False)`, bukan menyalahgunakan approval sintetis untuk publikasi. CI harus menguji format nyata dan memublikasikan artefak terpisah. Status tetap BELUM LULUS sampai hasil diperiksa.
