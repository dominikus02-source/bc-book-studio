# Investigasi PDF /Suspects

**Log aktual run 41745638354:** `Syntax Error: Suspects object is wrong type (boolean)` dari pdfinfo/Poppler. PDF dibuat Typst 0.15.1, 25 halaman, A4 595.276 × 841.89 pt, PDF 1.7, Tagged yes, Metadata Stream yes, pdfinfo tetap exit sukses.

**Interpretasi terbatas:** keluaran pdfinfo tetap dapat dibaca, sehingga peringatan saja tidak membuktikan kerusakan fatal. Namun belum ada inspeksi dictionary objek PDF, sehingga tidak boleh menyimpulkan kesalahan Poppler atau Typst.

**Tindakan tertunda:** unduh PDF artefak, periksa katalog dan info dictionary `/Suspects` memakai qpdf/mutool, jalankan `qpdf --check`, `pdffonts`, `pdfimages -list`, serta bandingkan hasil pdfinfo pada versi Poppler lain. Jangan menghapus properti metadata atau menekan stderr tanpa diagnosis.
