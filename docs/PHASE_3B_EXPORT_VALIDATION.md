# Validasi ekspor

Alat baru: `publishing/tests/validate_grade7_exports.py`.

Pemeriksaan: integritas ZIP DOCX/EPUB, MIME EPUB, OPF, judul tiga bab dan penanda pedagogis pada tiga format, ukuran PDF A4, jumlah halaman minimum, EPUBCheck, checksum SHA-256. Laporan JSON ditulis ke direktori artefak CI.

Keterbatasan: pembandingan penanda bukan diff paragraf penuh; inspeksi visual dan kesesuaian semua gambar belum dilakukan. PDF `Suspects object is wrong type` pada screenshot sebelumnya belum diverifikasi ulang. Perintah `pdfinfo` perlu ditinjau log stderr jika peringatan tetap muncul.

**Status aktual**: belum ada bukti hasil eksekusi workflow terbaru, sehingga DOCX/PDF/EPUB = BELUM DIPERIKSA.
