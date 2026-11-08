# SOP ISBN — PT Bahasa Cerdas Indonesia

**Status:** Dokumen internal operasional. Belum menjadi persetujuan, pendaftaran, atau penerbitan ISBN resmi. Rujukan: Peraturan Perpustakaan Nasional Republik Indonesia Nomor 11 Tahun 2025 dan panduan di https://isbn.perpusnas.go.id/landing_page/home. Verifikasi lampiran format resmi sebelum tanda tangan.

## 1. Pendaftaran perusahaan penerbit

PT Bahasa Cerdas Indonesia wajib memakai **nama badan hukum persis sesuai dokumen pendirian**, tidak mengarang NIB, nomor AHU, alamat, pejabat penanda tangan, akta ataupun KBLI. Pastikan bidang penerbitan tercakup dalam NIB/KBLI.

Persyaratan inti pendaftaran penerbit di Perpusnas:
- Surat pernyataan menjadi anggota ISBN yang ditandatangani direktur sesuai contoh lampiran resmi.
- Bukti pengesahan badan hukum dan NIB yang memuat KBLI penerbitan (untuk PT).
- Domain situs resmi milik penerbit, profil perusahaan, katalog publik, tautan spesifik judul, dan informasi akses/distribusi. Jangan menawarkan penjualan jasa ISBN.
- Unggah dokumen **PDF** melalui portal resmi Perpusnas. Hanya Perpusnas yang dapat menetapkan status akun.

Dashboard menyimpan draf data legal, brankas PDF dan status internal; tidak mendaftar atas nama perusahaan secara otomatis.

## 2. Pengajuan ISBN per judul dan edisi

Setiap permohonan diikat ke **Book.id** internal, dengan identitas edisi: judul, subjudul, penulis, bahasa, format, binding, ukuran, edisi, katalog URL, hak cipta, dan tujuan pasar. Untuk penerbit berkedudukan di Indonesia, edisi berbahasa Inggris atau dijual ke negara lain **tetap diajukan melalui Perpusnas**, sesuai kewenangan ISBN nasional dan International ISBN Agency. ISBN edisi cetak dan edisi digital/format produk yang berbeda tidak boleh disalin sembarangan.

Persyaratan dokumen pengajuan:
- Surat permohonan ISBN dengan kop, tanda tangan pimpinan, dan stempel;
- Halaman judul, halaman verso/hak cipta, kata pengantar, daftar isi;
- Naskah akhir dengan watermark;
- SPKK bermeterai untuk karya asli atau yang dialihkan;
- Izin tertulis pemilik hak cipta untuk terjemahan;
- Surat pengalihan penerbitan untuk hak yang dialihkan;
- Surat keterangan dan bukti sumber untuk karya domain publik;
- Tautan katalog di situs penerbit yang mengarah langsung ke judul yang dimohonkan.
Dokumen pengajuan resmi harus disiapkan sebagai **PDF** sesuai aturan. DOCX yang dihasilkan dashboard hanya **template kerja untuk disunting**.

## 3. Status dan gate di dashboard

`DRAFT` → `DOCUMENTS_READY` → `SUBMITTED_EXTERNAL` → `ISSUED` → `PUBLISHED`.

Perbaikan: `CORRECTION_REQUIRED` → `DOCUMENTS_READY`. Jalur penolakan/arsip tersedia. Status `SUBMITTED_EXTERNAL` hanya dicatat setelah operator benar-benar mengirim di portal resmi dan memasukkan referensi; naskah buku harus APPROVED, berkas lengkap, katalog spesifik, dan akun Perpusnas aktif. Status `ISSUED` memerlukan ISBN-13 dengan digit pemeriksa valid **serta bukti penetapan resmi** berupa dokumen PDF atau tautan Perpusnas. Angka checksum valid saja **tidak membuktikan penerbitan nomor**.

Dokumen legal/ISBN tidak ditampilkan ke publik, hanya ke akun ADMIN yang berwenang. PDF yang diunggah disimpan beserta SHA-256. Dokumen arsip dipertahankan untuk audit. Gunakan HTTPS dan backup terenkripsi pada server produksi.

## 4. Sesudah penerbitan ISBN

- Letakkan ISBN/KDT pada halaman verso, barcode pada bagian bawah sampul belakang untuk cetak; aturan digital mengikuti jenis media (Pasal 12–17).
- Peraturan 11/2025 menetapkan batas waktu penerbitan 20 hari kerja untuk karya cetak dan 10 hari kerja untuk karya rekam setelah memperoleh ISBN; hitung kalender kerja dan libur resmi secara sah, jangan sekadar menambahkan hari kalender.
- Pemegang ISBN tetap memiliki kewajiban bukti terbit, akses/distribusi dan serah simpan menurut ketentuan yang berlaku.
- Layanan pengajuan ISBN Perpusnas tidak dipungut biaya menurut Pasal 3.
- Cek langkah serta dokumen dengan format aktual resmi sebelum melakukan pengiriman.

## 5. Berkas template yang disediakan (PDF dan DOCX)

1. Surat pernyataan pendaftaran anggota ISBN (profil perusahaan);
2. Surat permohonan ISBN per edisi;
3. SPKK per edisi;
4. Surat izin penerjemahan (harus ditandatangani pemegang hak);
5. Surat pengalihan penerbitan (pihak pengalih dan penerima);
6. Surat pernyataan/keterangan domain publik (dengan bukti status hukum).

Jangan memasukkan tanda tangan, stempel, meterai, nomor ISBN, KDT atau legalitas palsu ke template. Beberapa template membutuhkan penyesuaian terhadap **lampiran resmi** Perpusnas, khususnya keanggotaan, permohonan dan SPKK.

## 6. Gate produksi

Migrasi `20261108180000_publisher_isbn_office` dan `20261108181000_publisher_document_vault` perlu diuji di staging dari snapshot yang sesuai dan diterapkan secara berurutan melalui CI. Lingkungan QA lokal memiliki drift riwayat migrasi sebelumnya; **jangan pernah menjalankan reset database produksi**. Siapkan bukti backup, restore, RLS/RBAC, upload legal, antivirus PDF, TTL, encryption at rest, backup retention, audit, dan rollback. Tidak ada integrasi API pengajuan resmi Perpusnas pada tahap ini.

## 7. Referensi

- https://peraturan.go.id/files/perpusnas-no-11-tahun-2025.pdf
- https://isbn.perpusnas.go.id/landing_page/home
- https://isbn.perpusnas.go.id/landing_page/prosedur
- https://www.isbn-international.org/node/88
