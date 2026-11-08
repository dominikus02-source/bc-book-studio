# Audit Rilis dan Kepatuhan Penerbitan BC Book Studio
**Tanggal:** 8 November 2026 (WIB)  
**Status dokumen:** laporan teknis QA lokal; BUKAN sertifikasi, bukti resmi ISBN, atau persetujuan rilis  
**Repo/branch:** dominikus02-source/bc-book-studio / integration/unified-book-workflow-20261107  
**Worktree:** F:/bc-book-import-export-20261106 (berisi perubahan lain yang belum dipilah)  
**Database yang dimigrasi:** hanya PostgreSQL terisolasi 127.0.0.1:55999/bookstudio_import_qa  
**Produksi:** TIDAK DIUBAH; RELEASE NO-GO

## 1. Ringkasan hasil

| Persyaratan | Bukti/implementasi saat ini | Status |
|---|---|---|
| Audit otomatis buku dan genre | lib/genre-policy.ts, lib/publishing-readiness.ts; delapan genre diperiksa dengan API | PASS (aturan dasar, QA lokal) |
| Matriks lima format dan saran isian | GET /api/books/:id/publishing-readiness, panel penerbitan | PASS (matriks status, BUKAN validasi berkas) |
| Bukti publikasi dan audit append-only | model BookPublishingEvidence, migrasi 20261108090000_book_publishing_evidence | PASS database QA |
| RBAC bukti | Owner mengajukan; ADMIN independen yang DITUGASKAN memeriksa; pihak lain ditolak | PASS untuk endpoint baru |
| Invalidasi bukti setelah perubahan tata letak | Bukti diikat approvedAt + layoutVersion; GET mengabaikan bukti lama | PASS integrasi QA |
| Pengamanan endpoint publikasi | POST /publication mengembalikan 409 NO_GO ketika persyaratan belum lengkap | PASS kasus negatif |
| Validasi ISBN resmi dan sertifikasi | Checksum ISBN-13 dan URL sumber Perpusnas; pemeriksaan pencocokan katalog resmi dan berkas bukti oleh otoritas manusia belum selesai | PARTIAL; BUKAN sertifikasi |
| Bukti distribusi dan serah simpan | Jenis DISTRIBUTION_PLAN, CATALOG, DISTRIBUTION_RECEIPT, DEPOSIT_RECEIPT; verifikasi manual/tautan diperlukan | PARTIAL, belum ada penerbitan nyata |
| DOCX, PDF, EPUB, HTML, Flipbook | Definisi validator dan pelaporan tersedia; artefak final lima format belum diuji lengkap | NO_GO |
| Flipbook ekspor mandiri | Pembaca simulasi per bab tersedia, tetapi tidak sama dengan Flipbook final tervalidasi | BLOCKED |
| Pembaca layar dan sentuhan fisik | UI browser emulasi diuji; NVDA/VoiceOver/TalkBack dan perangkat nyata belum diperiksa | NOT RUN |
| Impor lintas buku | Stage 2 mendukung banyak bab di dalam satu buku, bukan lintas buku | NOT IMPLEMENTED |
| Seluruh role/route/fungsi produk | 33 endpoint diinventaris; tes per peran untuk semua route belum lengkap | PARTIAL |
| Audit distribusi nyata | Bukti tautan ketersediaan permanen, serah simpan, receipt marketplace, ISBN/katalog belum diberikan | NOT RUN |

**Keputusan yang dapat dipertanggungjawabkan: NO-GO sampai semua bukti wajib tersedia.** Teks dan lampiran tidak boleh disulap menjadi "terverifikasi resmi" hanya karena checksum valid atau seorang pengguna mengklik checklist.

## 2. Matriks peran dan otorisasi

Peran di enum Prisma saat ini hanya **EDITOR**, **REVIEWER**, **ADMIN**. "Owner" adalah relasi ownerId, bukan role terpisah. Tidak ada role PUBLISHER, SUPERADMIN, YAYASAN, atau DISTRIBUTOR di schema BC Book Studio ini. Jangan menjanjikan akses role tambahan sebelum diimplementasikan dan diuji.

