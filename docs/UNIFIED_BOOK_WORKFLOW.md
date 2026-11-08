# BC Book Studio — Satu alur, satu buku

Tanggal: 2026-11-07. Branch integrasi: integration/unified-book-workflow-20261107.
Baseline lokal: 8c0d8b3, 17 commit di depan main lokal fe35a33, plus 22 perubahan kerja yang dipertahankan. SHA produksi belum diverifikasi. Dokumen ini bukan klaim rilis.

## Kontrak UX
Navigasi primer: Beranda, Buku Saya, Buat Buku, Pengaturan; Review ditampilkan menurut RBAC. Di dalam buku hanya lima tahap: Ide, Rancang, Tulis, Review, Terbit. Satu bookId dan satu indikator simpan. Setiap tahap menampilkan hanya input inti, preview, Simpan dan Lanjut. Advanced dan AI dalam panel opsional. Tombol Next hanya aktif jika API validasi server mengembalikan ready=true, bukan hanya pengecekan frontend. Error harus menyebut field yang belum lengkap dan fokus ke sana.

## Data dan gerbang
1. Ide / BRIEF: judul, tipe fiksi/nonfiksi, pembaca, tujuan, sinopsis; CRUD dan validasi.
2. Rancang / OUTLINE: outline bab berurutan, tujuan tiap bab, drag-drop + alternatif tombol; CRUD dan validasi.
3. Tulis / DRAFT: editor blok paragraf, heading, daftar, gambar, tabel, latihan; autosave, revisi append-only, optimistic locking, preview dan undo; CRUD tanpa hard delete.
4. Review / REVIEW + APPROVED: checklist dan catatan, reviewer yang berwenang berbeda dari penulis, approve/reject dan immutable approval snapshot.
5. Terbit / EXPORTED: layout, pratinjau cetak, pemeriksaan metadata/lisensi, ekspor dari approved snapshot, human release confirmation.

## Pemetaan agen
BRIEF chief_editor+research; OUTLINE curriculum+author; DRAFT author+exercise+visual; REVIEW editorial+pedagogy+qa; APPROVED qa+chief_editor dengan keputusan manusia; EXPORTED publisher+layout+qa. Registry design_only tidak boleh digambarkan sebagai orkestrasi aktif. qmd-book-agent hanya subagen layout/qa/publisher.

## Aturan integrasi
Jangan hapus/migrasi destruktif Book/Chapter/ChapterRevision. Gunakan migrasi aditif dan backfill. Jangan mengganti enum status sebelum pembaca lama kompatibel. Jangan menggabungkan branch lain secara buta; bandingkan patch per fitur, tes dan pilih implementasi yang memenuhi kontrak. Lindungi auth, RBAC, secrets, JUMPA, layanan produksi. Jangan push atau deploy sebelum CI, E2E, backup/rollback dan persetujuan rilis.

## Acceptance E2E
User membuat buku, mengisi Ide, menyusun/mengurutkan outline, menulis blok dengan autosave dan refresh, reviewer menolak lalu menerima revisi, pemilik melihat preview dan ekspor snapshot yang disetujui. Uji dua pengguna, akses terlarang, 409 konflik, refresh, Back, mobile 320/375/390, tablet 768, desktop 1024/1440, light/dark, keyboard dan drag/drop. Produksi tetap HOLD sampai bukti lengkap.

## Verifikasi lokal 2026-11-07 — Konstitusi §4, §7, §8, §11, §12

Baseline Git `ffcb3bd5d2a53a8183830c601f8d68950ac5f9ee`; hasil berjalan sebagai perubahan lokal di worktree integrasi Windows, port 32979.

| Persyaratan | Implementasi sebelumnya | Perubahan | Uji dan bukti | Status |
|---|---|---|---|---|
| Persetujuan mengikat naskah | Status dan waktu persetujuan; ekspor membaca bab aktif | Snapshot metadata, bab berurutan dan aset terpakai dibuat dalam transaksi persetujuan. Transisi bersyarat menolak keputusan kedua. | E2E membuat buku, menolak self-approval dan admin tanpa penugasan, menyetujui sebagai reviewer, memeriksa snapshot dan menolak PATCH bab | PASS untuk kasus diuji |
| Ekspor dan publikasi memakai snapshot | Snapshot publikasi disalin dari bab aktif | Ekspor final dan publikasi membaca snapshot sesuai waktu persetujuan. Buku lama tanpa snapshot ditahan dengan HTTP 409. | E2E mengubah bab aktif setelah approval melalui fixture DB. HTML final dan halaman baca tetap memakai naskah yang disetujui. Cabut publikasi mengembalikan 404. Preview HTML bertanda draf. | PASS untuk HTML dan baca publik |
| Migrasi aditif | PostgreSQL QA lokal | Tabel BookApprovalSnapshot; tidak ada backfill sintetis | prisma validate, db execute, migrate status dan migrate diff terhadap schema, exit 0 | PASS lokal |
| Pemeriksaan build | Next.js dan Prisma | Build pada salinan sumber lokal untuk melindungi cache dev | prisma generate, npm run typecheck, npm run test:ai-providers (4/4), npx next build, git diff --check, exit 0 | PASS |
| CRUD/RBAC per tahap, optimistic locking, layout persisten, semua format, UI dan aksesibilitas | Sebagian rute dan UI tersedia | Di luar patch snapshot | Matriks penuh, konflik 409 antar editor, uji Unicode PDF, DOCX/EPUB validator, Flipbook, enam viewport, keyboard dan pembaca layar belum diuji di pekerjaan ini | NOT RUN / PARTIAL |

