# Kebijakan Operasional Agen AI

## Pemilihan model
Model dipilih melalui gerbang penyedia berdasarkan kemampuan tugas, biaya, latensi, privasi, dan ketersediaan. Nama model dan harga harus berasal dari konfigurasi yang dapat diperbarui; jangan menanam harga tetap ke dalam instruksi agen.

## Ketentuan data
- Kunci API hanya berada di lingkungan server.
- Data proyek tidak boleh digunakan untuk pelatihan model tanpa persetujuan dan dasar kontraktual yang sesuai.
- Kirim konteks minimum yang diperlukan.
- Rahasia, kredensial, dan data pribadi yang tidak diperlukan harus disamarkan.

## Fallback
Fallback hanya dilakukan ke model yang lulus uji kompatibilitas untuk tugas tersebut. Catat model gagal, alasan, model pengganti, biaya, dan perubahan kualitas. Jangan mengulang permintaan yang berpotensi menggandakan tindakan tanpa idempotency key.

## Kualitas
Keluaran AI berstatus draf sampai melewati pemeriksaan yang relevan. Skor otomatis bukan pengganti validasi ahli. Temuan kritis memblokir alur.

## Audit
Simpan identitas proyek, agen, versi instruksi, model, waktu, penggunaan token, biaya, input/output hash, keputusan editor, dan status tahapan. Batasi akses sesuai peran.

## Tindakan terlarang
Agen tidak boleh menerbitkan sendiri, menghapus permanen, mengubah konfigurasi produksi, mengakses rahasia, mengarang sumber, mengklaim ISBN yang belum ada, atau menyatakan persetujuan resmi tanpa bukti.