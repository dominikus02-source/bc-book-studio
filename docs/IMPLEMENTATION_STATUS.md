# Status Implementasi BC Book Studio

Tanggal pembaruan: 30 Oktober 2026

## Sudah tersedia di cabang pengembangan

- [x] Repositori privat dan cabang kerja terpisah dari main.
- [x] Kerangka Next.js App Router dan TypeScript.
- [x] Dasbor dan navigasi modul berbahasa Indonesia.
- [x] Ruang kerja awal untuk seluruh modul produksi.
- [x] Pusat Agen dengan katalog 11 peran.
- [x] Spesifikasi instruksi, batas kewenangan, dan format keluaran 11 agen.
- [x] Delapan spesialisasi keilmuan dan matriks penugasan agen.
- [x] Dua belas profil jenjang kelas berstatus draf.
- [x] Templat instruksi agen standar berversi.
- [x] Kontrak data awal untuk proyek, bab, latihan, temuan, dan persetujuan.
- [x] Studio Latihan dapat menyusun dan mengelola daftar butir draf di memori sesi.
- [x] Alur produksi buku dan gerbang persetujuan manusia.
- [x] Kebijakan operasional AI, privasi, biaya, dan keselamatan.
- [x] Pemeriksaan otomatis GitHub Actions pada commit sebelumnya.

## Belum tersedia / pekerjaan berikutnya

- [ ] Simpan otomatis draf lintas sesi/perangkat.
- [ ] Pengujian antarmuka menyeluruh pada ponsel, tablet, dan desktop.
- [ ] Pengujian aksesibilitas.
- [ ] Validasi ahli untuk profil kelas 1–12.
- [ ] Autentikasi, otorisasi, dan manajemen anggota.
- [ ] Backend, basis data, penyimpanan berkas, antrean, pekerja, dan orkestrator.
- [ ] Gerbang penyedia AI baru, pencatatan biaya, dan fallback.
- [ ] Ekspor PDF/EPUB/HTML.
- [ ] Integrasi API BahasaCerdas melalui staging.

## Batas kejujuran produk

Semua fitur yang belum memiliki backend adalah rancangan atau draf lokal. Butir latihan yang dibuat pada tahap frontend hanya berada dalam memori sesi dan akan hilang ketika halaman dimuat ulang. Tidak ada agen yang sedang menjalankan tugas AI, tidak ada buku yang sedang diproduksi, dan belum ada pemanggilan penyedia AI.

## Gerbang penerimaan frontend

1. Pemeriksaan lint dan build produksi berhasil.
2. Navigasi antarmodul dapat digunakan.
3. Formulir tidak kehilangan data saat berpindah antarbagian selama komponen tetap aktif.
4. Tampilan dapat digunakan pada ponsel dan desktop.
5. Tidak ada rahasia atau kunci API di sisi klien.
6. Status draf lokal dan layanan belum aktif terlihat jelas.
7. Tidak ada klaim produksi nyata sebelum backend tersedia.
