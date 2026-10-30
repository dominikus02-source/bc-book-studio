# Alur Produksi Buku

## Status alur
Alur ini merupakan rancangan konseptual. Eksekusi, checkpoint, antrean, dan pemulihan baru tersedia setelah backend dibangun.

## Tahapan
1. Intake: jenis buku, audiens, kelas, tujuan, bahasa, hak sumber, batas biaya.
2. Riset: kebutuhan pembaca, sumber, fakta, dan kesenjangan.
3. Kurikulum: pemetaan capaian dan tujuan bila buku terkait pembelajaran formal.
4. Perencanaan: struktur buku, bab, estimasi halaman, aset, dan kriteria mutu.
5. Penulisan: naskah per bagian dengan versi dan sumber.
6. Latihan: soal, kunci, pembahasan, rubrik, dan pemeriksaan butir.
7. Visual: brief dan aset dengan catatan provenance/lisensi.
8. Penyuntingan: bahasa dan keterbacaan dengan diff.
9. Telaah pedagogis: kesesuaian jenjang dan tujuan.
10. QA: kelengkapan, fakta, sumber, konsistensi, duplikasi, dan hak penggunaan.
11. Tata letak: HTML/CSS semantik, paginasi, PDF/EPUB/HTML.
12. Persetujuan manusia: keputusan editor/pemilik hak.
13. Penerbitan: metadata, manifest, versi, arsip, dan distribusi.

## Gerbang wajib
- G1: ruang lingkup dan audiens disetujui.
- G2: sumber dan hak penggunaan ditinjau.
- G3: kerangka buku disetujui.
- G4: naskah lengkap dan referensi tertaut.
- G5: soal dan kunci ditinjau.
- G6: penyuntingan dan telaah pedagogis selesai.
- G7: QA tidak memiliki temuan kritis terbuka.
- G8: layout lolos pemeriksaan visual dan aksesibilitas.
- G9: persetujuan manusia sebelum penerbitan.

## Pemulihan
Setiap tahap harus menyimpan input snapshot, versi instruksi, output, status, percobaan, dan checkpoint. Jika tahap gagal, ulangi tahap tersebut setelah penyebab diperbaiki. Tahap sebelumnya tidak boleh dijalankan ulang jika artefaknya masih valid.

## Kebijakan biaya
Setiap tugas memiliki batas token, biaya, waktu, dan jumlah percobaan. Ketika batas tercapai, pekerjaan dijeda dan meminta keputusan manusia. Tidak boleh ada loop tanpa batas.