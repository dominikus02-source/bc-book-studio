# Ekspor dan kelengkapan ISBN

## Ekspor di dalam aplikasi
Jika `QUARTO_BIN` atau `QUARTO_WORKER_URL` tidak diisi, PDF, DOCX, dan EPUB dibuat oleh perender aplikasi (`lib/studio-render.ts`).

- Font Unicode: `assets/fonts/NotoSans-Regular.ttf` dan `NotoSans-Bold.ttf` (perlu ikut ke image).
- Gambar PNG/JPEG dari aset buku disisipkan.
- Video YouTube di PDF, DOCX, dan EPUB menjadi kode QR, URL pendek, dan judul. HTML serta Flipbook tetap memakai iframe.
- `GET /api/books/:id/export?format=zip` membuat paket lima format tanpa antrean worker.
- Antrean `/export-jobs` tetap ada, tetapi hanya berguna bila proses worker ekspor benar-benar berjalan.

Image Docker menyalin `assets/fonts`, `node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`, dan `@napi-rs/canvas` (agar impor PDF tidak memperingatkan canvas yang hilang). `compose.yml` tidak mengisi `QUARTO_*`, jadi layanan web memakai perender aplikasi. `compose.staging.yml` masih dapat menunjuk Quarto Worker; jika worker gagal, ekspor final tetap jatuh ke perender aplikasi dan tidak mengembalikan 503. Perkiraan tambahan image: font sekitar 1,1 MB, berkas worker pdf.js, dan biner canvas platform.

## Kelengkapan ISBN
Modul Dasbor **Kelengkapan Penerbitan** menyimpan data penerbit di `PublisherDossier` dan data buku di `IsbnPacket`.

- Data penerbit diubah hanya oleh ADMIN atau SUPERADMIN. Nama badan hukum tetap PT Bahasa Cerdas Indonesia. Imprint bawaan adalah Teras Kata.
- Data buku diubah oleh pemilik atau kolaborator. Peninjau hanya membaca.
- Bahan pendamping (LKS, panduan, kunci) tidak memakai ISBN.
- Tombol **Unduh paket ISBN (ZIP)** membuat 12 berkas DOCX. Kolom kosong tertulis `[BELUM DIISI]`.
