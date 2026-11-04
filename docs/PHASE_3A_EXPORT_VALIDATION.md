# Validasi ekspor

Pipeline yang ditargetkan: satu snapshot → QMD → Quarto DOCX, Typst PDF, EPUB. Script `publishing/tests/test_grade7_fixture.py` menambahkan pemeriksaan ZIP DOCX/EPUB dan judul ketiga bab. Perintah `pdfinfo` dan `epubcheck` tetap dipertahankan bila terpasang.

**Hasil aktual pada sesi ini:** belum ada file DOCX, PDF, atau EPUB yang dihasilkan dan diperiksa. Tidak ada klaim bahwa dokumen dapat dibuka atau lolos EPUBCheck.

Pemeriksaan yang masih wajib: rendering CI nyata, metadata EPUB, navigasi, daftar isi, kualitas gambar, font, overflow, A4, halaman kosong, kesesuaian latihan, checksum artefak, dan pembandingan isi antarformat. Jangan menyamakan pemeriksaan keberadaan file dengan validasi editorial.
