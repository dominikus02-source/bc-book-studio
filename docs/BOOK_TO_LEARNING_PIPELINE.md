# Pipeline Buku Menjadi Pengalaman Belajar

## Tujuan
Satu naskah buku dapat menghasilkan beberapa bentuk pengalaman belajar tanpa menyalin-tempel konten dan tanpa kehilangan hubungan ke sumber.

## Pipeline
Naskah disetujui → pemetaan konsep/kompetensi → ekstraksi unit konten → transformasi per tujuan → validasi ahli/otomatis → pratinjau staging → persetujuan → distribusi BC.

## Unit konten kanonis
- concept: konsep, definisi, penjelasan, contoh, sumber;
- reading: bacaan, tingkat kesulitan, kosakata, pertanyaan;
- activity: instruksi, bahan, langkah, hasil yang diharapkan;
- question: stimulus, pertanyaan, pilihan, kunci, pembahasan, indikator, kesulitan;
- writing_prompt: genre, tujuan, pemantik, panduan, rubrik;
- visual_asset: gambar, caption, alt text, lisensi, anchor naskah;
- learning_objective: kompetensi, prasyarat, indikator, jenjang;
- assessment: blueprint, aturan mastery, umpan balik.

## Aturan transformasi
- Setiap unit memiliki source_book_id, source_revision, chapter_id, paragraph_anchor, content_hash, grade_profile_version.
- AI boleh mengusulkan transformasi; validator memeriksa kesesuaian dan duplikasi.
- Pertanyaan wajib memiliki kunci dan pembahasan jika tipe soal membutuhkannya.
- Game pack harus memiliki tujuan belajar dan aturan permainan, bukan sekadar kumpulan soal.
- Jalur Cerdas harus mengurutkan prasyarat dan tingkat kesulitan secara bertahap.
- Prompt karya harus mengarahkan kreativitas murid, bukan meminta menyalin contoh.
- Mentor AI hanya boleh mengambil materi yang statusnya disetujui dan sesuai jenjang.

## Evaluasi dampak
Catat penggunaan, penyelesaian, hasil asesmen, dan umpan balik secara agregat sesuai izin. Data murid tidak dikirim ke Book Studio kecuali ada dasar, izin, dan kontrak data yang jelas.