| Sumber daya/aksi | Owner (EDITOR/ADMIN) | REVIEWER ditugaskan | ADMIN ditugaskan (bukan owner) | ADMIN tidak ditugaskan | EDITOR bukan owner | Anonim | Bukti |
|---|---|---|---|---|---|---|---|
| Baca kelengkapan publikasi | Izinkan | Izinkan | Izinkan | Tolak 404 | Tolak 404 | Tolak 401 | E2E PASS |
| Ajukan bukti (append-only) | Izinkan, snapshot valid | 403 | 403 | 403 | 403 | 401 | E2E PASS |
| Verifikasi bukti/ISBN | 403 jika penulis sendiri | 403 | Izinkan setelah memeriksa pengajuan yang valid | 403 | 403 | 401 | E2E PASS |
| Persetujuan rilis sebelum lima format memenuhi syarat | 409 NO_GO | Tidak berwenang | Tidak dapat menerbitkan sebagai nonowner | Tolak | Tolak | Tolak | Kasus NO_GO PASS, happy path BLOCKED |
| Ubah tata letak APPROVED | Owner diizinkan dengan expectedVersion; menginvalidasi bukti lama | Tidak | Tidak, kecuali owner | Tidak | Tidak | Tidak | Versi dan invalidasi PASS |
| CRUD Ide/metadata | Owner di DRAFT | Read-only pada penugasan relevan | Kebijakan ownership tetap berlaku | Tidak boleh bypass ownership | Tidak | Tidak | Pengujian stage sebelumnya; belum seluruh kombinasi |
| CRUD Rancang, hierarki, bulk | Owner DRAFT dan gate yang valid | Tidak | Tidak bila bukan owner | Tidak | Tidak | Tidak | Regresi bab/subbagian PASS subset |
| CRUD Tulis, aset, revisi | Owner DRAFT | Tidak | Tidak bila bukan owner | Tidak | Tidak | Tidak | Regresi editor/aset PASS subset |
| Kirim untuk review | Owner DRAFT | Tidak | Tidak bila bukan owner | Tidak | Tidak | Tidak | Ada gate, matriks penuh NOT RUN |
| Setujui/menolak review | Owner tidak boleh menilai diri sendiri | Reviewer yang ditugaskan | ADMIN yang ditugaskan dan independen | Tidak | Tidak | Tidak | Implementasi terlihat, matriks penuh NOT RUN |
| Baca publikasi yang sudah live | Sesuai status publik | Sesuai status publik | Sesuai status publik | Sesuai status publik | Sesuai status publik | Hanya konten yang diterbitkan | UI reader/akses publik penuh NOT RUN |

Inventaris seluruh **33 API endpoint** ada di `docs/ROUTE_RBAC_INVENTORY_20261108.md`. Matriks hasil inspeksi kode bukan pengganti uji HTTP negatif. Akun reviewer dan ADMIN harus memiliki penugasan ke buku untuk memeriksa bukti; role ADMIN secara global tidak otomatis berarti boleh membaca setiap buku.

## 3. Matriks invalidasi perubahan

