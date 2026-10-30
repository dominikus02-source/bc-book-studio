# Spesifikasi Mesin Produksi Buku Otomatis

## Keputusan produk utama
BC Book Studio berpusat pada satu formulir perintah pembuatan buku. Pengguna menjelaskan tujuan dan kebutuhan buku sekali; sistem menyusun prompt induk yang terstruktur, memilih alur dan agen, menjalankan tahapan produksi, melakukan pemeriksaan mutu, lalu menghasilkan dokumen dengan templat layout yang dipilih.

Pengguna tidak perlu memanggil agen satu per satu. Agen adalah kemampuan internal yang diorkestrasi sistem.

## 1. Formulir perintah utama

### A. Tujuan dan identitas
- Tujuan buku: mengajar, panduan guru, pengayaan, referensi, sastra, literasi, persiapan ujian, komunikasi, atau tujuan khusus.
- Judul sementara dan ringkasan tujuan.
- Masalah/kebutuhan yang hendak diselesaikan.
- Hasil belajar atau perubahan yang diharapkan.
- Jenis buku dan bahasa.

### B. Pembaca sasaran
- Kelompok pembaca: TK, SD, SMP, SMA, mahasiswa, guru, profesional, atau umum.
- Kelas/usia dan tingkat kemampuan awal.
- Pengetahuan prasyarat.
- Kebutuhan aksesibilitas dan konteks penggunaan.

### C. Cakupan isi
- Topik utama, subtopik, batas cakupan, dan hal yang tidak boleh dibahas.
- Perkiraan jumlah bab/halaman atau pilihan rekomendasi otomatis.
- Kedalaman pembahasan dan tingkat kesulitan.
- Referensi, dokumen sumber, kurikulum/versi yang harus diikuti.
- Apakah memerlukan latihan, kunci, pembahasan, rubrik, proyek, glosarium, daftar pustaka.

### D. Gaya dan pendekatan
- Gaya bahasa: komunikatif, akademik, populer, naratif, instruksional, atau kombinasi.
- Nada, contoh, konteks lokal, dan pendekatan pedagogis.
- Kebutuhan ilustrasi, diagram, tabel, infografik, dan aktivitas.
- Ketentuan istilah, EYD, sitasi, serta kebijakan hak cipta.

### E. Bentuk dokumen
- Templat layout: Buku Pelajaran SD, Buku Pelajaran SMP/SMA, Panduan Guru, Buku Pengayaan, Buku Referensi, Modul/Workbook, Buku Sastra/Literasi, atau Minimalis Modern.
- Ukuran halaman: A4, A5, B5, atau khusus.
- Orientasi, preferensi warna, kepadatan visual, tipografi, dan kebutuhan cetak/digital.
- Keluaran: DOCX editable, PDF digital/cetak, EPUB, dan HTML bila didukung.

### F. Kendali produksi
- Mode: otomatis dengan persetujuan di gerbang kritis, atau bertahap dengan persetujuan tiap tahap.
- Batas biaya, prioritas, target waktu, dan tingkat kedalaman riset.
- Pemilik/editor yang memberi persetujuan.
- Mulai produksi hanya setelah ringkasan perintah dikonfirmasi.

## 2. Prompt induk dinamis
Sistem menyusun prompt induk dari formulir, profil jenjang, kategori buku, sumber, templat, kebijakan mutu, dan batas biaya. Prompt tidak boleh sekadar menggabungkan teks mentah. Ia harus menghasilkan objek tervalidasi dengan:
- tujuan dan kriteria keberhasilan;
- audiens dan profil pembaca;
- ruang lingkup dan struktur keluaran;
- instruksi isi dan gaya;
- sumber yang wajib digunakan dan aturan kutipan;
- kebutuhan latihan/visual/asesmen;
- spesifikasi dokumen dan layout;
- pemeriksaan mutu dan gerbang persetujuan;
- batas biaya, waktu, privasi, serta hak penggunaan.

Simpan prompt hasil render sebagai snapshot berversi bersama versi formulir, profil jenjang, template, dan instruksi agen. Perubahan input setelah produksi dimulai membuat revisi rencana baru, bukan menimpa prompt lama.

## 3. Orkestrasi otomatis
1. Validasi kelengkapan formulir.
2. Susun ringkasan perintah dan estimasi biaya/waktu.
3. Tampilkan prompt induk untuk diperiksa; pengguna mengonfirmasi.
4. Chief Editor menyusun rencana dan memilih agen/spesialisasi.
5. Riset dan pemeriksaan sumber.
6. Pemetaan kurikulum bila relevan.
7. Kerangka buku dan persetujuan struktur.
8. Penulisan bab secara bertahap.
9. Pembuatan latihan/asesmen dan visual sesuai kebutuhan.
10. Penyuntingan bahasa dan telaah pedagogis.
11. QA fakta, referensi, duplikasi, hak cipta, konsistensi, dan kelengkapan.
12. Tata letak memakai template terpilih.
13. Pembuatan dokumen dan pemeriksaan hasil ekspor.
14. Persetujuan manusia final.
15. Penerbitan dan arsip versi.

Sistem dapat berjalan otomatis antar tahap yang telah diizinkan. Tahap berisiko tinggi, sumber yang tidak pasti, perubahan substansi, dan penerbitan memerlukan gerbang manusia.

## 4. Templat layout
Setiap template memiliki versi dan token desain:
- ukuran halaman dan margin;
- grid dan kolom;
- hierarki judul;
- keluarga font dan ukuran;
- header/footer dan nomor halaman;
- gaya tabel, kotak konsep, contoh, latihan, refleksi;
- aturan gambar, caption, teks alternatif;
- daftar isi, glosarium, indeks, daftar pustaka;
- sampul dan halaman hak cipta.

Template harus menghasilkan dokumen yang dapat diedit dan mempertahankan struktur semantik. Template tidak boleh mengubah substansi naskah.

## 5. Keluaran dokumen
Prioritas:
1. DOCX sebagai naskah editable.
2. PDF untuk distribusi/cetak.
3. EPUB untuk buku digital reflowable.
4. HTML untuk pratinjau/publikasi web.

Setiap ekspor memiliki versi, waktu, template, hash, status QA, dan hubungan ke versi naskah. Ekspor gagal tidak boleh mengubah naskah sumber.

## 6. Otomatisasi dan ketahanan
- Job persisten, checkpoint per bab/tahap, idempotency key, retry terbatas, dead-letter queue.
- Pause, resume, cancel, priority, dan approval gates.
- Kegagalan satu tahap tidak mengulang seluruh buku.
- Batas biaya/token/waktu per buku dan per tahap.
- Pencatatan agen, model, prompt version, sumber, token, biaya, dan hasil.
- Tidak ada loop tanpa batas.

## 7. Prinsip keselamatan dan mutu
- Sumber tidak boleh dikarang; klaim faktual yang memerlukan rujukan harus terlacak.
- Hak cipta dan lisensi aset harus dicatat.
- ISBN hanya dicantumkan jika sudah diperoleh secara resmi.
- Tidak boleh mengklaim persetujuan pemerintah.
- Skor AI bukan pengganti penilaian ahli.
- Penerbitan final wajib persetujuan manusia.
- Kunci API hanya berada di backend.

## 8. Status implementasi
Spesifikasi ini adalah target produk. Formulir frontend dapat dibuat terlebih dahulu, tetapi penyusunan prompt aktual, orkestrasi, penyimpanan, ekspor dokumen, dan pekerjaan agen baru dianggap aktif setelah backend diuji dan dioperasikan.
