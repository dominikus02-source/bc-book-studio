
## 2026-11-08 — Prompt AI kontekstual multi-alternatif Stage 1–3

Permintaan: Setiap tahap mempertahankan isian manual, template XLSX, unduh Markdown, upload; tambahkan tombol prompt AI yang berbeda sesuai tujuan isian dan konteks buku.

Implementasi lokal:
- lib/ai-prompt-presets.ts menghasilkan prompt berdasarkan field_id, label, opsi enum, batas karakter, nilai input saat ini, dan konteks pengguna.
- components/form-transfer.tsx menambahkan panel tertutup secara default: Lengkapi isian, Perbaiki EYD dan gaya, Periksa koherensi, Tingkatkan keterbacaan, serta satu tombol Bantu untuk setiap isian. Pilihan memperlihatkan teks lengkap untuk salin, tanpa memanggil AI/menulis database otomatis. Form manual, impor XLSX/Markdown dan konfirmasi Simpan tetap utama.
- Stage 1 metadata dan brief dipakai sebagai konteks Stage 2 kerangka dan subbagian, serta Stage 3 naskah melalui bookContext. Genre, pembaca sasaran dan tujuan buku memengaruhi prompt; penulis tetap menilai kualitas dan akurasi hasil.
- components/bulk-outline-manager.tsx menambahkan empat prompt alternatif untuk tabel multi-bab: melengkapi konten, koherensi, EYD, dan keterbacaan; prompt menyertakan baris aktif dan brief Stage 1. Hasil output tetap harus memakai tujuh kolom dan 2 paragraf per subbagian.
- app/globals.css menata tombol prompt dalam panel ringkas yang tetap responsif dan baik pada light/dark mode.
- Prompt wajib mengembalikan Markdown dengan heading field_id asli untuk dapat diunggah kembali; dilarang mengarang sumber/ISBN dan enum harus sesuai opsi. Data pengguna tidak dikirim ke layanan AI oleh aplikasi. Prompt panjang dipotong pada 6500 karakter per isian dengan pemberitahuan untuk melampirkan template asli.

QA:
- tests/stage123-ai-prompts-e2e.cjs PASS (metadata Stage1, kerangka dan subbagian Stage2, prompt naskah Stage3, dan MD/XLSX Stage1/2).
- tests/bulk25-ui-e2e.cjs PASS (pilihan prompt bulk, XLSX/MD, upsert 25 baris, arsip/pemulihan, 12 ukuran/theme).
- npm run typecheck PASS.
- Next.js build terisolasi diperbarui untuk rilis akhir (lihat hasil build terakhir).
- Catatan HOLD: tests/stage123-transfer-e2e.cjs menampilkan kegagalan pemeriksaan ulang penulisan Stage 3 ke baris database yang sama walaupun browser API pernah tampak berhasil. Ini isu integrasi yang belum lolos sign-off dan tidak boleh diklaim PASS.
- Semua perubahan masih di branch integration/unified-book-workflow-20261107 dengan worktree lama berisi perubahan lain. Tidak ada commit/push/merge/deploy produksi; QA DB lokal saja.