| Perubahan | Efek yang seharusnya | Bukti / keterbatasan |
|---|---|---|
| Judul, tujuan, sasaran pembaca, genre sebelum approval | Hitung ulang readiness brief, kerangka dan genre | Sudah dihitung dari DB, per transisi |
| Bab, subbagian, naskah, aset pada DRAFT | Perbarui readiness, revisi/audit; tidak bisa menganggap review sebelumnya berlaku | Ada CRUD/versioning; audit seluruh rute belum lengkap |
| Penolakan/reapproval yang menghasilkan approvedAt baru | Bukti penerbitan yang mengacu approvedAt lama tidak lagi berlaku | Terimplementasi lewat pembanding timestamp; E2E khusus reapproval belum dijalankan |
| Penyuntingan tata letak setelah approval | Kenaikan layoutVersion membuat semua bukti lama tidak berlaku untuk versi baru | PASS E2E, termasuk stale 409 |
| Pengarsipan/pemulihan | Arsip bukan hapus permanen; setelah perubahan konten/reapproval perlu bukti baru | Regresi drag/drop desktop setelah arsip/pemulihan telah PASS pada pengujian sebelumnya; audit fisik tetap NOT RUN |
| Perubahan checksum/artefak format tanpa pembaruan layoutVersion | Bukti lama HARUS dibatalkan berdasarkan perubahan artefak | **BELUM** ada registry export job final yang mencocokkan hash real-time. Status NO_GO tetap menutup rilis |
| ISBN/edisi berubah | Harus meminta peninjauan ISBN untuk edisi/format baru; tidak otomatis mewariskan ISBN yang sama | **BELUM** ada sistem edition/form ISBN terpisah |
| URL katalog/berkas di situs eksternal berubah | Butuh pengecekan berkala dan bukti URL baru | Tidak ada pemantauan otomatis; tetap wajib manusia |
| Publikasi ditarik | Akses publik harus dihentikan, riwayat publikasi dan bukti tidak dihapus | Endpoint unpublish tersedia; ulang tes keseluruhan diperlukan |

## 4. Genre: delapan profil resmi aplikasi

| Genre | Jenis buku | Saran otomatis pada tahap penulisan dan validasi |
|---|---|---|
| NOVEL | FICTION | Tokoh, alur, konflik, konsistensi kronologi dan hak cipta |
| SHORT_STORY | FICTION | Struktur cerita, resolusi, konsistensi perspektif dan orisinalitas |
| ANTHOLOGY | FICTION | Tema, atribusi tiap penulis, hak semua kontribusi |
| POETRY | FICTION | Bait, larik, bentuk, tipografi dan izin reproduksi |
| TEXTBOOK | NONFICTION | Capaian belajar, tujuan, contoh, asesmen, fakta dan sumber |
| REFERENCE | NONFICTION | Kedalaman substansi, indeks, sitasi yang dapat dilacak |
| GUIDE | NONFICTION | Urutan prosedur, prasyarat, keselamatan dan langkah verifikasi |
| WORKBOOK | NONFICTION | Soal, jenjang kesulitan, kunci jawaban, kesesuaian kompetensi |

Test `tests/publishing-genre-matrix-e2e.cjs` mengecek seluruh 8 genre dan satu pasangan jenis/genre yang sengaja salah. Hasil PASS hanya mencakup aturan klasifikasi awal. Mutu sastra/pedagogis, sitasi, izin dan kelayakan ISBN tidak dapat disertifikasi lewat pencocokan enum.

## 5. Lima format publikasi: bukti yang diperlukan

| Format | Pemeriksaan wajib | Ketersediaan saat audit | Status |
|---|---|---|---|
| DOCX | Validasi paket OOXML, heading semantis, TOC, tabel, gambar, Unicode, pembukaan/edit di Word/LibreOffice, hash SHA-256, tanda tangan editor | API ekspor dasar; artefak final nyata belum dilampirkan | VALIDATOR/BUKTI BELUM LENGKAP |
| PDF | Metadata, sumber snapshot, font Unicode, halaman, kualitas cetak; preflight PDF/X sesuai kebutuhan printer, PDF/UA/veraPDF untuk profil aksesibilitas, peninjauan manual | API ekspor dasar; masalah fallback Unicode perlu audit | VALIDATOR/BUKTI BELUM LENGKAP |
| EPUB3 | Paket, manifest, spine, navigasi, reflowable, EPUBCheck, Ace by DAISY, EPUB Accessibility 1.1, uji pembaca elektronik, checksum | API ekspor dasar tanpa bukti EPUBCheck final | VALIDATOR/BUKTI BELUM LENGKAP |
| HTML | Standalone semantis, heading, navigasi, WCAG 2.2 AA, Nu HTML Checker, axe, keyboard, keamanan publik/private, checksum | API ekspor HTML dasar | VALIDATOR/BUKTI BELUM LENGKAP |
| Flipbook | Pembaca interaktif sebenarnya, navigasi halaman, mode linear, keyboard/touch, zoom, persistensi, share/revoke, E2E; checksum/bukti | Simulasi preview per bab bukan format final | NOT IMPLEMENTED |

