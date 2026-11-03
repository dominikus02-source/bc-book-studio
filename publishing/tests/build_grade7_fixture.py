"""Naskah uji kelas VII: sumber tunggal, tanpa klaim persetujuan manusia.

Jalankan: python -m publishing.tests.build_grade7_fixture /tmp/bc-grade7-source
Lalu render dengan Quarto di CI/staging terisolasi, BUKAN release_job.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from publishing.qmd_pipeline import canonical_bytes, digest, generate

TITLE = "Bahasa Indonesia untuk SMP — Dasar Literasi dan Keterampilan Berbahasa"
INTRO = """# Kata Pengantar

Buku latihan ini mengajak siswa kelas VII membaca, memahami, dan menulis dengan langkah bertahap. Semua cerita, tokoh, dan contoh pada buku ini adalah contoh rekaan untuk pembelajaran.

# Petunjuk Penggunaan

Baca tujuan tiap bab, amati contoh, kerjakan aktivitas bersama, kemudian jawab latihan secara mandiri. Gunakan pembahasan untuk menilai alasan jawaban, bukan sekadar menyalin hasil. Guru dapat menyesuaikan waktu dan tingkat kesulitan.

# Tujuan Pembelajaran Buku

Setelah mempelajari buku ini, siswa diharapkan mampu mengidentifikasi informasi dalam teks deskripsi dan narasi, menjelaskan unsur dan struktur teks, serta merencanakan, menulis, dan menyunting paragraf dengan memperhatikan pembaca.

# Identitas Edisi Uji

Penerbit: BC Book Studio — edisi pengujian teknis, belum untuk distribusi.
Penulis/editor: Tim Uji Internal BC Book Studio (identitas fiktif untuk pengujian).
"""

CHAPTERS = [
("Memahami Teks Deskripsi", "teks-deskripsi", """## Tujuan Pembelajaran
Siswa dapat mengenali tujuan, ciri, struktur, dan pilihan kata teks deskripsi; menemukan rincian yang didukung teks; serta menulis deskripsi singkat berdasarkan pengamatan.

## Pertanyaan Pemantik
Bagaimana menjelaskan ruang perpustakaan kepada teman yang belum pernah mengunjunginya? Detail apa yang membuat pembaca seolah berada di sana?

## Materi Inti
Teks deskripsi menggambarkan objek, tempat, atau suasana melalui rincian yang dapat diamati. Tujuannya membantu pembaca membayangkan objek secara lebih jelas. Penulis dapat memakai penglihatan, pendengaran, penciuman, atau sentuhan jika sesuai dengan objek dan situasi.

Ciri yang sering muncul ialah objek yang jelas, rincian khusus, kata sifat yang tepat, dan urutan pengamatan yang mudah diikuti. Struktur yang berguna untuk latihan adalah **identifikasi** (memperkenalkan objek), **deskripsi bagian** (menguraikan rincian), dan **kesan atau penutup** (merangkum pengalaman). Tidak semua teks harus memakai tiga bagian dengan judul terpisah.

Kaidah kebahasaan yang perlu diamati meliputi nomina khusus, kata sifat, frasa penunjuk tempat, serta kalimat yang menyatakan hasil pengamatan. Bandingkan kalimat 'Perpustakaan itu bagus' dengan 'Rak kayu berjajar di sisi kiri ruang dan meja baca berada dekat jendela'. Kalimat kedua lebih terukur karena memberi rincian yang dapat dibayangkan.

## Contoh Teks: Sudut Baca Sekolah
Di ujung koridor lantai satu terdapat sudut baca sekolah kami. Ruangannya kecil, tetapi tertata rapi.

Dua rak rendah berdiri di dekat dinding. Buku cerita ditempatkan pada rak atas, sedangkan ensiklopedia anak berada pada rak bawah. Di sebelah jendela ada tiga meja bundar. Cahaya pagi masuk melalui kaca dan menerangi permukaan meja. Pada jam istirahat, terdengar suara halaman buku dibalik perlahan.

Saya menyukai sudut baca itu karena suasananya tenang dan buku mudah ditemukan.

## Analisis Contoh
Paragraf pertama memperkenalkan objek dan lokasinya. Paragraf kedua menjelaskan tata letak, benda, cahaya, dan bunyi. Paragraf terakhir menyampaikan kesan penulis. Frasa 'di sebelah jendela' menunjukkan posisi, sedangkan 'rak rendah' memberi rincian ukuran.

