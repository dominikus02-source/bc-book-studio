# Operasi Docker staging

`compose.staging.yml` menyediakan frontend, backend, worker, PostgreSQL, Redis dan volume persisten. **Belum diuji startup**.

Siapkan file `.env.staging` di host secara privat dan `STUDIO_DB_PASSWORD` di shell/Compose environment. Jangan commit file tersebut. Atur `REDIS_URL=redis://redis:6379/0` dan `DATABASE_URL` yang mengarah ke `postgres` internal. Jalankan dari mesin staging terisolasi:

```sh
docker compose -f compose.staging.yml config
docker compose -f compose.staging.yml build
docker compose -f compose.staging.yml up -d postgres redis
docker compose -f compose.staging.yml exec -T postgres psql -U studio -d studio < infra/postgres/001_initial.sql
docker compose -f compose.staging.yml up -d
docker compose -f compose.staging.yml ps
```

Perintah SQL ini hanya untuk database staging baru. Belum ada migrasi terkelola; jangan jalankan ulang secara membabi buta pada data produksi. Worker belum durable. Frontend belum terhubung ke API. Lakukan health, tes DB/Redis, backup, dan rollback sebelum memakai data nyata.
