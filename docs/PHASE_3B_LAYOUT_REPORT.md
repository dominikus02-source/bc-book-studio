# Pemeriksaan tata letak

Status: **BELUM DIPERIKSA secara visual**.

Konfigurasi QMD saat ini memakai `format: typst: default` dan `docx: default`; belum menetapkan margin A4, header/footer, nomor halaman, atau desain sampul secara eksplisit. Penambahan pemeriksaan PDF A4 pada `validate_grade7_exports.py` akan menolak hasil yang tidak A4, tetapi belum membuktikan margin, font, overflow, tabel, atau halaman kosong.

Daftar isi Quarto berasal dari daftar bab, namun pembaruan TOC DOCX dan navigasi EPUB harus diuji secara nyata. Peninjauan halaman PDF satu per satu tetap diperlukan.