## Aktivitas Pembelajaran
Berpasanganlah. Amati satu tempat yang diizinkan guru selama lima menit. Catat lima rincian yang benar-benar terlihat atau terdengar. Tukarkan catatan, lalu mintalah pasangan menggambar denah sederhana berdasarkan deskripsimu. Perbaiki kalimat yang belum jelas.

## Latihan Bertingkat
1. **Dasar:** Apa objek utama dalam contoh?
2. **Dasar:** Sebutkan dua benda beserta posisinya.
3. **Menengah:** Kalimat mana yang menunjukkan kesan penulis? Jelaskan alasannya.
4. **Menengah:** Ubah kalimat 'Kelas kami indah' menjadi dua kalimat deskriptif yang dapat diamati.
5. **Lanjutan:** Tulis satu paragraf 90–120 kata tentang tempat belajar. Gunakan identifikasi, tiga rincian indrawi yang benar, dan penutup.

## Pembahasan dan Pedoman Penilaian
1. Sudut baca sekolah.
2. Contoh jawaban: dua rak rendah di dekat dinding; tiga meja bundar di sebelah jendela.
3. 'Saya menyukai sudut baca itu karena suasananya tenang dan buku mudah ditemukan.' Kalimat itu menyampaikan penilaian pribadi penulis.
4. Jawaban bervariasi; nilai berdasarkan rincian nyata, misalnya 'Dua pot tanaman berada di dekat pintu. Jendela besar membuat ruang kelas terang pada pagi hari.'
5. Nilai empat aspek: objek dan urutan jelas; minimal tiga rincian relevan; pilihan kata tepat; ejaan dan tanda baca terbaca. Beri umpan balik per aspek, bukan hanya angka.

## Refleksi
Rincian apa yang paling membantu pembaca membayangkan tempat? Bagian mana dari deskripsimu masih terlalu umum?
"""),
("Memahami Teks Narasi", "teks-narasi", """## Tujuan Pembelajaran
Siswa dapat mengidentifikasi tokoh, penokohan, latar, alur, konflik, sudut pandang, serta menjelaskan hubungan tindakan tokoh dengan penyelesaian cerita.

## Pertanyaan Pemantik
Mengapa dua tokoh yang menghadapi masalah sama dapat mengambil keputusan berbeda?

## Materi Inti
Teks narasi menyajikan rangkaian peristiwa yang saling berkaitan. Dalam cerita rekaan, unsur pentingnya meliputi tokoh, latar tempat dan waktu, alur, konflik, dan sudut pandang. Penokohan adalah cara pembaca mengenali sifat tokoh melalui tindakan, ucapan, pikiran, atau penjelasan narator.

Untuk belajar menyusun cerita, kita dapat menggunakan orientasi (pengenalan tokoh dan situasi), komplikasi (munculnya masalah), dan resolusi (usaha atau hasil penyelesaian). Tidak semua cerita menyelesaikan masalah dengan sempurna. Alur dapat bergerak maju atau memuat kilas balik. Sudut pandang orang pertama biasanya memakai 'aku', sedangkan orang ketiga dapat memakai nama tokoh atau 'dia'.

## Contoh Narasi: Buku yang Tertinggal
Pagi itu Rani datang lebih awal ke perpustakaan sekolah. Ia hendak mengembalikan buku cerita yang dipinjam minggu lalu. Ketika membuka tas, ia baru sadar bahwa buku itu tertinggal di meja rumah.

Rani menatap jam dinding. Pelajaran pertama akan dimulai dua puluh menit lagi. Ia ingin meminta temannya mengantar buku tersebut, tetapi perjalanan dari rumah terlalu jauh. Rani lalu menemui petugas perpustakaan dan menjelaskan keadaan sebenarnya.

Petugas mendengarkan lalu menunjukkan aturan pengembalian. Rani boleh mengembalikan buku keesokan hari, tetapi perlu mencatat keterlambatan. Rani menerima konsekuensi itu. Sepulang sekolah, ia menaruh buku di dekat tas agar tidak lupa lagi.

Esok paginya Rani mengembalikan buku tersebut. Ia belajar bahwa mengakui kesalahan lebih membantu daripada membuat alasan.

## Analisis Contoh
Tokoh utama adalah Rani. Latar awal berada di perpustakaan sekolah pada pagi hari. Masalah muncul ketika buku tertinggal. Sifat bertanggung jawab tampak dari tindakan Rani menjelaskan keadaan dan menerima konsekuensi. Cerita memakai sudut pandang orang ketiga dan alur maju. Penyelesaian tidak menghapus keterlambatan, tetapi menunjukkan tindakan memperbaikinya.

