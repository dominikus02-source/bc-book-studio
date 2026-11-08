# BC Book Studio — Standar Editorial dan Kelayakan Terbit (Audit 8 November 2026)

## Status
**PARTIAL / NO-GO PRODUKSI**. Dokumen standar dan backlog operasional; **bukan** tanda sertifikasi atau bukti semua pengujian lulus. Worktree: F:/bc-book-import-export-20261106, branch integration/unified-book-workflow-20261107.

## Landasan hukum dan teknis
- Peraturan Perpusnas RI No. 11 Tahun 2025 (layanan ISBN): https://peraturan.go.id/files/perpusnas-no-11-tahun-2025.pdf
- Portal resmi dan daftar berkas ISBN: https://isbn.perpusnas.go.id/landing_page/home
- Kelayakan jenis terbitan dan anatomi: https://isbn.perpusnas.go.id/landing_page/isbn_info
- W3C EPUB Accessibility 1.1: https://www.w3.org/TR/epub-a11y/
- COPE Retraction Guidelines (2025): https://doi.org/10.24318/cope.2019.1.4
- Standar mutu perbukuan Indonesia: Permendikbudristek No. 22 Tahun 2022 (periksa genre dan relevansi).
Ketentuan wajib dibedakan dari praktik terbaik editorial. ISBN hanya ditetapkan instansi berwenang; ISBN checksum valid bukan bukti penetapan. Pengajuan ISBN Perpusnas tidak dipungut biaya. Buku yang tidak memenuhi kriteria ISBN harus diarahkan ke jalur tanpa ISBN yang sah, bukan dibuatkan nomor rekaan.

## Tahap 4: Review Naskah — spesifikasi CRUD dan state
1. **Create**: penulis submit hanya draft lengkap (brief, tujuan bab, isi, checkpoint), reviewer independen aktif dan ditugaskan; reviewer membuat temuan per bab/aspek: CONTENT, FACT, CITATION, LANGUAGE, ACCESSIBILITY, COPYRIGHT, PEDAGOGY, severity SUGGESTION/MAJOR/CRITICAL.
2. **Read**: ringkasan status dan cacah temuan terbuka, audit actor/waktu, perbandingan versi/snapshot; penulis hanya melihat dokumen miliknya, reviewer hanya buku yang ditugaskan, admin bukan pemilik tidak otomatis melewati RBAC.
3. **Update**: temuan diperbaiki atau ditandai RESOLVED dengan jejak dan kontrol versi; keputusan reject -> DRAFT -> resubmit; perubahan setelah approval harus memerlukan snapshot approval baru.
4. **Delete**: untuk temuan/audit yang pernah digunakan dalam keputusan, gunakan soft-delete/tombstone; jangan menghapus jejak peninjauan historis. Pencabutan penugasan tidak boleh menghapus laporan review.
5. **GATE APPROVE**: reviewer aktif, independen, ditugaskan, status REVIEW, catatan keputusan nonkosong, naskah lengkap dan semua temuan CRITICAL serta MAJOR berstatus selesai. Pembuktian approval harus berbasis snapshot immutable.
6. **Regresi wajib**: owner self-approval 403, reviewer nonaktif 403, reviewer tak ditugaskan 403, open MAJOR/CRITICAL -> 409, persaingan submit/note/approve, snapshot mismatch, perubahan sesudah approval, rekonsiliasi UI dua tema dan keyboard.
7. **Tidak disamakan**: editorial approval bukan bukti izin hak cipta, ISBN, maupun validasi file jadi.

