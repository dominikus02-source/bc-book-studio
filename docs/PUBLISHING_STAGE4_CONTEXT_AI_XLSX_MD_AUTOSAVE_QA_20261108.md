# BC Book Studio — QA Tahap Penerbitan Kontekstual, XLSX/MD, AI, dan Autosave
**Tanggal:** 8 November 2026 (WIB)
**Alamat:** http://127.0.0.1:32979/studio?bookId=cmw6gk5gu005wurcoe0dk02jr&module=Penerbitan
**Repo/worktree:** F:/bc-book-import-export-20261106
**Branch:** integration/unified-book-workflow-20261107
**Database:** QA lokal saja, 127.0.0.1:55999/bookstudio_import_qa.
**Status:** QA interaksi Stage Penerbitan PASS; penerbitan resmi dan deployment produksi tetap HOLD.

## Implementasi

1. `lib/publishing-package.ts`: sekarang 11 field tetap, yakni frontCover, titlePage, copyrightPage, preface, contentsIntro, readerGuide, afterword, glossary, references, bibliography, backCover. Default berdasarkan judul, penulis, subjek, kelas, genre, brief, pembaca, tujuan, serta urutan bab dan tujuan bab Stage 2/3. Deskripsi yang tampak sebagai prompt/konstitusi internal tidak dipakai sebagai sinopsis final. Tidak ada ISBN, sumber bibliografi, izin atau sertifikasi fiktif.
2. `GET /api/books/:id/publishing-package` mengembalikan defaults, data tersimpan, perubahan Stage 1–3, versi database dan nama field lama yang belum ada; dokumen lama 9 field secara otomatis ditambah dua field baru, **tanpa menimpa sembilan isian penulis**.
3. `PUT /api/books/:id/publishing-package`: owner-only, DRAFT-only, validasi 11 field maks. 12.000 karakter masing-masing, expectedVersion/optimistic concurrency, konflik HTTP 409, no-store. Data disimpan sebagai JSON `StudioFormDraft`. Tidak perlu migrasi skema; file XLSX/Markdown asli tidak diunggah sebagai blob server.
4. `components/publishing-package-editor.tsx`: auto buat dari Stage 1–3 pada buku baru, auto backfill legacy, autosave perubahan setiap ~700 ms, indikator menyimpan/tersimpan/error, perlindungan sebelum menutup tab saat dirty, retry manual saat kegagalan, tombol lengkapi kosong/ganti seluruh isian (ganti seluruh isian meminta konfirmasi).
5. Komponen `FormTransfer` untuk `Paket penerbitan` menyediakan unduh XLSX, unduh Markdown, unggah keduanya, mapping berdasarkan field_id, pengisian otomatis setelah parsing, dan pilihan prompt AI kontekstual. Hasil impor menjalani autosave langsung.
6. `POST /api/books/:id/publishing-package/generate`: Generate AI langsung untuk SATU field non-evidence menggunakan model aktif sesuai settings provider. Scope owner DRAFT, safe origin, kuota, output max 12.000, tidak mengirim API key ke browser, melarang generator menerbitkan ISBN/sitasi/sertifikasi palsu. AI tidak otomatis dipanggil pada load; hanya setelah pengguna mengeklik tombol.
7. `app/api/books/[id]/export/route.ts`, `lib/export-job-runner.ts`: preview HTML/Flipbook dan renderer job membaca paket penerbitan tersimpan, termasuk dukungan backfill untuk paket lama; daftar isi tidak ditambahkan dua kali.

## QA yang benar-benar dijalankan

`node tests/publishing-package-stage4-e2e.cjs` — **PASS**:
- GET owner OK, anon 401, user lain 404, PUT user lain 404.
- Auto generate contextual: bab asli, subjek dan pembaca sesuai metadata; tidak mencetak klaim ISBN resmi.
- Pembuatan draf database awal otomatis, autosave teks manual dan persistensi setelah reload.
- Penolakan update stale expectedVersion 409.
- Unggah MD dengan referensi baru -> pemetaan ke field references -> autosave.
- Unggah XLSX yang mengubah afterword -> pemetaan -> autosave.
- Simulasi migrasi form lama 9 field menjadi 11 -> autosave dan tidak kehilangan isian yang telah ada.
- Prompt AI PENERBITAN, koherensi lintas Stage 1/2/3, peran regulatory-safe.
- Generate endpoint menolak field sensitif (400), menolak bukan owner (404), dan bila belum ada AI provider aktif mengembalikan 503 jujur.
- Hasil import terlihat di dua renderer pratinjau HTML dan Flipbook, termasuk daftar pustaka.
- Mode light/dark dan lebar 320, 375, 390, 768, 1024, 1440: panel terlihat; tanpa pageerror.
- Satu row paket penerbitan per buku QA dalam pengujian.

`npm run typecheck`: PASS.
Build Next.js isolated: PASS untuk versi sebelum auto-backfill final; pembaruan auto-backfill setelah build perlu diverifikasi lagi.
`git diff --check`: pemeriksaan terpisah diperlukan pada revisi final.

## Pemeriksaan buku target
- Buku `cmw6gk5gu005wurcoe0dk02jr` ditemukan, status DRAFT.
- Sembilan field paket lama sudah tersimpan. Modul kini akan melengkapi 2 field yang belum ada secara otomatis saat halaman dimuat, tanpa menimpa isian sebelumnya.
- **AI provider aktif pada database QA: TIDAK ADA.** Tombol Generate AI langsung memberi 503 sampai pengelola mengaktifkan model/API key. Prompt untuk AI eksternal tetap ada, tidak memerlukan key server.
- Rilis final, ISBN/Perpusnas, verifikasi bibliografi, lisensi, tanda terima distribusi, pembaca layar fisik dan sertifikasi format belum dapat diklaim selesai.

## Keputusan keamanan dan deployment
Tidak ada GitHub push, merge, maupun perubahan database produksi atau VPS. Seluruh pengujian dan data uji berada pada database QA terisolasi. Draf asli tidak diganti pada saat pengguna membuka halaman kecuali mengisi field yang sebelumnya belum ada. Untuk memperbarui seluruh paket dari Stage 1–3, pengguna harus memilih tombol Buat ulang seluruh isian dan menyetujui konfirmasi.