## Aktivitas Pembelajaran
Buat peta cerita dengan empat kotak: tokoh dan latar, masalah, pilihan tindakan, akibat. Diskusikan pilihan lain yang mungkin diambil Rani beserta konsekuensinya. Bedakan fakta dalam teks dan dugaan pembaca.

## Latihan Bertingkat
1. **Dasar:** Siapa tokoh utama dan di mana peristiwa pertama terjadi?
2. **Dasar:** Apa masalah yang dihadapi tokoh?
3. **Menengah:** Sebutkan dua tindakan yang menunjukkan watak Rani.
4. **Menengah:** Mengapa cerita ini memakai sudut pandang orang ketiga?
5. **Lanjutan:** Tuliskan akhir alternatif 100–150 kata yang tetap masuk akal. Jelaskan bagaimana pilihan baru mengubah akibat cerita.

## Pembahasan dan Pedoman Penilaian
1. Rani; di perpustakaan sekolah.
2. Buku yang hendak dikembalikan tertinggal di rumah.
3. Menjelaskan keadaan kepada petugas dan menerima catatan keterlambatan.
4. Narator menyebut 'Rani' dan 'ia', bukan 'aku' sebagai tokoh pencerita.
5. Jawaban bervariasi. Periksa kesesuaian tokoh, hubungan sebab-akibat, urutan peristiwa, dan penyelesaian yang tidak bertentangan dengan situasi awal.

## Refleksi
Bagian mana yang membuat pembaca memahami sifat Rani? Apakah akhir cerita selalu harus menyenangkan?
"""),
("Menulis dan Menyunting", "menulis-menyunting", """## Tujuan Pembelajaran
Siswa dapat menentukan ide, menyusun kerangka, mengembangkan paragraf, memilih kata, memperbaiki ejaan, dan menyunting teks untuk pembaca tertentu.

## Pertanyaan Pemantik
Mengapa tulisan yang sudah selesai masih perlu dibaca ulang dan diperbaiki?

## Materi Inti
Menulis adalah proses. Mulailah dengan menentukan tujuan, pembaca, dan ide utama. Untuk tugas mendeskripsikan kegiatan sekolah, misalnya, tentukan apa yang ingin diketahui pembaca: tempat, urutan kegiatan, atau pengalaman peserta.

Kerangka membantu menjaga urutan gagasan. Susun ide pokok setiap paragraf dan rincian pendukungnya. Dalam satu paragraf, kalimat-kalimat sebaiknya membahas satu fokus yang jelas. Gunakan kata yang spesifik dan sesuai konteks; hindari pengulangan yang tidak diperlukan.

Saat menyunting, periksa apakah isi sesuai tujuan, urutan logis, kata mudah dipahami, dan ejaan konsisten. Perhatikan penggunaan huruf kapital pada awal kalimat dan nama diri, tanda titik pada akhir kalimat berita, serta koma bila diperlukan untuk memperjelas hubungan antarklausa. Untuk persoalan ejaan yang meragukan, periksa EYD Edisi V melalui sumber resmi.

## Contoh Proses Menulis
**Ide:** kegiatan merawat taman kelas.
**Tujuan:** memberi informasi kepada siswa lain.
**Kerangka:** alasan kegiatan; pembagian tugas; hasil pengamatan; pelajaran yang diperoleh.

**Draf awal:** 'kemarin kelas kami bersih bersih taman. semua bekerja. taman jadi bagus.'

**Hasil revisi:** 'Kemarin, siswa kelas VII membersihkan taman di depan kelas. Sebagian siswa mengumpulkan daun kering, sedangkan yang lain menyiram tanaman. Setelah kegiatan selesai, jalan setapak terlihat lebih rapi.'

Revisi menambah informasi tentang pelaku, lokasi, pembagian tugas, dan hasil. Perubahan tidak hanya memperbaiki kapitalisasi dan tanda baca.

## Aktivitas Pembelajaran
Tulis draf 120–160 kata tentang kegiatan belajar yang pernah kamu ikuti. Tandai kalimat utama, garis bawahi rincian pendukung, lalu minta pasangan menunjukkan satu bagian yang masih membingungkan. Revisi berdasarkan komentar yang dapat dijelaskan.

