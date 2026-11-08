# BC Book Studio — Dua Buku, Lima Format Pratinjau
**Tanggal:** 8 November 2026  
**Lingkungan:** DESKTOP-2NM1AUE / F:/bc-book-import-export-20261106 / database QA `127.0.0.1:55999/bookstudio_import_qa`  
**Branch:** integration/unified-book-workflow-20261107  
**Keputusan:** **Pembuatan berkas pratinjau 10/10 PASS. Persetujuan editorial dan penerbitan resmi tetap HOLD.**

## Buku sumber
1. **Fisika Itu Dekat: Eksplorasi Gerak, Gaya, Energi, dan Kalor untuk SMP Kelas 7** — ID `cmw6gk5gu005wurcoe0dk02jr`, 3 bab, status DRAFT, belum disetujui.
2. **Momentum pada Tumbuhan: Fisika Gerak Biji, Tetes Hujan, dan Mekanisme Elastis** — ID `cmw7ad8q20000urfofr6mioge`, 3 bab, status DRAFT, belum disetujui.

## Keluaran nyata (tiap buku)
- **DOCX** dibuat Quarto 1.9.37 dan diverifikasi paket `word/document.xml`, teks 3 judul bab. Buku Fisika memiliki gambar embedded.
- **PDF** dibuat Quarto Typst, dibuka dan teks diekstrak dengan pdfjs-dist, diuji halaman pertama dan isi melalui render PNG. Buku Fisika 9 halaman; Momentum 4 halaman.
- **EPUB** dibuat Quarto dan diperiksa dengan EPUBCheck v5.4.0 Java: **kedua EPUB 0 fatal, 0 error, 0 warning, exit 0**. Berkas log di dalam ZIP.
- **HTML** dibuat Quarto, dibuka browser Chromium dengan Playwright; tiga bab, penanda DRAF, tidak overflow pada 390px, tiga gambar Fisika tampil.
- **Flipbook HTML** dibuat sebagai pembaca offline berinteraksi per bab: tombol sebelumnya/berikutnya, navigasi keyboard, gestur sentuh (dukungan implementasi, belum diuji perangkat fisik), kontrol ukuran teks, daftar isi, mode baca linear, dan gambar tersemat. Browser menguji tombol, keyboard dan mode linear beserta kembali ke tampilan satu bab. Ini belum pagination cetak/page-turn standar penerbit.
- Gambar internal `asset:` untuk buku Fisika sudah dipetakan ke media nyata di DOCX, EPUB, HTML, PDF dan Flipbook. Teks alternatif mengikuti gambar tersimpan. Naskah database tidak diubah.
- Judul bab yang berulang antara metadata dan H1 sumber dihapus **hanya pada proses rendering ekspor**, demikian pula penggandaan awalan referensi silang Quarto `Tabel @tbl`. Data sumber tetap utuh.

## Arsip ZIP
Folder: `F:/bc-book-import-export-20261106/artifacts/20261108-two-book-draft-previews/`

1. `fisika-itu-dekat-eksplorasi-gerak-gaya-energi-dan-kalor.zip`
2. `momentum-pada-tumbuhan-fisika-gerak-biji-tetes-hujan-da.zip`

Setiap ZIP memuat lima format, `BACA-DAHULU.txt`, `EPUBCHECK_5.4.0.txt` dan `VALIDATION_SUMMARY.json`. Detail checksum SHA-256, ukuran, jalur, metadata disimpan pada `PREVIEW_MANIFEST.json` dan `PREVIEW_VALIDATION_REPORT.json`. Folder artifacts diabaikan Git untuk mencegah commit manuskrip privat.

## Tautan unduh aman (hanya pengguna yang login sebagai pemilik buku)
- Buku Fisika: http://127.0.0.1:32979/api/books/cmw6gk5gu005wurcoe0dk02jr/draft-artifacts?type=zip
- Buku Momentum: http://127.0.0.1:32979/api/books/cmw7ad8q20000urfofr6mioge/draft-artifacts?type=zip
- Halaman studio: http://127.0.0.1:32979/studio

Parameter `type` dapat diubah ke `docx`, `pdf`, `epub`, `html`, `flipbook`, atau `manifest`. Akses anonim 401 dan pengguna lain 404, hasil download ber-header attachment/no-store dan hanya sesuai whitelisted manifest. Tautan localhost hanya dapat dibuka dari komputer yang menjalankan dev server.

## Bukti QA
- `node scripts/export-two-draft-books.cjs`: dua buku, sepuluh keluaran GENERATED, exit 0.
- `node scripts/verify-two-draft-books.cjs`: sepuluh format dibuka/dianalisis, byte dan SHA-256 cocok, chapter order/contents benar, zip dua buku, exit 0.
- `java -jar epubcheck.jar [dua EPUB]`: masing-masing 0 error/warning, exit 0, log disimpan.
- `node tests/two-books-five-format-download-e2e.cjs`: akses owner, akses negatif, download ZIP, UI Stage 3 dan Penerbitan, exit 0.
- `npm run typecheck`: exit 0.
- `npx next build` pada clone build terisolasi: exit 0, route unduh terkompilasi.
- `git diff --check`: exit 0.
- PDF halaman pertama kedua buku dan halaman isi buku Fisika dirender ke PNG dan diperiksa visual. DOCX belum diuji round-trip membuka/mengedit dalam Word/LibreOffice; uji screen-reader dan perangkat sentuh asli belum dilakukan.

## Batasan dan langkah yang tetap membutuhkan manusia
**Dokumen pratinjau bukan publikasi final.** Kedua buku masih DRAFT, ISBN resmi belum diperoleh/diperiksa, belum ada reviewer independen yang menandatangani, belum ada bukti printer/output PDF/X atau PDF/UA, EPUB Accessibility 1.1/Ace, WCAG 2.2 AA, legalitas hak seluruh materi, dan bukti distribusi atau serah simpan. EPUBCheck menyatakan kemasan EPUB valid, bukan sertifikasi aksesibilitas/ISBN.

Pengaman `/api/books/[id]/publication` tetap memerlukan bukti sah dan mengembalikan NO-GO untuk persyaratan yang belum lengkap. Tidak ada produksi, staging, GitHub push/merge maupun perubahan editorial status/ISBN dalam tugas ini.