## Tahap 5: Penerbitan — spesifikasi CRUD dan state
1. **Create**: paket front matter/main matter/back matter; surat ISBN dan dokumen pendukung; tata letak versi tersimpan; job ekspor per format; bukti penerbitan per snapshot dan layout; permohonan pemeriksaan bukti ke admin independen.
2. **Read**: penulis dan reviewer terkait melihat kelengkapan, daftar bukti dengan status SUBMITTED/VERIFIED/REJECTED/NOT_APPLICABLE, hasil validator format, artefak checksum, alasan NO-GO; tidak membuat klaim bahwa NOT_RUN sama dengan PASS.
3. **Update**: revisi tata letak menaikkan versi dan membuat bukti sebelumnya stale; koreksi data ISBN hanya dengan referensi resmi; perubahan naskah setelah approval menuntut review baru. Perbaikan temuan legal/aksesibilitas dapat diajukan ulang.
4. **Delete**: membatalkan job, mencabut publikasi, mengarsip bukti salah tanpa menghilangkan audit dan artefak yang sudah dilepas; hindari delete fisik tanpa retensi.
5. **GATE PUBLISH**: snapshot approval sah, rights/licensing, identitas penerbit, pengecekan ISBN atau alasan pengecualian yang diverifikasi, katalog resmi, bibliografi faktual, aksesibilitas, layout, hash artefak dan log validator untuk semua format yang diterbitkan, sign-off independen, dan rencana distribusi.
6. **Perpusnas**: surat permohonan bertanda tangan/stempel; halaman judul, verso, kata pengantar, TOC; naskah akhir ber-watermark; SPKK, izin penerjemahan/pengalihan bila relevan; tautan katalog resmi judul. Bukti resmi nomor diberikan Perpusnas, bukan dihasilkan AI.
7. **Format**: DOCX round-trip Word/LibreOffice + metadata/heading/tabel/gambar; PDF inspeksi cetak/Unicode/font/preflight dan uji akses bila relevan; EPUBCheck dan pemeriksaan aksesibilitas W3C/DAISY; HTML validator/axe/keyboard; Flipbook uji keyboard/touch/screen-reader dan fallback linear.
8. **Nomor halaman buku**: front cover dan back cover tanpa nomor tampil; front matter romawi kecil; main matter arab dimulai 1; halaman pembuka bab dapat menyembunyikan folio tetapi tetap dihitung; header/footer recto-verso dan halaman ganjil-genap; daftar pustaka/profil penulis umumnya melanjutkan angka Arab bila berada sesudah isi utama. Konfigurasi genre dan gaya penerbit boleh berbeda.
9. **Regresi wajib**: 5 format x ukuran buku x template x genre x role; antrian dan pembatalan, worker vs lokal, hash/job retries, fail-closed saat validator gagal, ISBN/N-A path, ekspor publik tidak membocorkan draf, restore/backup, akses perangkat sesungguhnya.
10. **Setelah terbit**: rekam URL publik, distribusi, bukti serah-simpan sesuai ketentuan berlaku, koreksi/penarikan beserta riwayat edisi.

## Temuan implementasi terbukti dari inspeksi kode
- Review API sudah memakai row lock dan transaksi, assignment reviewer independen, snapshot approval, catatan review, serta verifikasi bab.
- Ditemukan celah: approval hanya menolak CRITICAL OPEN; MAJOR OPEN semula bisa lolos. Diperbaiki menjadi blokir kedua severity.
- Ditemukan celah: reviewer yang dinonaktifkan setelah assignment bisa tetap mengambil keputusan bila sesi masih ada. Diperbaiki dengan query status akun aktif saat keputusan.
- API penerbitan sudah menolak publish tanpa approval, layout tersimpan dan semua bukti preflight yang diperlukan; evidence review oleh admin independen ditautkan ke snapshot/layout.
- Dua buku DRAFT telah mempunyai 10 artefak QA preview, EPUBCheck kedua EPUB PASS; itu bukan bukti release end-to-end dan sertifikasi.
- Bukti legal, uji pembaca layar fisik, uji DOCX aplikasi nyata, validator PDF lengkap, kesiapan worker produksi, izin distribusi dan ISBN resmi masih **BELUM TERBUKTI**.

## Keputusan
Tidak naikkan status dua tahap menjadi PASS sebelum seluruh gate server, tes negatif, output nyata, dan bukti persetujuan manusia terpenuhi. Tidak push ke main atau deploy VPS dengan worktree lain yang masih berubah tanpa integrasi dan CI.
