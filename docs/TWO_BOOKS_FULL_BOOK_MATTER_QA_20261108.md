# BC Book Studio — Audit Front Matter, Isi Utama, dan Back Matter pada Dua Buku
**Tanggal:** 8 November 2026  
**Lingkungan:** QA lokal DESKTOP-2NM1AUE, `F:/bc-book-import-export-20261106`, database `127.0.0.1:55999/bookstudio_import_qa`  
**Branch:** `integration/unified-book-workflow-20261107`  
**Keputusan:** **10/10 BERKAS PRATINJAU TERBENTUK + QA OTOMATIS PASS; PENERBITAN RESMI TETAP HOLD**

## Buku dan keluaran
1. *Fisika Itu Dekat: Eksplorasi Gerak, Gaya, Energi, dan Kalor untuk SMP Kelas 7*: 3 bab, DRAFT. PDF 14 halaman, DOCX, EPUB3, HTML standalone, Flipbook HTML. Dua sampul dan ketiga ilustrasi asli tersimpan.
2. *Momentum pada Tumbuhan: Fisika Gerak Biji, Tetes Hujan, dan Mekanisme Elastis*: 3 bab, DRAFT. PDF 8 halaman, DOCX, EPUB3, HTML standalone, Flipbook HTML. Dua sampul bertema sesuai judul.
   
## Struktur yang secara otomatis dihasilkan dari metadata dan naskah yang tersimpan
1. Sampul depan dengan judul, subjek, penulis dan status DRAF.
2. Halaman judul.
3. Halaman identitas buku, hak cipta, status penulis, kolom penerbit/ISBN yang belum terverifikasi.
4. Kata pengantar yang mengambil sasaran pembaca dan tujuan penulisan dari metadata pengguna.
5. Petunjuk pembaca, termasuk catatan kebutuhan akses.
6. Daftar isi otomatis (TOC Quarto/Word/EPUB nav dan menu Flipbook).
7. Isi utama Bab 1, Bab 2 dan Bab 3, termasuk ilustrasi internal yang sah menurut status QA, tabel, dan rumus.
8. Referensi dan Sumber: area validasi sitasi, **masih menunggu sumber asli**.
9. Daftar Pustaka dan Bibliografi: **belum ada entri pustaka yang terverifikasi**; sistem menampilkan penanda eksplisit, bukan mengarang buku, jurnal, penulis, DOI, ISBN, URL atau tahun.
10. Sampul belakang yang menampilkan susunan isi berdasarkan tiga judul bab asli. Kolom deskripsi panjang/templat instruksi tidak dicetak otomatis sebagai klaim pemasaran.

## Pelaksanaan teknis
- `scripts/book-front-back.cjs`: pembuat sampul PNG 1200×1800, kata pengantar, halaman identitas, panduan, referensi dan bibliografi, serta struktur depan/belakang; bukan sumber data palsu.
- `scripts/export-two-draft-books.cjs`: menggabungkan bagian buku, memetakan aset `asset:id`, Quarto DOCX/EPUB/HTML dan Typst PDF, memperkaya metadata EPUB, menyusun Flipbook offline berinteraksi, serta manifest dengan SHA-256.
- **PDF**: sampul depan full page pada halaman pertama dan belakang full page pada halaman terakhir menggunakan pdf-lib. Halaman internal memuat TOC dengan nomor halaman berdasarkan isi non-sampul. PDF hasil diperiksa dengan pdfjs dan sebagian render raster.
- **DOCX**: OOXML menempatkan blok gambar sampul depan sebelum halaman judul, menambah pemisah halaman, dan memisahkan sampul belakang. Sifat ini diverifikasi urutannya dalam `word/document.xml`; **belum ada uji buka/edit/render nyata dengan MS Word atau LibreOffice**.
- **EPUB3**: OPF manifest menandai gambar sampul depan `properties="cover-image"`, teks alternatif per gambar diambil dari aset tersimpan; EPUBCheck 5.4.0 **0 fatal / 0 error / 0 warning** pada kedua berkas.
- **HTML**: visualisasi di Chromium Playwright pada viewport 390 px, gambar dan seluruh teks bagian buku berhasil muncul, tanpa overflow global.
- **Flipbook**: 12 bagian logis (5 bagian depan, 1 daftar isi, 3 bab, 3 bagian belakang), pilihan judul bagian, navigasi tombol/keyboard, mode baca linear dan kembali ke mode satu bagian; tidak menggunakan gerakan kartu.
- Berkas hasil, `EPUBCHECK_5.4.0.txt`, ringkasan QA, dan `BACA-DAHULU.txt` dipaketkan dalam dua ZIP privat.

## Bukti pengujian
- `node scripts/export-two-draft-books.cjs`: seluruh 10 format GENERATED.
- `node scripts/verify-two-draft-books.cjs`: **PASS** seluruh 10 format, struktur, gambar, TOC/halaman, checksum, sampul pertama/terakhir, label EPUB, dan 12 bagian Flipbook.
- `java -jar epubcheck.jar` dengan EPUBCheck 5.4.0 pada masing-masing EPUB terbaru: exit 0, 0 warning / 0 error.
- `node tests/two-books-five-format-download-e2e.cjs`: **PASS** hanya owner, bukti unduhan 6 pilihan (5 format + ZIP), akses anonim 401, pihak luar 404, navigasi Stage 3/Penerbitan.
- Bentuk PDF first/back, DOCX/EPUB metadata, serta sampul belakang buku Fisika sudah diperiksa secara visual/struktural.
- Catatan: Uji Word/LibreOffice round-trip, NVDA/JAWS/VoiceOver/TalkBack, pemeriksaan pembaca elektronik fisik dan preflight cetak PDF/X/PDF/UA masih **NOT RUN**.

## Lokasi berkas
`F:/bc-book-import-export-20261106/artifacts/20261108-two-book-draft-previews/`

- `fisika-itu-dekat-eksplorasi-gerak-gaya-energi-dan-kalor.zip`
- `momentum-pada-tumbuhan-fisika-gerak-biji-tetes-hujan-da.zip`
- `PREVIEW_MANIFEST.json`, `PREVIEW_VALIDATION_REPORT.json`

Endpoint download hanya untuk pemilik buku melalui login lokal:
- `http://127.0.0.1:32979/api/books/cmw6gk5gu005wurcoe0dk02jr/draft-artifacts?type=zip`
- `http://127.0.0.1:32979/api/books/cmw7ad8q20000urfofr6mioge/draft-artifacts?type=zip`

## Ruang lingkup yang belum selesai
Generator dan hasil di atas adalah pipeline **QA lokal untuk dua buku terpilih**, bukan bukti semua buku baru di seluruh production app otomatis memperoleh seluruh bagian ini. Integrasi end-to-end ke ekspor umum produksi perlu dilakukan dengan PR terpisah dan suite regresi penuh. Sumber bibliografi yang belum tersedia harus disuplai/diteliti dan diverifikasi sebelum daftar pustaka boleh dianggap selesai. Kedua buku tetap DRAFT, belum ada ISBN Perpusnas yang ditetapkan, belum ada approval reviewer independen atau bukti distribusi. **NO-GO produksi**.
