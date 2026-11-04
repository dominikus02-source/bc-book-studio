# Keputusan arsitektur tahap 2

1. **Frontend**: pertahankan Next.js App Router dan TypeScript strict di cabang frontend.
2. **API**: gunakan FastAPI sebagai layanan backend berversi, bukan menghapus kode Next.js pada main secara prematur.
3. **Database**: PostgreSQL mandiri. Skema SQL aditif di `infra/postgres/001_initial.sql` adalah rancangan awal, bukan migrasi yang telah diuji. Pilih alat migrasi final setelah uji staging; jangan menjalankan Prisma dan SQLAlchemy terhadap tabel yang sama tanpa kontrak.
4. **AI**: DeepSeek default, OpenAI dan Gemini alternatif. Belum ada kontrol biaya atau fallback otomatis; jangan mengaktifkan produksi.
5. **Antrean**: Redis dan worker awal tersedia sebagai fondasi; Redis list + hasil hash belum memenuhi durability, retry/idempotensi, dan pemulihan restart yang diminta. Berikutnya implementasikan DB-backed state machine dan transaksi outbox.
6. **Deploy**: staging Compose terisolasi, tidak diarahkan ke VPS BahasaCerdas. Semua secret dari file server lokal.
7. **Persetujuan**: manusia wajib menyetujui sebelum publikasi. Token editor sementara tidak memenuhi RBAC produksi.
