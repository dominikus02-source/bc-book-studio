# Standar Produksi Buku
Versi 1.0.0

Satu snapshot naskah disetujui menghasilkan Quarto → DOCX, PDF (Typst), EPUB dan opsional HTML. Simpan hash input, versi renderer, log, output terpisah per format, ukuran dan SHA-256 final. Render harus offline, tidak berhak istimewa, sumber read-only, tanpa kredensial.

PDF: cek A4, metadata, font, objek, jumlah halaman, halaman kosong, margin, visual per halaman dan warning parser. DOCX: cek ZIP, heading, tabel, gambar, TOC dapat diperbarui. EPUB: EPUBCheck, OPF, spine, nav, XHTML, gambar, alt-text dan isi. Bandingkan teks substantif dari sumber, bukan hanya keberadaan file.

Rilis memerlukan gerbang teknis dan persetujuan manusia dengan hash snapshot; preview wajib berlabel NOT APPROVED. CI hijau bukan persetujuan penerbitan. Perubahan renderer harus diuji regresi lintasformat.