Adapter CLI `scripts/validate-release-artifacts.cjs` menerima berkas asli untuk melakukan pemeriksaan awal struktur dan SHA-256; EPUBCheck dapat dipakai jika disediakan JAR melalui EPUBCHECK_JAR; Nu HTML Checker memakai VNU_JAR. CLI tidak memberi sertifikasi, dan **tidak ada lima artefak final yang diserahkan saat audit**. Hasil tanpa berkas sengaja dicatat NO_GO/NOT_RUN pada `docs/QA_RELEASE_VALIDATOR_NOT_RUN_20261108.json`.

Inventaris alat pada komputer: Java dan Quarto ada; perintah epubcheck, veraPDF, Nu HTML Checker/vnu, Ace DAISY, Pandoc, dan LibreOffice tidak ditemukan di PATH saat pemeriksaan. Ketiadaan perintah bukan berarti semua file pasti salah, tetapi validasi tersebut tidak dapat diklaim telah dilakukan.

## 6. ISBN, Perpusnas, sertifikasi dan bukti terbit

**Dasar resmi yang diperiksa:**
- https://isbn.perpusnas.go.id/landing_page/home — FAQ Perpusnas dan dokumen pengajuan.
- https://isbn.perpusnas.go.id/landing_page/isbn_info — definisi, kriteria kelayakan dan kategori yang tidak mendapat ISBN.
- https://isbn.perpusnas.go.id/landing_page/regulasi — regulasi, termasuk Peraturan Perpusnas 11/2025.
- https://www.iso.org/standard/65483.html — ISO 2108:2017, ISBN untuk bentuk/edisi produk yang dipasarkan secara terpisah.
- https://jdih.perpusnas.go.id/ — UU 13/2018 tentang Serah Simpan Karya Cetak dan Karya Rekam.
- https://www.w3.org/TR/epub-a11y/ dan https://www.w3.org/WAI/standards-guidelines/wcag/ — standar aksesibilitas.
- https://github.com/w3c/epubcheck dan https://docs.verapdf.org/validation/ — validator format.

**ISBN tidak otomatis wajib untuk setiap draft/ekspor privat** dan tidak semua karya memenuhi ketentuan ISBN. Keputusan harus mempertimbangkan jangkauan publik, jenis/edisi, penerbit, dan aturan Perpusnas yang berlaku. Untuk pengajuan, siapkan surat permohonan, halaman awal, naskah final bertanda watermark, pernyataan keaslian/izin yang sesuai, dan tautan katalog judul pada situs penerbit. Perpusnas berwenang menilai kesesuaian, bukan BC Book Studio.

Kolom ISBN pada API menguji algoritma checksum ISBN-13; penyimpanan status diperiksa oleh ADMIN ditugaskan yang independen dan meminta URL HTTPS Perpusnas. **Ini audit catatan manusia, bukan integrasi pencocokan langsung katalog Perpusnas**, sehingga sertifikasi ISBN resmi masih perlu bukti metadata judul, penerbit, nomor, dan edisi yang benar. Barcode saja atau URL beranda Perpusnas bukan bukti penetapan untuk judul tertentu.

Penerbitan dan distribusi harus membedakan:
1. **Sebelum terbit:** hak cipta/lisensi, pilihan/kelayakan ISBN, katalog penerbit, rencana distribusi, validator format, aksesibilitas dan sign-off.
2. **Setelah terbit:** bukti terbit, URL titik akses yang permanen, ketersediaan distributor/retailer, serah simpan dan tanda terima bila diwajibkan, serta perubahan lokasi/edisi.
3. **Tindakan eksternal:** penerbit/Perpusnas/validator/otoritas terkait. BC Book Studio hanya menyimpan bukti, audit dan status kesiapan—tidak menerbitkan ISBN atau sertifikat sendiri.

