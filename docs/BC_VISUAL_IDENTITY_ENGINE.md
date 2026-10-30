# BC Visual Identity Engine

## Tujuan
Menghasilkan ilustrasi, diagram, infografik, sampul, dan aset visual yang relevan dengan naskah serta konsisten sebagai identitas visual buku BahasaCerdas.

## Prinsip
1. Visual harus memiliki fungsi pedagogis atau editorial yang jelas.
2. Gambar dibuat dari konteks naskah yang telah disetujui, bukan prompt lepas.
3. Identitas visual ditetapkan per proyek buku dan diwariskan ke seluruh bab.
4. Karakter berulang memakai lembar acuan karakter dan versi aset yang disetujui.
5. Teks penting, label, angka, dan diagram presisi ditata sebagai elemen dokumen, bukan mengandalkan teks yang dirender di dalam gambar AI.
6. Setiap aset menyimpan prompt, model, tanggal, versi style guide, sumber, lisensi, dan status persetujuan.
7. Gambar tidak boleh meniru secara langsung gaya khas seniman hidup atau karakter/merek berhak cipta tanpa izin.

## Alur produksi visual
1. Ekstrak konteks paragraf, tujuan belajar, pembaca, dan posisi gambar.
2. Klasifikasikan fungsi: konsep, proses, contoh, cerita, karakter, diagram, infografik, sampul, atau dekorasi.
3. Buat illustration brief berisi pesan utama, komposisi, objek, latar, sudut pandang, batasan, dan teks alternatif.
4. Terapkan visual profile berdasarkan kategori buku dan jenjang.
5. Hasilkan alternatif gambar melalui penyedia gambar yang dikonfigurasi di backend.
6. Jalankan pemeriksaan relevansi terhadap naskah, usia, anatomi/objek, keterbacaan, bias, hak cipta, dan konsistensi.
7. Editor memilih atau meminta revisi.
8. Simpan aset final, metadata, versi, dan penempatan dalam dokumen.
9. Periksa hasil ekspor untuk crop, resolusi, kontras, caption, dan alur halaman.

## Visual profiles
- Anak awal/SD: bentuk jelas, ekspresi ramah, warna terkontrol, komposisi sederhana, konteks dekat dengan kehidupan anak.
- SMP/SMA: editorial modern, visual konsep, diagram, infografik, dan contoh kontekstual.
- Guru: profesional, instruksional, diagram alur, tabel, dan visual panduan.
- Referensi: diagram presisi, visual data, anotasi, dan konsistensi terminologi.
- Sastra: visual atmosferik yang mendukung interpretasi tanpa menggantikan teks.

## BC style guide
Setiap versi guide mendefinisikan:
- palet warna dan aturan kontras;
- bentuk garis, tekstur, pencahayaan, dan komposisi;
- proporsi, ekspresi, pakaian, dan atribut karakter;
- aturan latar dan representasi konteks Indonesia;
- gaya ikon, diagram, tabel visual, dan infografik;
- aturan konsistensi antar bab dan antar edisi;
- larangan visual, bias, stereotip, dan penggunaan aset.

## Character bible
Karakter berulang memiliki ID, nama, peran, rentang usia fiktif, lembar tampak depan/samping, palet, pakaian, ekspresi, pose, atribut, dan batas perubahan. Referensi karakter yang disetujui dipakai kembali pada generasi berikutnya.

## Data aset minimum
asset_id, project_id, chapter_id, manuscript_anchor, asset_type, visual_profile_version, prompt_version, provider, model, source_reference, license_status, storage_key, dimensions, alt_text, caption, review_status, reviewer_id, created_at, revision.

## Quality gates
- Relevansi terhadap paragraf dan tujuan belajar.
- Kesesuaian usia dan konteks budaya.
- Konsistensi style guide dan karakter.
- Tidak mengandung teks rusak pada elemen yang harus presisi.
- Hak penggunaan dan sumber aset jelas.
- Resolusi sesuai ukuran cetak/digital.
- Persetujuan editor sebelum masuk edisi final.

## Catatan implementasi
Jangan mengunci produk ke satu penyedia gambar. Gunakan gateway provider di backend, simpan metadata generasi, dan dukung penggantian model tanpa mengubah alur editorial. Jangan menaruh kunci penyedia gambar di browser.