## Latihan Bertingkat
1. **Dasar:** Sebutkan tiga langkah proses menulis.
2. **Dasar:** Perbaiki kapitalisasi dan tanda baca: 'pada hari senin dina membaca buku di perpustakaan'
3. **Menengah:** Susun kerangka tiga paragraf bertema 'Menjaga Kebersihan Kelas'.
4. **Menengah:** Jelaskan dua alasan draf awal pada contoh perlu diperbaiki.
5. **Lanjutan:** Buat teks 180–220 kata dengan tujuan dan pembaca yang jelas. Lampirkan satu draf awal, revisi, serta catatan tiga perubahan penting.

## Pembahasan dan Pedoman Penilaian
1. Contoh: menentukan ide dan tujuan, menyusun kerangka, menulis draf, merevisi, dan menyunting. Tiga langkah yang benar sudah memenuhi soal.
2. 'Pada hari Senin, Dina membaca buku di perpustakaan.'
3. Contoh: paragraf 1 pentingnya kebersihan; paragraf 2 pembagian tugas; paragraf 3 hasil dan kebiasaan yang perlu dijaga. Kerangka lain dapat diterima jika runtut.
4. Draf awal kurang memberi rincian tentang siapa melakukan apa; penulisan huruf kapital, bentuk kata, dan tanda baca juga perlu diperbaiki.
5. Gunakan rubrik berikut; nilai proses dan produk, bukan panjang tulisan saja.

## Rubrik Penilaian Proyek
| Aspek | Baik | Perlu Bimbingan |
|---|---|---|
| Tujuan dan pembaca | Terlihat jelas dalam isi | Belum jelas |
| Organisasi | Paragraf runtut dengan rincian | Gagasan melompat |
| Pilihan kata | Tepat dan bervariasi | Banyak kata terlalu umum |
| Ejaan | Kesalahan kecil tidak mengganggu | Kesalahan mengganggu pemahaman |
| Revisi | Ada bukti perubahan bermakna | Tidak ada alasan revisi |

## Refleksi
Perubahan apa yang paling meningkatkan kejelasan tulisanmu? Bagaimana komentar pembaca membantu proses revisi?
""")
]

END = """# Glosarium
**Alur:** urutan peristiwa dalam cerita.
**Deskripsi:** penggambaran objek atau suasana melalui rincian.
**Draf:** bentuk awal tulisan yang masih dapat diperbaiki.
**Latar:** keterangan tempat, waktu, atau suasana dalam cerita.
**Narasi:** teks yang menyajikan rangkaian peristiwa.
**Penokohan:** cara sifat tokoh digambarkan.
**Revisi:** perbaikan isi dan organisasi tulisan.
**Sunting:** pemeriksaan dan perbaikan bahasa serta penyajian.

# Catatan Sumber dan Daftar Pustaka
Badan Pengembangan dan Pembinaan Bahasa. *Ejaan Bahasa Indonesia yang Disempurnakan Edisi V*. https://ejaan.kemdikbud.go.id/ (rujukan normatif ejaan; akses dan edisi perlu diperiksa ulang sebelum publikasi).

Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. *Capaian Pembelajaran Bahasa Indonesia Fase D*. Portal kurikulum resmi: https://kurikulum.kemdikbud.go.id/ (rujukan penyelarasan umum; kesesuaian butir capaian perlu ditinjau editor kurikulum).

Seluruh contoh narasi dan deskripsi dalam buku ini ditulis khusus sebagai contoh fiktif, bukan kutipan sumber luar.

# Indeks Istilah Sederhana
Alur — Bab 2; Deskripsi — Bab 1; Draf — Bab 3; Ejaan — Bab 3; Latar — Bab 2; Narasi — Bab 2; Penokohan — Bab 2; Revisi — Bab 3.
"""

def build(destination: Path) -> dict:
    chapters = [{"title": title, "slug": slug, "content": text} for title, slug, text in CHAPTERS]
    chapters[0]["content"] = INTRO + "\n\n" + chapters[0]["content"]
    chapters[-1]["content"] += "\n\n" + END
    snapshot = {
        "bookId": "kelas-vii-literasi-bahasa-indonesia",
        "approvalStatus": "draft",
        "metadata": {"title": TITLE, "author": "Tim Uji Internal BC Book Studio",
                     "lang": "id", "bookType": "nonfiction", "discipline": "general"},
        "orderedChapters": chapters,
        "targetFormats": ["html", "typst", "epub", "docx"],
        "assets": [],
    }
    snapshot["snapshotHash"] = digest(canonical_bytes(snapshot))
    manifest = generate(snapshot, destination, release=False)
    (destination / "fixture-source.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m publishing.tests.build_grade7_fixture OUTPUT_DIRECTORY")
    print(json.dumps(build(Path(sys.argv[1])), ensure_ascii=False, indent=2))