## 7. CRUD, backend, UI dan database

**Baru di QA lokal:**
- Prisma model `BookPublishingEvidence`, append-only, kolom actorId, kind, status, approvedAt, layoutVersion, checksum/validator/URL/ISBN, waktu dan pengajuan yang ditinjau. Migrasi additive `20261108090000_book_publishing_evidence`.
- `GET/POST /api/books/[id]/publishing-readiness`: membaca kesiapan/riwayat, mengajukan catatan, dan meninjau dengan RBAC di server. Validasi input ketat melalui Zod; URL hanya HTTPS; stale snapshot/layout 409; catatan riwayat tidak ditimpa.
- `POST /api/books/[id]/publication`: pengaman NO_GO bila ada kekurangan. Menarik publikasi tetap tersedia untuk kasus yang sudah live.
- `PublishingReadinessPanel` di modul Penerbitan menampilkan kekurangan dan langkah berikutnya, daftar lima format, saran otomatis, formulir bukti dan riwayat. Tombol publikasi dinonaktifkan jika prasyarat belum lengkap.
- Source of truth status tetap **database**, bukan warna kartu, label, atau pilihan pengguna di frontend.

**Bukan implementasi selesai:** lisensi/hak cipta belum diperiksa manusia untuk buku nyata; bukti format belum diuji dengan validator eksternal; ISBN resmi belum ditetapkan; sertifikat/hasil uji institusi belum diunggah; semua route RBAC belum dijalankan untuk tiap peran; impor lintas buku belum ada; dukungan screen reader nyata belum teruji.

## 8. Bukti pengujian yang benar-benar dijalankan

| Tes | Yang diverifikasi | Status |
|---|---|---|
| Prisma validate + migrate deploy | Migrasi 20261108090000 ke DB QA saja | PASS |
| tests/publishing-readiness-e2e.cjs | Owner/reviewer/admin-ditugaskan/admin-tidak-ditugaskan/editor-lain/anonim; pengajuan, penolakan, ISBN invalid, Flipbook NO-GO, publikasi 409, invalidasi layout, UI responsif | PASS |
| tests/publishing-genre-matrix-e2e.cjs | 8 genre valid dan 1 pasangan jenis/genre tidak sesuai | PASS |
| npm run typecheck | Tipe backend, frontend, Prisma | PASS |
| scripts/audit-route-rbac.cjs | Inventaris 33 endpoint, metode dan indikasi kontrol | PASS inventaris statis, **BUKAN PASS RBAC** |
| scripts/validate-release-artifacts.cjs tanpa berkas | Lima format dilabeli NOT_RUN, bukan sertifikasi fiktif | PASS fail-closed |
| Pengujian perangkat pembaca layar fisik, iOS/Android nyata, manual QA lima format | Tidak dijalankan | NOT RUN |
| Penerbitan resmi, nomor ISBN valid untuk judul nyata, distribusi, serah simpan | Tidak dijalankan | BLOCKED/UNKNOWN |

## 9. Risiko/aksi berikutnya sebelum rilis

1. Audit dan perbaiki registry semua format, termasuk artefak Flipbook mandiri, bukan preview bab.
2. Pasang jalur validator resmi yang dapat dieksekusi, rekam checksum/tool version, proof editor dan tautan artefak; uji buka DOCX, PDF, EPUB, HTML, Flipbook sebenarnya.
3. Jalankan matriks otorisasi negatif untuk 33 route, termasuk identitas, pemilik, reviewer ditugaskan, admin ditugaskan, admin tak ditugaskan, pengguna luar dan anonim.
4. Uji siklus revisi setelah approval, pergantian genre/edisi, invalidasi artefak saat checksum berubah, URL publik berubah, serta rollback data.
5. Selesaikan audit aksesibilitas manual dengan pembaca layar dan perangkat sentuh fisik, proof review sastra/pedagogik, sitasi, dan validasi semua genre.
6. Integrasi bukti resmi Perpusnas dan katalog terbit milik penerbit yang sah. Untuk bukti distribusi, siapkan resi penerimaan/serah simpan serta URL permanen setelah publikasi.
7. Isolasi perubahan ke PR yang dapat ditinjau, semua CI lulus, backup/restore rehearsal, dan GO tertulis sebelum deploy.

