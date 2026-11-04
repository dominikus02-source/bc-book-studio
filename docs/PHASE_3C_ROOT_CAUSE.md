# Akar kegagalan validasi EPUB — Tahap 3C.1

**Bukti aktual:** GitHub Actions run 41745638354, job 126297791435. DOCX, PDF, EPUB dirender. EPUBCheck 0 fatals/0 errors/0 warnings/0 infos. Validator lama mengeluarkan 11 kegagalan pencarian teks EPUB.

**Temuan kode:** validator lama mencari seluruh berkas berekstensi XHTML lalu menggabungkan hanya `node.text` pada setiap elemen. Metode ini menghilangkan teks `tail` setelah elemen inline, tidak mengikuti urutan `spine`, dan tidak membaca `META-INF/container.xml` untuk menemukan OPF yang sebenarnya. Ini cacat ekstraksi nyata, tetapi kecocokan terhadap EPUB run berikutnya masih harus diverifikasi.

**Perbaikan:** resolusi container→OPF→manifest→spine; parsing XHTML XML; `body.itertext()` agar teks bertingkat dan tail masuk; normalisasi Unicode NFC, HTML entity dan whitespace; penolakan path di luar arsip. Tes bab hilang tetap harus gagal.

**Status:** BELUM LULUS sampai workflow baru berjalan dan seluruh gerbang CI dikonfirmasi.
