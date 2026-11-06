# BC Book Studio – Quality QA Report
Tanggal: 6 November 2026 (WIB)

## Lingkungan
- Source QA VPS: /opt/bc-book-studio-runtime/releases/qa-quality-20261106
- Salinan dan tes PC: F:\bc-book-studio-quality-qa-20261106
- VPS: bc-prod-01
- Database uji: PostgreSQL 16 klon sementara dari backup 2026-11-06
- Produksi, routing publik, dan database produksi: tidak dimodifikasi

## Implementasi
1. Logout melalui POST /api/auth/logout sehingga sesi dibatalkan di server.
2. Chapter PATCH, DELETE, reorder, history lewat ChapterRevision.
3. UI autosave dengan debounce 1500 ms, indikator simpan/gagal, konfirmasi bila draf belum tersimpan.
4. Dark/light dashboard, sidebar mobile, kontras teks, dan pratinjau prompt yang dapat difokuskan.
5. Profil FICTION/NONFICTION dan genre; editorial checklist wajib berbeda sebelum submit.
6. Adapter Quarto/Pandoc untuk DOCX, EPUB, dan PDF melalui Typst (aktif hanya bila QUARTO_BIN dikonfigurasi).
7. Migrasi skema mencakup bookType, genre, editorialStage, editorialChecks, dan ChapterRevision.

## Bukti PASS
- npm run build (Windows QA): PASS, Next.js 15.5.29, Prisma 6.19.3, TypeScript.
- QA migration pada database klon: PASS.
- QA_E2E_PASS: 2 akun sintetis login, CRUD buku dan bab, reorder, revisi, isolasi pemilik, logout, cek editorial submit.
- AUTOSAVE_UI_QA_PASS: Chrome 390px, perubahan tersimpan dan 1 revisi.
- VISUAL_QA_SUMMARY: 12/12 kasus (320, 375, 390, 768, 1024, 1440 px × light/dark), 0 kegagalan axe-core WCAG A/AA, tanpa overflow.
- TAB_QA_SUMMARY: 52/52 kasus pada 13 modul × 390/1440 px × light/dark, 0 kegagalan.
- Quarto 1.10.20: contoh fiksi/nonfiksi × DOCX/EPUB/PDF, 6/6 render PASS, struktur file dan gambar dasar PASS.

## Belum PASS untuk produksi
- Ekspor API end-to-end dengan worker Quarto yang diisolasi dari jaringan dan dengan batas sumber daya.
- EPUBCheck resmi, validasi PDF/UA atau PDF/A, dan pemeriksaan tata letak cetak manual.
- Aset gambar dari upload pengguna ke pipeline Quarto dan lisensi aset.
- Browser lintas mesin/perangkat fisik serta seluruh alur aksesibilitas dengan pembaca layar.
- Merge GitHub dan deployment publik; tidak ada migrasi produksi yang dijalankan.
- Keamanan multi-reviewer lintas pemilik buku membutuhkan model penugasan reviewer sebelum diaktifkan sebagai fitur kolaborasi.

## Rilis aman
Backup terbaru → migrasi klon dan smoke test → build release image terisolasi → uji Quarto worker → review keamanan dan editorial → rilis bertahap → verifikasi API, sesi, CRUD dan rollback.
