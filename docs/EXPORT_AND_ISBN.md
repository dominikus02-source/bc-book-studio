# Ekspor dan kelengkapan ISBN

## Ekspor di dalam aplikasi
Jika `QUARTO_BIN` atau `QUARTO_WORKER_URL` tidak diisi, PDF, DOCX, dan EPUB dibuat oleh perender aplikasi (`lib/studio-render.ts`).

- Font Unicode: `assets/fonts/NotoSans-Regular.ttf` dan `NotoSans-Bold.ttf` (perlu ikut ke image).
- Gambar PNG/JPEG dari aset buku disisipkan.
- Video YouTube di PDF, DOCX, dan EPUB menjadi kode QR, URL pendek, dan judul. HTML serta Flipbook tetap memakai iframe.
- `GET /api/books/:id/export?format=zip` membuat paket lima format tanpa antrean worker.
- Antrean `/export-jobs` tetap ada, tetapi hanya berguna bila proses worker ekspor benar-benar berjalan.

Image Docker menyalin `assets/fonts` dan `node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`. Server tidak memasang `@napi-rs/canvas`: biner itu memakai SSE4.2/AVX dan membuat Node berhenti dengan SIGILL di CPU produksi. pdf.js tetap mengekstrak teks tanpa canvas. Kode QR dibuat oleh paket `qrcode` lewat `pngjs`, bukan Skia. Gaya gambar saat ekspor (radius dan padding) juga memakai `pngjs` dan `jpeg-js`, bukan libvips. `compose.yml` tidak mengisi `QUARTO_*`, jadi layanan web memakai perender aplikasi. `compose.staging.yml` masih dapat menunjuk Quarto Worker; jika worker gagal, ekspor final tetap jatuh ke perender aplikasi dan tidak mengembalikan 503. Perkiraan tambahan image: font sekitar 1,1 MB ditambah berkas worker pdf.js.

## Kelengkapan ISBN
Modul Dasbor **Kelengkapan Penerbitan** menyimpan data penerbit di `PublisherDossier` dan data buku di `IsbnPacket`.

- Data penerbit diubah hanya oleh ADMIN atau SUPERADMIN. Nama badan hukum tetap PT Bahasa Cerdas Indonesia. Imprint bawaan adalah Teras Kata.
- Data buku diubah oleh pemilik atau kolaborator. Peninjau hanya membaca.
- Bahan pendamping (LKS, panduan, kunci) tidak memakai ISBN.
- Tombol **Unduh paket ISBN (ZIP)** membuat 12 berkas DOCX. Kolom kosong tertulis `[BELUM DIISI]`.
