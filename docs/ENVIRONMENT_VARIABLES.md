# Variabel lingkungan

Semua nilai berikut adalah nama variabel, **bukan kredensial**.

| Variabel | Tujuan |
|---|---|
| `STUDIO_API_KEY` | Token sementara untuk endpoint draf, minimal 24 karakter |
| `DEEPSEEK_API_KEY` | Kunci DeepSeek server-side |
| `DEEPSEEK_MODEL` | Nama model DeepSeek |
| `OPENAI_API_KEY` | Kunci penyedia cadangan OpenAI |
| `OPENAI_MODEL` | Model OpenAI |
| `GEMINI_API_KEY` | Kunci Gemini API kompatibel OpenAI |
| `GEMINI_MODEL` | Model Gemini |
| `DATABASE_URL` | URL PostgreSQL terisolasi, untuk tahap selanjutnya |
| `REDIS_URL` | URL Redis, untuk tahap selanjutnya |

Jangan kirim nilai rahasia melalui chat, commit, atau log. Konfigurasi Google Drive OAuth dan batas biaya belum diimplementasikan.