Catatan kompatibilitas. Buku dengan persetujuan lama perlu siklus review baru untuk menghasilkan snapshot. Alur pemulihan mandiri untuk buku lama belum tersedia. Rute publikasi yang digunakan berasal dari perubahan lokal sebelumnya. Status agen masih design_only. Rilis tetap NO_GO dan SHA produksi belum diverifikasi.

### Tahap Tulis — konflik penyuntingan bersamaan (§4, §7, §11, §17)

| Persyaratan | Sebelumnya | Perubahan | Bukti | Status |
|---|---|---|---|---|
| Penulisan bab tidak saling menimpa | PATCH memeriksa status DRAFT dan menyimpan riwayat, tanpa versi klien | PATCH membawa expectedVersion dari updatedAt. Penguncian baris buku dan pembaruan bersyarat menolak versi lama dengan 409. Riwayat dibuat dalam transaksi yang sama. | Dua PATCH serentak menghasilkan 200 dan 409, tepat satu revisi lama, dan permintaan tanpa perubahan tidak menambah riwayat. Anonim 401, lintas pemilik 404, tanpa versi 428. | PASS lokal |
| Autosave dan pemulihan | Formulir menyimpan tanpa mengetahui versi server | Autosave dan tombol Berikutnya memakai kontrak versi yang sama. Konflik menghentikan autosave, mempertahankan isi formulir, dan menawarkan pemuatan ulang dengan konfirmasi. | Playwright Chromium 390 px menahan konflik, memeriksa draf masih ada, memuat versi terbaru, lalu menyimpan perubahan berikutnya. | PASS untuk alur diuji |

Tidak ada migrasi tambahan. Klien PATCH lama perlu memuat ulang untuk mengirim expectedVersion. Pengarsipan bab, pemulihan dari riwayat, dan penyimpanan draf konflik lintas refresh masih terbuka. Pemeriksaan viewport ini hanya mencakup alur konflik. Perubahan tetap lokal dan belum memenuhi gerbang rilis.

### Tahap Tulis — pemulihan revisi dan urutan implementasi CRUD

| Kebutuhan | Sebelumnya | Perubahan | Bukti | Status |
|---|---|---|---|---|
| Baca dan pulihkan revisi bab | Riwayat menampilkan metadata saja | Riwayat menampilkan isi. Pemilik dapat memulihkan revisi pada bab DRAFT dengan konfirmasi. PATCH memakai pemeriksaan versi dan transaksi yang sama, dan menyimpan isi yang diganti sebagai entri riwayat baru. | E2E API + Chromium 390 px memulihkan versi 1, memeriksa riwayat dan menolak versi basi, akses lintas pemilik, revisi tidak ditemukan serta buku APPROVED. Typecheck, build Next.js, dan diff check exit 0. | PASS lokal |

CRUD Ide dapat dimulai dengan Book dan bookId yang sudah ada. Selesaikan validasi brief, riwayat, dan archive/recovery beserta tes kepemilikan sebelum memperluas mutasi. Sebelum mengaktifkan Lanjut lintas tahap, gunakan satu layanan transisi server dengan audit dan hasil validasi yang menunjuk ke field bermasalah. Pisahkan tahap authoring dari enum status editorial yang sudah dipakai. Setelah kontrak ini teruji pada Ide ke Rancang, pakai kontrak yang sama untuk tahap berikutnya. Pengarsipan bab dan pemulihan draf konflik lintas refresh masih terbuka. Tidak ada migrasi tambahan pada patch pemulihan revisi. Produksi tetap NO_GO.

### Tahap Ide — gerbang server menuju Rancang

| Kebutuhan | Sebelumnya | Perubahan | Bukti | Status |
|---|---|---|---|---|
| Brief memakai satu bookId | Judul, bidang dan deskripsi tersimpan; pembaca dan tujuan belum terstruktur | Field pembaca sasaran dan tujuan penulisan pada Book. Buku lama menerima string kosong sehingga dapat dilengkapi tanpa backfill sintetis. | Migrasi 20261107123000_brief_fields di PostgreSQL QA, prisma validate, migrate deploy, prisma generate exit 0. | PASS lokal |
| Gerbang dan audit | Validasi kartu dashboard hanya di browser; PATCH umum dapat mengganti tahap | GET/POST workflow menguji brief dan aktor di server. Transisi BRIEF ke OUTLINE dan audit Review dicatat dalam satu transaksi. PATCH umum menolak editorialStage. | E2E API menolak anonim, lintas pemilik, brief kosong, tujuan tidak valid, PATCH langsung, dan transisi ulang. Chromium 390 px mempertahankan bookId setelah refresh. | PASS lokal |
| Navigasi | Buat Buku tampil dua kali; Pusat Agen berada di bawah daftar tahap | Buat Buku tetap di menu utama, Ide menunjuk Buku Saya, Rancang membuka kerangka buku yang sama, dan pintasan Pusat Agen dilepas dari alur penulis. Rute serta data formulir yang ada dipertahankan. | Chromium menguji jalur Buku Saya ke Rancang. Audit semua menu, viewport dan role belum dijalankan. | PARTIAL |

Snapshot persetujuan dan status editorial DRAFT/REVIEW/APPROVED tetap dipakai. Perubahan ini belum menambah arsip/riwayat brief, CRUD kerangka penuh, atau transisi setelah OUTLINE. Patch lokal saja, rilis tetap NO_GO.
