# Kontrak API proyek buku — rancangan, belum diimplementasikan

Status: **USULAN / BLOCKED**, bukan dokumentasi endpoint yang aktif.

## API yang sudah diverifikasi
- `GET /health` — pemeriksaan layanan.
- `POST /api/v1/drafts` — membuat draf AI berstatus `perlu_tinjauan`, memakai kunci API editor server. **Bukan API proyek.**

## Prasyarat
Sesi pengguna terverifikasi di backend dengan subject ID stabil. Cloudflare Access untuk staging tidak cukup sebagai otorisasi per proyek. Jangan kirim `STUDIO_API_KEY` ke browser. Pastikan pemeriksaan CSRF jika menggunakan cookie sesi.

## Usulan kontrak setelah otorisasi siap
- `POST /api/v1/book-projects` — membuat proyek. Header `Idempotency-Key` UUID per maksud pembuatan. Server menurunkan owner_id dari sesi, tidak menerima owner_id dari klien.
- `GET /api/v1/book-projects?cursor=&limit=&q=&type=&audience=&status=&sort=` — daftar milik pengguna dengan pagination.
- `GET /api/v1/book-projects/{id}` — detail hanya untuk pemilik atau kolaborator berizin.
- `PATCH /api/v1/book-projects/{id}` — metadata, dengan versi/ETag untuk mencegah konflik.
- `GET /api/v1/book-projects/{id}/chapters` — daftar bab.
- `PUT /api/v1/book-projects/{id}/chapters/{chapterId}` — simpan naskah dengan `If-Match` atau versi wajib.

Semua rute di atas **belum ada** pada API yang diaudit; jangan dipanggil UI sebelum implementasi, tes keamanan, dan migrasi selesai.

## Contoh payload pembuatan (rancangan)
```json
{
  "title": "Belajar Fisika dari Sekitar Kita",
  "idea": "Penjelasan konsep melalui kejadian sehari-hari.",
  "purpose": "Membantu siswa memahami konsep dasar secara kontekstual.",
  "type": "Buku pelajaran",
  "audience": "SMP",
  "grade": 7,
  "structure": {"chapters": 8, "length": "Sedang", "style": "Komunikatif", "depth": "Menengah", "approach": "Kontekstual", "curriculum": ""},
  "production_preferences": []
}
```

## Validasi dan respons
- Judul 3–180 karakter, gagasan dan tujuan 10–2000 karakter, jenis dan sasaran harus dari enumerasi resmi.
- Kelas hanya sah untuk SD 1–6, SMP 7–9, SMA 10–12. Untuk TK/mahasiswa/guru/umum, `grade=null`.
- Batas ukuran body, panjang string, dan daftar preferensi ditegakkan server.
- Keberhasilan: `201 Created` dan `{id,owner_id,title,status,created_at,updated_at,version}`. Ulangan idempoten dengan payload sama mengembalikan proyek sama; kunci sama dengan payload berbeda menghasilkan `409`.
- Galat terstruktur: `{error:{code,message,request_id}}` dengan 400/401/403/404/409/422/429/503; jangan bocorkan SQL, token, atau stack trace.
- Transaksi menyimpan proyek dan catatan idempotensi atomik; unique constraint per owner+key, indeks owner+updated_at, foreign key chapter ke project.
- Tindakan penting dicatat tanpa menyimpan token atau naskah penuh di log.

## Fondasi naskah dan autosave
Setiap bab punya ID, project_id, konten terstruktur/teks, `version`, `updated_at`, dan pembaruan atomik bersyarat versi. Debounce simpan setelah perubahan, tampilkan “Menyimpan” saat request berjalan dan “Tersimpan” **hanya** sesudah respons sukses. Bila offline, tampilkan “Belum tersimpan” dan pertahankan teks di memori sesi; cegah keluar tanpa konfirmasi. Konflik 409 antarperangkat menampilkan pilihan muat versi terbaru / salin perubahan, tanpa menimpa diam-diam. Strategi pemulihan yang lebih tahan reload membutuhkan desain penyimpanan terenkripsi yang ditinjau keamanan.

## Migrasi dan rollback
Gunakan PostgreSQL staging terisolasi. Migrasi `up` dan `down` harus diuji dengan data contoh, rollback snapshot, pemeriksaan constraint dan pengujian akses lintas pengguna. Tidak ada perubahan database pada tahap dokumen ini.
