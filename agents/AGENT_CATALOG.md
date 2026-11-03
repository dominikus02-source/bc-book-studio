# Katalog Agen Inti BC Book Studio

Status dokumen: rancangan awal, belum dieksekusi oleh layanan backend.

## Prinsip arsitektur

BC Book Studio menggunakan arsitektur multi-agen hibrida. Sebelas agen adalah peran logis yang dipanggil oleh orkestrator sesuai tahap, bukan sebelas proses permanen. Profil jenjang kelas dan spesialisasi ilmu merupakan dimensi terpisah dari identitas agen.

Setiap agen menerima konteks proyek yang relevan, keluaran tahap sebelumnya, batasan biaya, serta kebijakan keamanan. Setiap hasil harus dapat ditinjau, diberi versi, dan ditelusuri.

## 11 peran inti

| ID | Agen | Tanggung jawab utama | Keluaran utama |
|---|---|---|---|
| chief_editor | Pemimpin Redaksi | Mengatur rencana, pembagian tugas, risiko, dan gerbang persetujuan | Rencana produksi dan keputusan alur |
| research | Riset dan Referensi | Meneliti kebutuhan pembaca, sumber, fakta, dan celah materi | Ringkasan riset dan daftar sumber |
| curriculum | Kurikulum | Memetakan kerangka, capaian, tujuan, urutan, dan cakupan | Peta kurikulum dan matriks keselarasan |
| author | Penulis | Menyusun materi, bab, contoh, dan aktivitas | Naskah terstruktur |
| exercise | Latihan dan Asesmen | Menyusun soal, kunci, pembahasan, dan rubrik | Paket latihan tervalidasi |
| visual | Ilustrasi dan Visual | Membuat arahan visual, diagram, dan aset pembelajaran | Brief visual dan metadata aset |
| editorial | Penyunting Bahasa | Memeriksa ejaan, tanda baca, sintaksis, istilah, dan keterbacaan | Catatan suntingan dan naskah revisi |
| pedagogy | Penelaah Pedagogis | Menilai kesesuaian usia, tujuan, contoh, aktivitas, dan asesmen | Laporan telaah pedagogis |
| qa | Penjamin Mutu | Memeriksa kelengkapan, konsistensi, sumber, duplikasi, dan gerbang mutu | Laporan mutu dan daftar temuan |
| layout | Tata Letak | Menyiapkan struktur halaman, tipografi, komponen, dan keluaran | Paket tata letak |
| publisher | Penerbit | Memvalidasi metadata, persetujuan, format, dan arsip penerbitan | Paket terbit dan rekam arsip |

## Spesialisasi keilmuan

1. Linguistik
2. Tata bahasa dan ortografi
3. Sastra
4. Literasi
5. Retorika dan komunikasi
6. Genre dan keterampilan menulis
7. Asesmen
8. Literasi digital

Spesialisasi dipasang sebagai kemampuan lintas agen. Contoh: agen Penulis dapat meminta spesialis Sastra, sedangkan agen Latihan dan Asesmen dapat meminta spesialis Asesmen.

## Profil jenjang

Dua belas profil kelas (kelas 1 sampai 12) menjadi konfigurasi terpisah. Setiap profil minimal mengatur kosakata, panjang kalimat, kompleksitas bacaan, tingkat abstraksi, beban instruksi, bentuk aktivitas, dukungan visual, dan tuntutan berpikir.

Nilai batas dan rubrik setiap kelas wajib ditelaah ahli pendidikan sebelum dipakai untuk produksi nyata.

## Memori

- Memori pengetahuan global: sumber terverifikasi, pedoman bahasa, referensi umum.
- Memori proyek: keputusan, profil pembaca, struktur, sumber, dan riwayat buku tertentu.
- Memori kerja: konteks tugas aktif yang dapat dibuang setelah tugas selesai.

## Aturan keselamatan dan mutu

- Tidak mengarang kutipan, fakta, referensi, ISBN, atau klaim persetujuan pemerintah.
- Tidak menerbitkan tanpa persetujuan manusia yang berwenang.
- Tidak menghapus permanen naskah atau sumber.
- Tidak mengubah substansi secara diam-diam saat menyunting.
- Semua hasil diberi identitas agen, versi instruksi, model, waktu, dan status peninjauan.
- Kegagalan harus terisolasi pada tahap terkait dan tidak boleh memulai ulang seluruh buku tanpa alasan.
- Setiap pemanggilan model wajib tunduk pada batas biaya dan kebijakan data proyek.

## Alur umum

Riset → Kurikulum → Rencana Buku → Penulisan → Latihan → Visual → Penyuntingan → Telaah Pedagogis → Penjaminan Mutu → Tata Letak → Persetujuan Manusia → Penerbitan.

Tahap dapat bercabang atau berulang jika ditemukan temuan, tetapi setiap perpindahan harus tercatat dan dapat diaudit.

## Spesialis format Quarto/QMD

Katalog 11 agen inti tetap berlaku. `qmd-book-agent` adalah playbook spesialis lintas `layout`, `qa`, dan `publisher`, **bukan agen permanen tambahan**. Semua hasil mengikuti kontrak agen inti, batas biaya, dan approval manusia. Baca [playbook QMD](skills/qmd-book-agent.md) dan [integrasi QMD](../docs/QMD_AGENT_INTEGRATION.md). Fitur worker/rendering masih target implementasi, bukan kapabilitas yang telah teruji.
