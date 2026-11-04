# Konsistensi konten Tahap 3C.1

Perbaikan EPUB: urutan dokumen dari OPF spine, teks XHTML dari `itertext()`, Unicode NFC, entitas HTML, whitespace. Heading bertingkat dipertahankan sebagai teks. Dokumen navigasi tidak dihitung sebagai isi bab.

Tes regresi menyiapkan EPUB sintetis dengan tiga bab, heading bertingkat, elemen inline, entitas, nav, gambar, dan skenario bab ketiga hilang.

**Keterbatasan penting:** validator utama masih membandingkan daftar penanda bagian, belum seluruh paragraf sumber, seluruh ilustrasi, dan semua metadata. Karenanya konsistensi substantif penuh belum dapat dinyatakan LULUS.
