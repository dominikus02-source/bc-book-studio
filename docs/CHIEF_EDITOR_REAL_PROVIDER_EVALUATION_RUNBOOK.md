# Panduan evaluasi Chief Editor dengan provider nyata (nonproduksi)

**Jangan memasukkan API key ke source, chat, log, atau artefak GitHub publik.**

## Konfigurasi
Runtime `backend/app/ai.py` mendukung:
- `deepseek`: `DEEPSEEK_API_KEY`, model default `deepseek-chat`.
- `openai`: `OPENAI_API_KEY`, model default `gpt-4.1-mini`.
- `gemini`: `GEMINI_API_KEY`, model default `gemini-2.5-flash`.

Model dapat diatur dengan `DEEPSEEK_MODEL`, `OPENAI_MODEL`, atau `GEMINI_MODEL`. DeepSeek adalah default. Provider memerlukan koneksi keluar, timeout 45 detik dan maksimum 2.500 output token per panggilan; `complete` dapat retry 3 kali pada error sementara. Budget evaluasi harus dibatasi pada lingkungan penyedia.

1. Gunakan environment staging yang terisolasi dan secret store/CI secrets dengan akses terbatas. **Jangan** menaruh kunci di GitHub Actions workflow YAML atau `.env` yang di-commit.
2. Validasi keberadaan secret sebagai boolean saja, bukan nilainya. Pastikan `STUDIO_API_KEY` untuk endpoint terautentikasi; `STUDIO_AUDIT_DB` menunjuk ke volume staging khusus proyek; `REDIS_URL` mengarah ke Redis nonproduksi.
3. Jalankan dua belas skenario dari `docs/MASTER_AGENT_TRAINING_EVALUATION.md` melalui jalur runtime `prepare_draft` → `complete` yang sama dengan API/worker, dan jalur API terautentikasi bila diperlukan. Jangan gunakan mock.
4. Untuk setiap skenario simpan input, kategori, hash dokumen, prompt/KB version, provider/model aktual, usage, durasi, respons asli dan status review. Simpan respons di storage privat dengan kontrol akses; jangan unggah sebagai artefak publik.
5. Editor manusia dan guru memberi penilaian terpisah; verifikasi sumber secara independen. Status tetap BELUM DISETUJUI hingga kedua review selesai.
6. Catat kegagalan provider tanpa nilai secret; jangan otomatis retry evaluasi tanpa mempertimbangkan batas biaya.

**Status saat panduan ditulis:** pada PC pengembangan, variabel `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` tidak tersedia. Tidak ada bukti 12 keluaran provider nyata atau persetujuan manusia.
