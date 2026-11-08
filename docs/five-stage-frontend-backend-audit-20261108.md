# BC Book Studio — Audit konsistensi UI ↔ CRUD ↔ database (8 November 2026)

Lingkungan: worktree lokal `integration/unified-book-workflow-20261107`, QA DB isolasi `127.0.0.1:55999/bookstudio_import_qa`. **Tidak diterapkan ke GitHub/produksi.**

## Prinsip acceptance
- Setiap CTA mempunyai efek backend yang dapat diperiksa atau dijelaskan jelas sebagai pratinjau/draf mandiri.
- Tidak menyatakan agen, validasi manusia, ISBN, dan publikasi sudah siap tanpa bukti server.
- Isian disimpan di database sesuai kepemilikan, status, versi, dan gates; UI tidak mengklaim operasi sukses sebelum respons.
- File XLSX/MD hanya membawa field yang diizinkan; rahasia API tidak pernah diekspor.
- Proses persetujuan reviewer tetap manusia dan terpisah dari penulis.

## Matriks lima tahap
| Tahap | Peran pengguna | Penyimpanan & gate backend | Bukti QA | Sisa risiko |
|---|---|---|---|---|
| 1 Ide | Menentukan buku/brief | Book CRUD, optimistic concurrency, arsip/pemulihan, genre policy, workflow readiness | `stage1-crud-e2e.cjs` PASS, `stage-autofill-ai-integration-e2e.cjs` PASS | Editor draf `Idea Lab` tersimpan terpisah; belum otomatis menjadi buku sampai memakai Buat Buku |
| 2 Rancang | Membuat bab/subbagian | Chapter CRUD/riwayat, owner/RBAC, urutan, import & autosave, gate lanjut | `stage2-crud-e2e.cjs` PASS, import QA PASS | Semua hierarki/genrenya perlu uji UI berulang sesuai kebutuhan |
| 3 Tulis | Menulis bab, aset, hasil ekspor draf | Chapter versioned save, editor blok, revisi, import/AI, aset metadata | `stage3-import-autosave-e2e.cjs` PASS | Tes lama `stage3-block-crud-e2e.cjs` menggunakan selector/aksi UI lama; tidak dianggap PASS |
| 4 Review | Checklist editorial dan reviewer independen | Endpoint assignments, RBAC, pengajuan/reject/approve, immutable approved snapshot | `workflow-rbac-ux-e2e.cjs` backend PASS; `approval-snapshot-e2e.cjs` ditinjau terpisah | Navigasi multi-buku pada tes lama perlu QA terpisah |
| 5 Terbit | Pratinjau layout, bukti format, penerbitan dan penarikan | Snapshot approved, layout versioned, PublishingReadiness gates, publication state | `publishing-package-stage4-e2e.cjs` PASS, `publishing-readiness-e2e.cjs` PASS | Uji hasil ekspor multi-format dan sertifikasi teknis tetap menjadi gate rilis |

## Perubahan front-end yang dilakukan
- Sembunyikan tautan Tinjauan Pedagogis yang hanya berisi textarea lokal tanpa endpoint simpan/keputusan.
- Sembunyikan Pusat Agen dari navigasi karena registry masih berstatus design-only (kode dan data tidak dihapus).
- Hilangkan editor layout demo yang hanya menyimpan browser-local, untuk menghindari kebingungan dengan layout buku nyata.
- Ganti statistik dasbor bersifat promosi/fiktif dengan hitungan buku REVIEW dan DRAFT dari `GET /api/books`; hilangkan klaim Cloudflare/agent ready tanpa status backend.
- Di Tata Letak DRAFT, hilangkan duplikasi editor Stage 3; arahkan ke penulisan dan tab pratinjau. Editor layout sesungguhnya hanya tersedia setelah snapshot persetujuan.
- Pada tahap Review hilangkan tautan reviewer yang menawarkan akses kepada penulis (RBAC reviewer tetap server).
- Pada Penerbitan, aksi publikasikan/tarik dan tautan publik dibatasi state `book.publication`.
- Hapus kartu kurikulum dekoratif dan placeholder gambar tanpa aksi, ganti dengan petunjuk menyimpan brief dan membuka aset sungguhan.
- Tegaskan bahwa Idea Lab, Kurikulum, Studio Latihan, dan Studio Visual menyimpan draf modul tersendiri; tidak otomatis menyisipkannya ke bab buku.

