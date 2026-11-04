# Audit forensik antarmuka BC Book Studio

Tanggal: 2026-11-04  
Branch: `feat/production-foundation-20261104`  
Status: **audit awal, belum layak dinyatakan siap produksi**

## Metode dan ruang lingkup
Pemeriksaan kode pada `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/studio-workspace.tsx`, `src/components/book-command-form.tsx`, `package.json`, dan `backend/app/main.py`; inventaris direktori backend/tests, docs, dan frontend pada checkout branch kerja. Tidak mengubah basis data, VPS, atau branch main.

## Temuan terverifikasi

| Area | Kondisi kode | Risiko / tindakan |
| --- | --- | --- |
| Navigasi | Satu halaman `src/app/page.tsx` mengubah tampilan lewat state `active`; banyak menu dikelompokkan menjadi 14 entri | Belum ada URL terpisah, deep link, atau navigasi browser yang andal; sederhanakan menjadi Beranda, Perpustakaan, Buat Buku, Ruang Kerja, Produksi, Mutu, Penerbitan |
| Beranda | Statistik proyek `0`, agen `11`, terbit `0`, dan layanan AI berupa literal dalam komponen | Angka bukan data backend; hapus metrik semu dan tampilkan status koneksi jujur |
| Perpustakaan | `Proyek Buku` dirender lewat `StudioWorkspace`; tidak terlihat pemanggilan API daftar proyek | Belum dapat mengklaim pencarian/penyaringan/persistensi proyek |
| Pembuatan buku | `BookCommandForm` berupa formulir panjang dengan banyak pilihan; menghasilkan perintah teks lokal | Belum merupakan wizard lima langkah dan belum menyimpan proyek melalui API |
| Penulisan | `StudioWorkspace` memakai state React untuk naskah; secara eksplisit mengingatkan bahwa perubahan belum tersimpan ke server | Tidak ada autosave server; jangan tampilkan indikator “Tersimpan” |
| Asisten editor | Definisi 11 peran agen dan dokumen kebijakan tersedia; UI `Pusat Agen` menyatakan orkestrator belum aktif | Jangan mengklaim Chief Editor siap bekerja di ruang kerja tanpa autentikasi dan endpoint yang aman |
| Backend HTTP | `backend/app/main.py` menyediakan `GET /health` dan `POST /api/v1/drafts` yang dilindungi `STUDIO_API_KEY` | Belum ditemukan API HTTP proyek, bab, autosave, ilustrasi, QA, atau ekspor dari berkas API yang diaudit |
| Identitas pengguna | API memakai satu bearer key editor; beranda menampilkan avatar literal `DW` | Belum ada bukti autentikasi pengguna individual, kepemilikan proyek, atau RBAC per proyek; jangan kirim kunci server ke browser |
| Worker | `backend/app/worker.py` menggunakan Redis, lease, klaim, hasil menunggu persetujuan, dan audit outbox | Mekanisme internal tidak otomatis menjadi API pengguna; perlu kontrak API terautentikasi dan status pekerjaan |
| Ilustrasi dan ekspor | Komponen studio menyediakan rancangan UI; backend HTTP yang diaudit tidak menyediakan endpoint berkas/ekspor | Tampilkan “Belum tersedia” dan kebutuhan integrasi, jangan gunakan keluaran tiruan |
| Sistem desain | Ada `globals.css` dan komponen UI khusus, namun belum ada pustaka komponen bersama untuk status/loading/error/dialog | Buat token dan komponen global bertahap; uji kontras, fokus keyboard, dark mode |
| Pengujian | CI backend, Quarto, buku kelas VII tersedia; Docker recovery terbaru gagal setelah penambahan skenario SIGKILL | UI belum memiliki bukti uji lint, TypeScript, build, E2E responsif dan aksesibilitas pada perubahan ini |

## Risiko kritis sebelum fitur web diaktifkan
1. **Autentikasi dan kepemilikan data**: Cloudflare Access melindungi hostname staging, tetapi tidak menggantikan pemeriksaan identitas dan otorisasi per proyek di backend.
2. **Penyimpanan**: komponen berbasis state lokal kehilangan isi ketika halaman dimuat ulang. Tidak boleh disebut autosave.
3. **Rahasia API**: `STUDIO_API_KEY` harus tetap di server. Jangan pernah memasukkannya ke bundle Next.js atau variabel `NEXT_PUBLIC_*`.
4. **Penerbitan**: persetujuan manusia dan validasi berkas akhir wajib menjadi gerbang backend.
5. **Kejujuran produk**: tombol tanpa operasi nyata harus diarahkan ke fungsi lokal yang jelas atau dinonaktifkan dengan alasan.

## Matriks integrasi yang dibutuhkan
- Proyek: daftar, buat, detail, ubah, arsip/hapus dengan otorisasi pemilik.
- Naskah: bab, revisi, penyimpanan dengan versi/konflik, status tersimpan.
- Produksi: buat pekerjaan, lihat progres, batalkan jika aman, setujui hasil.
- Aset: unggah, pratinjau, metadata, kepemilikan, persetujuan, hapus.
- Mutu: temuan terstruktur, tingkat keparahan, lokasi, tindakan koreksi.
- Penerbitan: pratinjau, permintaan ekspor, polling status, validasi dan unduh berkas.

Seluruh kontrak tersebut harus dipetakan ke endpoint yang benar-benar ada sebelum tombol UI diaktifkan. Hindari endpoint duplikat dan perubahan skema tanpa kajian.

## Urutan implementasi
1. Sederhanakan navigasi dan hapus indikator yang mengesankan data nyata.
2. Bangun sistem desain dan komponen global serta empty/loading/error state.
3. Bentuk wizard lima langkah dengan validasi dan ringkasan; **tahan aksi simpan** hingga API proyek aman tersedia.
4. Terapkan sesi pengguna dan otorisasi kepemilikan proyek di backend.
5. Hubungkan perpustakaan dan ruang kerja, lalu autosave dengan indikator terverifikasi.
6. Hubungkan Chief Editor dan antrean status pekerjaan.
7. Integrasikan ilustrasi, QA, dan ekspor satu per satu.
8. Jalankan lint, TypeScript, build, pengujian API, aksesibilitas, dan responsivitas; dokumentasikan bukti tangkapan layar nyata.

## Batas audit
Audit ini adalah audit statis kode dan inventaris file. Belum dilakukan login browser, uji responsivitas nyata, screenshot, pengujian API end-to-end, atau verifikasi VPS. Temuan “belum ditemukan” berarti belum terkonfirmasi pada ruang lingkup yang diperiksa, bukan bukti absolut bahwa tidak ada implementasi di seluruh repo.
