# Standar Produksi Buku
Versi 1.0.0

Satu snapshot naskah disetujui menghasilkan Quarto → DOCX, PDF (Typst), EPUB dan opsional HTML. Simpan hash input, versi renderer, log, output terpisah per format, ukuran dan SHA-256 final. Render harus offline, tidak berhak istimewa, sumber read-only, tanpa kredensial.

PDF: cek A4, metadata, font, objek, jumlah halaman, halaman kosong, margin, visual per halaman dan warning parser. DOCX: cek ZIP, heading, tabel, gambar, TOC dapat diperbarui. EPUB: EPUBCheck, OPF, spine, nav, XHTML, gambar, alt-text dan isi. Bandingkan teks substantif dari sumber, bukan hanya keberadaan file.

Rilis memerlukan gerbang teknis dan persetujuan manusia dengan hash snapshot; preview wajib berlabel NOT APPROVED. CI hijau bukan persetujuan penerbitan. Perubahan renderer harus diuji regresi lintasformat.

## Scientific/multiformat addendum (v1.0.0 proposal)

Apply [Scientific & Multiformat Publishing Contract](../SCIENTIFIC_MULTIFORMAT_PUBLISHING_CONTRACT.md) to HTML, PDF, DOCX and EPUB3; ensure editable DOCX heading/table/illustration structures and format-specific multimedia fallbacks. Support preset/custom paper dimensions, portrait/landscape, gutter/bleed and print profiling only after renderer-specific verification. Include font embedding/license and paper settings in manifest. Mixed orientation or PDF/X requirements must be marked unsupported until validated. Quality claims require real output verification, not green CI alone.
