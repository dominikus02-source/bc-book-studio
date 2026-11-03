# Matriks Penugasan Agen

Status: rancangan untuk backend. Matriks ini menjadi aturan awal, bukan eksekusi agen aktif.

| Tahap | Agen utama | Agen pendukung | Spesialisasi yang lazim |
|---|---|---|---|
| Riset kebutuhan | Riset dan Referensi | Pemimpin Redaksi | Literasi, sastra, literasi digital |
| Pemetaan kurikulum | Kurikulum | Riset dan Referensi, Penelaah Pedagogis | Asesmen, literasi |
| Perencanaan buku | Pemimpin Redaksi | Kurikulum, Penulis | Sesuai kategori buku |
| Penulisan | Penulis | Riset dan Referensi, Penyunting Bahasa | Linguistik, sastra, genre dan keterampilan menulis |
| Latihan | Latihan dan Asesmen | Kurikulum, Penelaah Pedagogis | Asesmen, tata bahasa dan ortografi |
| Visual | Ilustrasi dan Visual | Penulis, Penelaah Pedagogis | Literasi, literasi digital |
| Penyuntingan | Penyunting Bahasa | Riset dan Referensi | Linguistik, tata bahasa dan ortografi |
| Telaah pedagogis | Penelaah Pedagogis | Kurikulum, Latihan dan Asesmen | Asesmen, literasi |
| QA | Penjamin Mutu | Semua agen terkait | Semua yang relevan |
| Tata letak | Tata Letak | Penulis, Ilustrasi dan Visual | Literasi digital |
| Penerbitan | Penerbit | Pemimpin Redaksi, Penjamin Mutu | Sesuai kategori buku |

## Aturan pemilihan
1. Pilih agen utama berdasarkan tahap; agen pendukung hanya dipanggil jika kebutuhan eksplisit.
2. Cocokkan spesialisasi dengan topik dan jenis keluaran, bukan hanya jenjang.
3. Terapkan profil kelas sebagai konteks terpisah dari identitas agen.
4. Hitung risiko, batas biaya, ketersediaan model, dan kebutuhan sumber sebelum dispatch.
5. Jika tugas berdampak pada hak cipta, keselamatan anak, kurikulum, atau klaim faktual berisiko tinggi, wajibkan peninjauan manusia.
6. Catat alasan pemilihan dan versi matriks untuk setiap run.

## Batas concurrency awal
Pada VPS 4 vCPU / 8 GB RAM, mulai dengan 1 pekerjaan produksi aktif, maksimum 2 setelah uji beban dan pemantauan memori. Agen adalah peran logis, bukan 11 proses permanen.

## Routing spesialis QMD (rencana, bukan agen inti ke-12)

- Pada tahap **Tata letak**, `layout` dapat meminta spesialis `qmd-book-agent` untuk proyek Quarto, templat, render pratinjau DRAFT; hasil masuk `qa`.
- Pada tahap **QA**, `qa` memanggil spesialis yang sama untuk pemeriksaan silang referensi, aksesibilitas, validator format dan manifest; QA tetap memutuskan kualitas.
- Pada tahap **Penerbitan**, `publisher` memakai spesialis QMD **setelah gerbang approval manusia G9** untuk paket final terverifikasi. Tidak ada hak approval, publish mandiri, atau akses database produksi.
- Tidak menambah nilai `logicalAgentCount`, proses permanen, atau scope agen lain. Seluruh detail handoff di [QMD agent integration](../docs/QMD_AGENT_INTEGRATION.md).
