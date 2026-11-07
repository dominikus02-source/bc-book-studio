# BC Book Studio — XLSX & Markdown Form Transfer and CRUD

## Tujuan
Menyediakan jalur kerja yang konsisten di semua modul berisian data, tanpa menyimpan file unggahan di VPS. Form menyimpan **nilai terstruktur**, bukan file XLSX/Markdown.

## UI dan modul
- **Buat Buku**: unduh/edit/impor 22 field brief lalu simpan sebagai buku baru melalui `POST /api/books`.
- **Proyek Buku**: transfer metadata lengkap, genre, kelas, dan deskripsi/prompt; CRUD hanya buku DRAFT milik penulis.
- **Studio Penulisan**: transfer judul/isi bab; create/update/delete/reorder bab dan riwayat revisi tetap memakai API buku ber-RBAC.
- **Penyuntingan**: transfer alamat reviewer sebagai isian lalu proses penugasan terotorisasi.
- **Idea Lab, Studio Latihan, Kurikulum, Studio Visual, Pusat Agen**: transfer form dan simpan draf privat ke database (`StudioFormDraft`) dengan Create/Read/Update/Delete; daftar soal latihan disertakan sebagai JSON teks untuk mempertahankan urutan/isi.
- **Pengaturan AI**: transfer **metadata nonrahasia saja** (provider, nama, model, aktif). API key selalu diinput langsung melalui field password; dilarang di XLSX/Markdown/draf.
- **Login, aktivasi, reset password**: tidak menyediakan ekspor/import kredensial untuk alasan keamanan. Halaman tanpa form tetap tidak menampilkan fitur ini.
- Modul yang hanya menampilkan placeholder dan tidak punya form tidak dipaksa menjadi CRUD palsu.

## Alur penggunaan
1. Masuk ke modul; klik **Unduh XLSX** atau **Unduh Markdown**. Template sudah menyertakan `field_id` stabil dan contoh/isi saat ini.
2. Edit kolom **Nilai** pada sheet `FORM` atau teks di bawah heading `## field_id — Label`. Jangan ubah `field_id`.
3. Klik **Baca XLSX / MD**; browser membaca file ke memori dengan batas terkompresi **1 MB** dan batas isi XLSX **3 MB**.
4. UI memvalidasi kolom dikenal, tipe, enum, panjang, duplikasi, dan menolak formula, macro, hyperlink yang tidak didukung.
5. Periksa pratinjau, klik **Terapkan ke form**. **Belum ada data server yang berubah pada tahap ini**.
6. Klik tombol **Simpan** pada form buku/bab/provider atau **Simpan draf** pada modul kerja.
7. Untuk draf privat, pilih draf tersimpan lalu Ubah, Duplikasi atau Hapus. Penghapusan berlaku pada record database terotorisasi.

## Kebijakan keamanan dan penyimpanan
- Tidak ada endpoint upload biner XLSX/MD. File dibaca di memori browser (Blob/File), nilai yang disetujui saja masuk API melalui JSON.
- Input file browser dibersihkan setelah pembacaan; halaman tidak dapat atau tidak boleh menghapus file asal dari perangkat pengguna.
- Sel Excel berformula dan hyperlink ditolak. ZIP/OOXML dibatasi jumlah komponen dan ukuran hasil dekompresi untuk mencegah penyalahgunaan.
- API `/api/form-drafts` menolak permintaan tanpa sesi; semua GET/PATCH/DELETE ditapis berdasarkan `ownerId`, termasuk admin. Payload tidak boleh mengandung key `password`, `token`, `apiKey`, `secret`, atau `credential`.
- Batas draf: 30 per modul dan pemilik; field dibatasi 40; payload maksimal 18 KB.
- Form buku/bab mempertahankan hak akses kepemilikan, status DRAFT, serta batas kuota semula.
- Kode ini memerlukan migrasi Prisma `20261106120000_studio_form_drafts`. **Jangan menjalankan migrasi di produksi sebelum backup dan restore rehearsal.**

## QA
- `npm run db:migrate` dengan `DATABASE_URL` database terisolasi.
- `npm run build`, `npm run typecheck`, `npm audit --audit-level=high`.
- `npx playwright test` dengan database CI yang diklon dan login sintetis; termasuk roundtrip XLSX/Markdown, CRUD, RBAC dua akun, dan penolakan field rahasia.
- Tidak men-deploy branch fitur saat PR masih Draft / CI belum semua PASS.
