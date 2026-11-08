# Rancang ke Tulis — QA lokal

| Kebutuhan | Implementasi | Bukti lokal |
|---|---|---|
| Kerangka dan naskah memakai bab yang sama | Chapter menyimpan judul, tujuan dan urutan. Isi naskah tetap terpisah dari tujuan. | E2E membuat bab, memperbarui tujuan, mengurutkan dan memuat ulang sebelum masuk Tulis. |
| Perpindahan dan audit | Layanan workflow memeriksa pemilik dan tujuan semua bab. Perpindahan OUTLINE ke WRITING memakai transaksi dan mencatat satu audit. | E2E menolak kerangka belum lengkap dan akses lintas pemilik, lalu memeriksa status dan audit. |
| Review membutuhkan naskah | Submit menolak bab dengan isi kurang dari 20 karakter. | E2E memeriksa penolakan bab kosong sebelum mengisi naskah dan meneruskan regresi publikasi HTML. |

Migrasi aditif 20261107130000_outline_objective diterapkan hanya di database QA lokal. Bab lama mendapat tujuan kosong sehingga pemilik dapat melengkapinya jika memakai alur Rancang. Typecheck dan build Next.js exit 0. Alur di Chromium diuji pada 390 px. Arsip dan pemulihan kerangka, drag-and-drop dalam Rancang, riwayat brief, dan tahap setelah Tulis masih memerlukan pekerjaan. Produksi tetap NO_GO.
