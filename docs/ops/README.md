# Operasi Superadmin dan data demo

File di folder ini **tidak dijalankan otomatis**. Operator berwenang menjalankannya di VPS setelah konfirmasi, backup, dan (untuk RBAC baru) merge plus deploy image yang memuat perubahan ini.

Jangan menaruh secret, isi `.env`, atau kunci SSH di Git atau di log perintah.

## 1. Backup manual

Dari `/opt/bc-book-studio-runtime/source` sebagai operator VPS:

```bash
cd /opt/bc-book-studio-runtime/source
mkdir -p backups/manual
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -p bc-book-studio-runtime -f compose.yml -f compose.resources.yml -f compose.release.yml   exec -T db pg_dump -U bookstudio -d bookstudio -Fc   > "backups/manual/${STAMP}.pre-superadmin-demo.dump"
```

Jika `compose.edge.yml` ada di runtime, sisipkan `-f compose.edge.yml` sebelum `compose.resources.yml`, sama seperti `scripts/migrate-release.sh`. Periksa ukuran dump dan bahwa berkas bukan kosong sebelum lanjut.

## 2. Promosi role `srphysics04@gmail.com` EDITOR → SUPERADMIN

Salin `docs/ops/promote-superadmin.sql` ke runtime (setelah PR ini ada di checkout/deploy, atau salin berkasnya secara manual), lalu:

```bash
cd /opt/bc-book-studio-runtime/source
docker compose -p bc-book-studio-runtime -f compose.yml -f compose.resources.yml -f compose.release.yml   exec -T db psql -U bookstudio -d bookstudio -v ON_ERROR_STOP=1   < docs/ops/promote-superadmin.sql
```

Transaksi ini mengunci baris, menolak jika bukan tepat satu akun aktif ber-role `EDITOR`, mempromosikan ke `SUPERADMIN`, menghapus sesi akun itu, dan mencatat jejak lewat `RAISE NOTICE` (skema tidak memiliki tabel audit role). Salin NOTICE, waktu Asia/Jakarta, approver, dan alasan ke tiket operasional.

SQL menghapus sesi agar pengguna masuk ulang. `lib/auth.ts` sebenarnya membaca `StudioUser.role` setiap permintaan, jadi role baru sudah berlaku pada sesi lama; penghapusan sesi tetap disarankan setelah kenaikan wewenang.

Rollback (hanya jika role saat ini `SUPERADMIN`):

```bash
docker compose -p bc-book-studio-runtime -f compose.yml -f compose.resources.yml -f compose.release.yml   exec -T db psql -U bookstudio -d bookstudio -v ON_ERROR_STOP=1   < docs/ops/rollback-superadmin.sql
```

`scripts/provision-superadmin.cjs` dan API `/api/admin/users` tidak mempromosikan akun yang sudah ada ke `SUPERADMIN`. Jangan gunakan keduanya untuk langkah ini.

## 3. Seed tiga buku draf `[DEMO]`

`scripts/seed-demo.cjs` default-nya `--dry-run` (hanya mencetak rencana). `--apply` dan `--remove` memerlukan `DEMO_SEED_CONFIRM=srphysics04@gmail.com`. Skrip mencari pemilik lewat email itu; gagal jika akun belum ada. Semua buku berstatus `DRAFT`, tanpa publikasi.

Image web produksi adalah Next.js standalone dan **tidak memuat** `scripts/`. Image migrator juga tidak memuat skrip ini (ENTRYPOINT Prisma). Sampai image hasil merge PR ini ada di VPS dan skrip disalin ke runtime, jalankan lewat container Node yang memakai client Prisma dari image migrator, dengan skrip dan `DATABASE_URL` dipasang dari `.env` runtime (jangan mencetak nilainya):

```bash
cd /opt/bc-book-studio-runtime/source
# 1) Dry-run (wajib sebelum apply)
docker compose -p bc-book-studio-runtime -f compose.yml -f compose.resources.yml -f compose.release.yml   run --rm --no-deps --entrypoint node   -v "$PWD/scripts/seed-demo.cjs:/app/scripts/seed-demo.cjs:ro"   --env-file .env   migrate scripts/seed-demo.cjs --dry-run

# 2) Apply setelah rencana benar
docker compose -p bc-book-studio-runtime -f compose.yml -f compose.resources.yml -f compose.release.yml   run --rm --no-deps --entrypoint node   -v "$PWD/scripts/seed-demo.cjs:/app/scripts/seed-demo.cjs:ro"   --env-file .env   -e DEMO_SEED_CONFIRM=srphysics04@gmail.com   migrate scripts/seed-demo.cjs --apply
```

`--remove` memakai perintah yang sama dengan `--remove` sebagai ganti `--apply`, dan hanya menghapus baris bertanda `[DEMO]` plus marker `bc-book-studio-demo-20261111`. Jika buku demo sudah diubah menjadi APPROVED atau punya bukti ISBN/penerbitan (FK restrict), penghapusan akan gagal — itu disengaja.

Setelah image rilis yang memuat `scripts/seed-demo.cjs` di-build, berkas tetap perlu di-mount atau disalin ke container, karena image web/migrator resmi tidak menyalin folder `scripts/` ke runtime web.