## Pengujian dan kejujuran status
- `tests/five-stage-frontend-backend-contract-e2e.cjs`: 5 halaman stage PASS dan URL/menu/responsivitas HP PASS.
- `tests/workflow-rbac-ux-e2e.cjs`: **PASS (exit 0)** untuk dua buku, URL/refresh/Back, lima workspace × enam lebar layar × tema terang/gelap, owner/RBAC, reviewer independen, dan catatan kritis bersamaan dengan approval.
- `tests/legacy-editor-visibility-regression-e2e.cjs`: **PASS** pada browser QA terisolasi; panel klasik membuka kartu bab dan konflik versi 409 mempertahankan draf lokal.
- `tests/approval-snapshot-e2e.cjs`: **PASS (exit 0)** pada server QA terisolasi port 32980; konflik bab, pemulihan, migrasi tahap, arsip/reorder, layout autosave, snapshot immutable, ekspor HTML dan strict publication NO_GO. Jalur positive publish/read/revoke **NOT_RUN** sampai bukti validasi lima format tersedia.
- Cache Next.js untuk QA dipisahkan melalui `BC_QA_NEXT_DIST_DIR=.next-ui-qa` karena cache `.next` dibersihkan oleh proses lain selama tes. `next.config.mjs` menyediakan opsi ini tanpa mengubah pengaturan produksi ketika env tidak disetel.
- Audit encoding PASS 158 file, 0 masalah. `npx tsc --noEmit --pretty false` **PASS** setelah Prisma Client 6.19.3 berhasil diregenerasi ke direktori sementara lalu metadata client disalin dengan mempertahankan query-engine DLL yang terkunci. Runtime smoke test memastikan model `PublisherDocument` dan `BookPublishingEvidence` tersedia serta `SELECT 1` berhasil.
- `tests/publishing-readiness-e2e.cjs`: **PASS (exit 0)**; matriks RBAC, pengajuan bukti oleh pemilik, verifikasi ADMIN independen, ISBN/URL resmi, checksum, invalidasi bukti saat layout berubah, NO-GO, dan tombol publikasi tetap disabled. Pengujian 12 kombinasi tema/viewport juga lulus.
- `tests/publishing-reader-browser-e2e.cjs`: **PASS** setelah ekspektasi jumlah halaman diperbaiki dari angka tetap 12 menjadi minimal 12 (buku QA kini memiliki 14 halaman depan/isi/belakang). HTML dan Flipbook, mode terang/gelap, kontrol halaman, pembacaan, dan empat lebar layar tanpa JS error.
- `tests/publishing-accessibility-browser-e2e.cjs`: **PASS** untuk HTML dan Flipbook pada 390/1280 px; kontras WCAG AA 15.6:1 (terang) dan 13.9:1 (gelap), navigasi sidebar keyboard/Escape, tanpa JS error.
- `tests/publishing-reader-paper-fit-e2e.cjs`: **PASS** untuk 5 lebar layar (320–1440 px), HTML/Flipbook, 13 pilihan kertas dan mode Flipbook hingga 8 halaman; selector tes diperbarui untuk membuka panel pengaturan sebelum menguji ukuran kertas.
- `tests/publishing-html-images-e2e.cjs`: **PASS**; tiga gambar tertanam sebagai data URI dan tampil dengan alt text pada HTML serta Flipbook.
- `scripts/validate-two-book-release-qa.cjs`: kedua buku PASS struktur DOCX/PDF/EPUB/HTML/Flipbook; EPUBCheck 5.4.0 PASS untuk kedua EPUB. Ini tetap validasi artefak lokal, bukan sertifikasi.
- `next.config.mjs` menyediakan `BC_QA_NEXT_DIST_DIR` agar build/QA dapat memakai direktori terisolasi. `lib/pagination-output.ts` membaca font KaTeX dari path runtime agar webpack tidak mencoba mem-parse file TTF sebagai JavaScript.
- `npm run build` lokal masih terhalang pre-step `prisma generate` karena DLL terkunci (`EPERM`); `npx next build` terpisah sedang/akan diverifikasi menggunakan `.next-ui-qa`. Jangan menyamakan TypeScript PASS dengan production build PASS.
- Belum tersedia di workstation: veraPDF, LibreOffice/Word CLI, dan Nu HTML Checker. DOCX round-trip manual, PDF/A atau PDF/UA preflight, HTML validator/axe lengkap, keyboard/touch/screen-reader perangkat nyata tetap NOT_RUN. Karena itu keputusan publikasi positif tetap NO_GO.
- Jangan mengklaim seluruh kontrol, semua genre/ukuran, layar sentuh dan keyboard, failover AI, serta lima format ekspor telah lulus hanya dari pemeriksaan ini.
- Data QA uji dibuat terpisah dan dibersihkan, produksi tetap HOLD.

## Gate berikutnya sebelum push/deploy
1. Seluruh tes browser Stage 1–5 di satu rangkaian dengan tiga peran dan dua buku; periksa setiap tombol/aksi serta seleksi buku saat browser Back.
2. Pemeriksaan aksesibilitas keyboard, pembaca layar, dan perangkat sentuh.
3. E2E reviewer approval → layout versioning → bukti format → publish/unpublish/read-public dengan fixture terisolasi.
4. Migrasi, build, dan kode review terhadap seluruh perubahan worktree (sebelum staged commits per-file; worktree sudah berisi perubahan lain).
5. CI semua hijau dan bukti backup/restore rollback; jangan ubah produksi lebih dulu.
