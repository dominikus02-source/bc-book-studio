# Integrasi BC Book Studio dengan BahasaCerdas

## Tujuan
Mengubah buku yang telah disetujui menjadi sumber konten belajar yang dapat dipakai ulang di fitur BahasaCerdas. Integrasi dilakukan melalui API resmi dan alur staging, bukan akses langsung ke basis data produksi.

## Prinsip arsitektur
1. BC Book Studio menjadi sumber naskah, versi, metadata, ilustrasi, dan persetujuan penerbitan.
2. BahasaCerdas menjadi tempat distribusi dan pengalaman belajar.
3. Setiap konten yang dikirim memiliki ID sumber, versi, checksum, status persetujuan, dan idempotency key.
4. Sinkronisasi mendukung preview, publish, update, unpublish, dan rollback sesuai izin.
5. Konten tidak otomatis dipublikasikan ke murid tanpa pemeriksaan dan persetujuan yang sesuai.
6. Hak cipta, lisensi gambar, atribusi, jenjang, dan batas usia ikut terbawa.

## Peta integrasi fitur

| Sumber buku | Produk BC | Transformasi konten |
|---|---|---|
| Materi dan bab | Belajar / Materi Ajar | Modul, ringkasan, bacaan, tujuan belajar |
| Konsep dan contoh | Gim / Arena | Kartu konsep, kuis, tantangan, teka-teki bahasa |
| Latihan dan asesmen | Bank Soal / Simulasi UKBI-TKA | Butir soal, stimulus, kunci, pembahasan, rubrik |
| Urutan kompetensi | Jalur Cerdas | Unit, prasyarat, microlearning, evaluasi, progres |
| Cerita, puisi, cerpen | Karya / Aku Sastrawan | Prompt menulis, contoh berlisensi, panduan genre, rubrik |
| Panduan guru | Dasbor Guru / AI BC | Rencana aktivitas, panduan fasilitasi, bahan ajar |
| Buku utuh | Perpustakaan Digital | Metadata, sampul, pratinjau, akses, versi, unduhan |
| Bab dan aktivitas | JUMPA | Paket bahan pertemuan, aktivitas, dan bahan diskusi |
| Materi lintas jenjang | Mentor AI | Referensi terkurasi dan tautan sumber yang relevan |

## Transformasi konten
Buku tidak dikirim mentah ke semua fitur. Setiap tujuan memiliki adapter dan skema sendiri:
- learning_module: tujuan, prasyarat, materi, contoh, aktivitas, evaluasi;
- game_pack: konsep, mekanik, level, pertanyaan, jawaban, umpan balik;
- jalur_unit: kompetensi, urutan, micro lesson, latihan, mastery rule;
- karya_prompt: genre, pemantik, batasan, contoh yang diizinkan, rubrik;
- assessment_pack: blueprint, stimulus, butir, kunci, pembahasan, rubrik;
- library_book: metadata, file, sampul, lisensi, akses, edisi.

## Alur sinkronisasi
1. Editor menyetujui naskah dan aset.
2. Sistem menandai bagian yang dapat diubah menjadi produk belajar.
3. Adapter menghasilkan paket sesuai skema tujuan.
4. Validasi struktur, jenjang, jawaban, sumber, hak cipta, dan duplikasi.
5. Preview pada lingkungan staging BahasaCerdas.
6. Penanggung jawab produk menyetujui.
7. Publish via API dengan idempotency key.
8. Catat hasil, versi, dan tautan balik ke proyek buku.
9. Update/rollback menggunakan versi baru; jangan menimpa tanpa jejak.

## Batas keamanan
- Tidak ada akses langsung ke database produksi BahasaCerdas.
- Gunakan kredensial server-to-server yang terpisah dan dapat dicabut.
- Terapkan RBAC, rate limit, validasi payload, audit log, dan secret rotation.
- Konten yang belum disetujui tidak boleh tampil kepada murid.
- Simpan mapping ID antara buku, bab, paket konten, dan entitas BC.

## Tahap pelaksanaan
1. API contract dan autentikasi staging.
2. Digital Library sebagai jalur distribusi buku paling langsung.
3. Materi Belajar dan Dasbor Guru.
4. Paket soal untuk bank soal dan simulasi.
5. Karya dan Aku Sastrawan.
6. Jalur Cerdas.
7. Gim/Arena dan Mentor AI.
8. JUMPA serta integrasi tambahan setelah adapter utama stabil.

Urutan akhir harus dikonfirmasi melalui audit API dan skema aktual BahasaCerdas sebelum implementasi.