**Hasil saat ini: PARTIAL IMPLEMENTATION + NO-GO PRODUCTION.** Tidak dilakukan deploy staging/produksi, tidak ada ISBN atau sertifikasi resmi yang diterbitkan, dan tidak ada perubahan ke database produksi.

## 10. Hasil audit lanjutan setelah build (8 November 2026)

- **PASS** `npx prisma migrate status` pada database QA `127.0.0.1:55999/bookstudio_import_qa`: 19 migrasi, skema mutakhir.
- **PASS** build Next.js terisolasi `F:/tmp/bc-workflow-build-20261108`: `npx next build` exit 0, 17/17 halaman statis. Percobaan `npx prisma generate` di salinan build awalnya EPERM karena `node_modules` merupakan junction ke worktree yang sedang dijalankan server; client telah digenerasi berhasil di worktree QA setelah restart dev server. Build akhirnya berhasil tanpa regenerate kedua.
- **PASS** `npm run typecheck` exit 0, `git diff --check` exit 0 setelah merapikan baris kosong.
- **PASS** `tests/publishing-readiness-e2e.cjs` termasuk backend dan antarmuka 12 kombinasi lebar/tema, role independen, bukti append-only, ISBN checksum, URL HTTPS resmi, NO-GO penerbitan, dan invalidasi versi layout.
- **PASS** `tests/publishing-genre-matrix-e2e.cjs` mencakup 8 genre dan 1 kombinasi salah.
- **FAIL / TIDAK BOLEH DIANGGAP PASS** `tests/approval-snapshot-e2e.cjs`: timeout UI karena selector editor klasik Stage 3 berada pada detail yang sekarang tersembunyi oleh desain terbaru. Awal tes concurrent version/409 dan revisi PASS, selebihnya pada tes ini belum dilanjutkan. Perlu modernisasi E2E agar menggunakan editor aktif, bukan membuka UI yang sengaja disembunyikan.
- **FAIL / NOT PASS** `tests/workflow-rbac-ux-e2e.cjs`: RBAC owner/anonymous dan navigasi dua buku PASS, tetapi pemeriksaan overflow global pada Stage 3 light mode lebar **320 px** gagal. Ini menjadi blocker UI/UX yang perlu dipetakan dengan elemen penyebab sebelum rilis.
- Dua tes gagal ini mengakhiri batch gabungan lebih awal sehingga stage1-crud, stage2-hierarchy, stage3-asset dan bulk25 dalam batch tersebut **NOT RUN** dalam pengujian pascaperubahan, meskipun ada bukti PASS dari percakapan sebelumnya. Jangan menyalin status historis sebagai sign-off QA rilis terbaru.
- **INVALIDASI BELUM LENGKAP:** Reapproval dan layoutVersion memang menginvalidasi catatan historis, tetapi belum ada registri artefak resmi yang memastikan checksum baru, perubahan edisi/ISBN tiap format, perubahan URL distribusi/katalog, dan bukti serah simpan memperoleh verifikasi ulang. Publikasi tetap fail-closed NO-GO, sehingga gap ini tidak boleh disembunyikan.
- **KONTEKS HUKUM:** URL beranda Perpusnas ditambah checksum ISBN13 bukan pembuktian bahwa nomor tersebut benar-benar dialokasikan ke buku, penerbit, format, dan edisi yang sama. Pemeriksaan record resmi judul-spesifik oleh pihak berwenang masih **NOT RUN**.
- **KONTEKS LIMA FORMAT:** CLI hanya pemeriksa struktur awal; validator internasional yang sebenarnya (EPUBCheck/veraPDF/Nu HTML Checker/Ace DAISY), buka artefak fisik, peninjauan aksesibilitas dan bukti distribusi belum dijalankan. **NO-GO**.
