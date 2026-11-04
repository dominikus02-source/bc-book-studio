# Keamanan

- API draf menolak permintaan tanpa token editor dengan perbandingan waktu konstan.
- Kunci AI hanya dibaca pada backend; tidak dimasukkan ke frontend.
- Permintaan draf divalidasi dengan Pydantic; timeout dan retry terbatas tersedia pada provider.
- Token bersama bukan RBAC. Belum ada akun pengguna, pemisahan penerbit/peninjau, audit identitas, rate limit, kontrol anggaran, maupun izin aset.
- Output AI adalah draf yang memerlukan pemeriksaan fakta, sumber, kurikulum, hak cipta, dan persetujuan manusia.
- Hindari log berisi prompt sensitif atau API key.
- Endpoint AI tidak boleh diekspos ke publik sebelum identitas, rate limit, kuota, dan monitoring selesai.
