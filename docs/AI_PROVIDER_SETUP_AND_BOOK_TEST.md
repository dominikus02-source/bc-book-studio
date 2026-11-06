# Panduan API AI dan Uji Draf Buku

Panduan ini untuk cabang uji BC Book Studio. Kunci provider disimpan terenkripsi di server. Jangan menaruh kunci di chat, prompt, tangkapan layar, Git, atau catatan pengujian.

## Menyiapkan provider (pengelola)

1. Masuk dengan akun pengelola, buka **Pengaturan → Model AI untuk penulisan**.
2. Pada **Tambah API key/model**, pilih penyedia, beri label yang mudah dikenali, lalu salin ID model dari dashboard resmi penyedia.
3. Masukkan API key, batas token keluaran (16–3.000), dan temperatur (0–2). Gunakan temperatur rendah untuk nonfiksi dan dapat dinaikkan untuk eksplorasi fiksi.
4. Biarkan **Tersedia bagi editor untuk dipilih** aktif bila model boleh digunakan editor, lalu tekan **Simpan API key**.
5. Tekan **Tes koneksi**. Berhasil berarti endpoint, key, dan model merespons. Tes memakai kuota provider dan tercatat pada meter pemilik akun yang menjalankannya.
6. Ulangi untuk setiap key/model. Key berbeda dari provider yang sama diperbolehkan. Gunakan **Ubah**, **Nonaktifkan**, atau **Hapus** untuk CRUD. Key lama hanya ditampilkan sebagai empat karakter terakhir.

Jika penyimpanan rahasia menyatakan belum siap, pengelola server harus mengisi `STUDIO_SECRET_ENCRYPTION_KEY` pada secret store dan memulai ulang layanan. Jangan membuat key dari browser atau memasukkannya ke file konfigurasi yang dilacak Git.

## Memilih model (editor)

1. Di bagian **Model AI untuk penulisan**, pilih satu konfigurasi aktif melalui radio.
2. Pilihan disimpan pada browser/perangkat tersebut. Key rahasia tidak dikirim ke browser; server mengambil key berdasarkan ID konfigurasi.
3. Periksa meter **Token Studio hari ini** sebelum membuat draf. Nilai “tersisa” adalah batas pemakaian Studio per pengguna, bukan saldo kredit provider.
4. Nilai penggunaan berasal dari token provider bila disediakan. Bila provider tidak mengembalikan rincian token, sistem menampilkan estimasi berbasis panjang teks dan menambah penghitung **Perkiraan**.
5. Jika perlu menguji model, lengkapi **Template uji penulisan** lalu tekan **Uji model pilihan**. Draf contoh dihitung ke kuota dan ditampilkan untuk ditinjau.

Batas harian Studio diatur lewat `STUDIO_DAILY_TOKEN_LIMIT` (default 50.000 token per pengguna per hari UTC). Pembatasan permintaan tambahan tetap berlaku. Saldo tagihan provider harus dicek pada dashboard provider.

## Template uji fiksi

- Jenis buku: **Fiksi**
- Judul: **Petualangan di Hutan Hujan**
- Genre/bidang: **Petualangan**
- Pembaca sasaran: **Pembaca remaja**
- Topik bab: **Pertemuan tokoh utama dengan konflik pertama**
- Tujuan: **Mengenalkan tokoh utama, membangun latar yang terasa hidup, memperkenalkan konflik, dan mengakhiri bab dengan alasan kuat untuk membaca bab berikutnya.**

Periksa konsistensi karakter, adegan dan dialog, perkembangan konflik, kecocokan usia, orisinalitas, serta tidak meniru gaya penulis hidup.

## Template uji nonfiksi

- Jenis buku: **Nonfiksi**
- Judul: **Energi dan Perubahannya**
- Genre/bidang: **IPA SMP**
- Pembaca sasaran: **Siswa kelas VIII**
- Topik bab: **Perubahan energi dalam kehidupan sehari-hari**
- Tujuan: **Menjelaskan bentuk dan perubahan energi dengan bahasa sesuai kelas VIII, memberi contoh yang benar, membedakan fakta dari penjelasan, dan menandai klaim yang perlu sumber.**

Periksa kebenaran konsep, kesesuaian pembaca, contoh, istilah, kebutuhan sumber, dan keselarasan tujuan.

## Lembar hasil uji

| Pemeriksaan | Hasil |
| --- | --- |
| Login tanpa sesi mendapat 401 | PASS / FAIL |
| Editor dapat melihat model aktif tetapi tidak mengelola key | PASS / FAIL |
| Editor dapat memilih model dengan radio | PASS / FAIL |
| Editor tidak dapat mengaktifkan, mengubah, atau menghapus key | PASS / FAIL |
| Pengelola dapat menambah beberapa key/provider | PASS / FAIL |
| Perubahan model, temperatur, dan batas output tersimpan | PASS / FAIL |
| API hanya mengembalikan label dan empat digit akhir, bukan key | PASS / FAIL |
| Tes koneksi gagal memberi pesan yang aman tanpa isi respons provider | PASS / FAIL |
| Draf fiksi tampil dengan model yang dipilih | PASS / FAIL |
| Draf nonfiksi tampil dengan model yang dipilih | PASS / FAIL |
| Meter menambah token aktual atau estimasi setelah permintaan | PASS / FAIL |
| Pengguna A tidak melihat pemakaian pengguna B | PASS / FAIL |
| Layar 320, 375, 768, 1024, dan 1440 px dapat digunakan | PASS / FAIL |

Catat nama provider/model, tanggal, akun uji sintetis, status tiap baris, dan nomor tiket jika ada. Jangan catat API key, isi token, email pribadi, atau isi sensitif buku.

## Catatan rilis

Jalankan migrasi baru pada salinan database staging, lalu verifikasi daftar key lama, pemilihan radio, batas akses peran, dan pemakaian token sebelum jadwal rilis. Perubahan cabang ini tidak mengaktifkan key sungguhan atau mengubah database produksi.
