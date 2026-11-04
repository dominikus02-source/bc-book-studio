# Laporan pengujian Tahap 3C.1

| Pemeriksaan | Bukti | Status |
|---|---|---|
| Render DOCX/PDF/EPUB | GitHub run 41745638354 | LULUS pada run lama |
| EPUBCheck | 0 fatal/error/warning/info, run 41745638354 | LULUS pada run lama |
| PDF A4, 25 halaman | pdfinfo run 41745638354 | LULUS pada run lama |
| Validasi EPUB lama | 11 bagian hilang, run 41745638354 | GAGAL |
| Pembacaan spine + itertext | Perubahan kode di cabang | BELUM DIVERIFIKASI CI |
| Tes bab hilang dan nested XHTML | Ditambahkan ke unittest workflow | BELUM DIVERIFIKASI CI |
| Pemeriksaan objek /Suspects | Belum ada artefak lokal | BELUM DIPERIKSA |
| Konsistensi paragraf lengkap | Belum diimplementasikan | BELUM LULUS |

**Status keseluruhan: BELUM LULUS** sampai CI terbaru dan investigasi PDF selesai.
