# Laporan QA Visual Penerbitan — Tahap 3C.2

## A. Ringkasan

**Status keseluruhan: BLOCKED — belum siap diajukan sebagai buku final.**

Baseline cabang sebelum perubahan: `e5f1f787144315530e7718a30e995458c0fbd8f1`. Perbandingan GitHub menunjukkan tidak ada commit tambahan sebelum pekerjaan ini. Status working tree lokal tidak dapat diverifikasi melalui API GitHub; perubahan yang belum dipush pada PC pengguna tidak terlihat.

Perubahan nyata: workflow `.github/workflows/grade7-book.yml` diperluas untuk menyimpan diagnostik PDF (`qpdf --check`, `pdffonts`, `pdfimages -list`, katalog PDF) dan raster halaman (`pdftoppm`). Ini bukan bukti bahwa semua halaman sudah diperiksa manusia.

## B. PDF Forensic

Log sebelumnya dari run `41745638354`: PDF Typst 0.15.1, PDF 1.7, 25 halaman A4, metadata judul dan penulis ada; Poppler mengeluarkan `Syntax Error: Suspects object is wrong type (boolean)`. `pdfinfo` tetap berhasil. Akar penyebab spesifik **belum terbukti**. Tidak ada tindakan menghapus metadata, menekan stderr, atau menyatakan false positive. Menunggu artefak baru dan hasil qpdf/katalog.

## C. Rencana tujuh ilustrasi

| No. | Aset | Lokasi | Fungsi pembelajaran | Rasio | Caption dan alt-text yang direncanakan | Sumber/hak | Status |
|---|---|---|---|---|---|---|---|
| 1 | sampul-literasi | Sampul | Menunjukkan membaca dan menulis | 3:4 | Sampul: siswa SMP membaca dan menulis di lingkungan belajar | Belum dibuat/belum ada lisensi | BLOCKED |
| 2 | sudut-baca | Bab 1 contoh deskripsi | Menafsirkan rincian ruang | 4:3 | Sudut baca: rak, jendela, meja bundar | Belum dibuat/belum ada lisensi | BLOCKED |
| 3 | observasi-objek | Bab 1 aktivitas | Memilah detail yang teramati | 4:3 | Siswa mengamati benda dan mencatat ciri | Belum dibuat/belum ada lisensi | BLOCKED |
| 4 | unsur-narasi | Bab 2 materi | Mengidentifikasi tokoh, latar, konflik | 4:3 | Adegan perpustakaan dengan tokoh dan latar | Belum dibuat/belum ada lisensi | BLOCKED |
| 5 | alur-cerita | Bab 2 analisis | Menelusuri urutan sebab-akibat | 16:9 | Tiga adegan berurutan tanpa teks di dalam gambar | Belum dibuat/belum ada lisensi | BLOCKED |
| 6 | proses-menulis | Bab 3 materi | Mengurutkan ide, draf, revisi | 16:9 | Tiga tahap menulis dengan buku catatan | Belum dibuat/belum ada lisensi | BLOCKED |
| 7 | menyunting-teks | Bab 3 aktivitas | Mengenali kegiatan penyuntingan | 4:3 | Siswa membandingkan dua draf dengan tanda revisi | Belum dibuat/belum ada lisensi | BLOCKED |

Metadata wajib yang belum tersedia: resolusi, ukuran byte, SHA-256, bukti hak penggunaan, dan berkas final. Semua aset harus disalurkan lewat `assets` dan `asset_root` sebelum integrasi dinyatakan selesai. Jangan memakai URL eksternal.

## D. Pemeriksaan visual

**Halaman diperiksa secara visual: 0 dari 25 halaman baseline.** Workflow kini menghasilkan pratinjau halaman PDF, tetapi belum ada bukti inspeksi seluruh halaman. Temuan per halaman belum tersedia. Belum ada tangkapan layar yang telah ditinjau. Perlu cek sampul, daftar isi, setiap awal bab, aktivitas, latihan, glosarium, dan daftar pustaka; catat masalah dan halaman aktual.

## E. Validasi tiga format

| Format | Bukti sebelumnya | Bukti terbaru | Status |
|---|---|---|---|
| DOCX | Berhasil dirender pada run 41745638354 | Belum diperiksa ulang | WARNING |
| PDF | 25 halaman, A4; peringatan /Suspects | Forensik baru belum dijalankan | WARNING |
| EPUB | EPUBCheck 0 error/0 warning pada run 41745638354 | Belum diperiksa ulang | WARNING |

Ukuran dan SHA-256 **artefak final baru** belum tersedia. Hasil baseline tidak boleh dipakai sebagai checksum untuk hasil baru.

## F. Temuan dan risiko

Selesai: audit sumber fixture dan konfigurasi, penambahan langkah diagnostik PDF dan pratinjau halaman ke workflow.

Belum selesai: akar peringatan PDF, tujuh gambar asli, integrasi aset, perbaikan layout, inspeksi visual, perbandingan visual EPUB/DOCX, CI baru dan verifikasi checksum final.

Risiko: keluaran Quarto default belum memiliki desain cetak yang diaudit; PDF warning masih belum dijelaskan; identitas penerbit dalam fixture merupakan label pengujian, bukan persetujuan publikasi.

Persetujuan manusia: guru Bahasa Indonesia, editor bahasa, desainer buku, dan penanggung jawab hak penggunaan aset belum memberikan persetujuan.

## G. Keputusan

**BLOCKED — perlu revisi teknis dan pemeriksaan editorial sebelum dinyatakan siap ditinjau sebagai buku final.** Jangan merge atau deploy. Langkah berikutnya: jalankan CI terbaru, unduh PDF dan log, tentukan akar /Suspects, buat dan dokumentasikan ilustrasi, integrasikan ke sumber, render ulang dan inspeksi seluruh halaman.
