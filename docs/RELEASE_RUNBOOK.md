# Runbook rilis produksi BC Book Studio

Jalur resmi setelah job migrasi terpisah ditambahkan: GitHub Actions membangun image, meminta persetujuan environment `production`, menerapkan migrasi dengan backup, lalu menukar container web. Jangan menaruh secret, kunci SSH, atau nilai AUD di Git.

Dokumentasi awal di `docs/DEPLOYMENT.md` merujuk ke runbook ini untuk rilis produksi.

## Prasyarat satu kali (perlu dilakukan operator berwenang)

1. Di repositori GitHub, buat environment bernama `production` dan wajibkan reviewer (required reviewers) sebelum job migrasi dan deploy berjalan.
2. Tambahkan secret environment/repositori berikut (nama saja; isi hanya di pengaturan GitHub, tidak di chat atau commit):
   - `BC_BOOK_STUDIO_DEPLOY_HOST`
   - `BC_BOOK_STUDIO_DEPLOY_USER`
   - `BC_BOOK_STUDIO_DEPLOY_SSH_KEY`
   - `BC_BOOK_STUDIO_DEPLOY_KNOWN_HOSTS`
   - `BC_BOOK_STUDIO_EXPECTED_AUD` (AUD aplikasi Cloudflare Access produksi; dipakai `scripts/deploy-release.sh`)
3. Set Actions variable `BC_BOOK_STUDIO_AUTO_DEPLOY` ke `true`. Selama variable ini belum `true`, job migrasi dan deploy tidak berjalan.
4. Pastikan VPS sudah memiliki direktori runtime terisolasi `/opt/bc-book-studio-runtime` berisi `compose.yml`, `compose.release.yml`, `.env` server, Docker Compose, dan akses tarik image GHCR. File `compose.edge.yml` bersifat opsional.

`workflow_dispatch` hanya membangun dan mem-publish image. Deploy otomatis hanya dipicu oleh **push ke `main`** setelah variable di atas aktif.

## Alur otomatis

1. Merge atau push ke `main`.
2. Workflow [Release candidate](../.github/workflows/release-candidate.yml) menjalankan `verify`, lalu membangun dan mem-publish image. Digest web dan migrator diambil dari output job `image` pada run yang sama; digest tidak di-hardcode di workflow.
3. Job `Migrate production database` menunggu persetujuan environment `production`, menyalin `scripts/migrate-release.sh` ke VPS, lalu menjalankan `--check` kemudian `--apply` (backup `pg_dump -Fc`, `migrate deploy`, `migrate status` harus sukses).
4. Job `Deploy verified images to VPS` membutuhkan `image` dan `migrate`, menunggu persetujuan `production` (jika dikonfigurasi per job), lalu menjalankan `scripts/deploy-release.sh --check` dan `--apply`. Guard yang sudah ada tidak dilemahkan: digest `@sha256:`, label revisi OCI, `migrate status` yang gagal jika masih ada pending, dan cek Access AUD tetap berlaku. Pending migrasi akan memblokir pergantian container web.
5. Concurrency group `bc-book-studio-production` (`cancel-in-progress: false`) mencegah dua rilis produksi saling menimpa.

Setelah merge, commit hasil merge mendapat build dan digest sendiri. Pipeline memakai digest itu secara otomatis.

## Perintah manual (fallback)

Jalankan dari `/opt/bc-book-studio-runtime` sebagai operator VPS yang berwenang. Ganti digest dan SHA dengan output job `image` pada run yang akan dirilis, bukan nilai lama dari commit lain.

```bash
cd /opt/bc-book-studio-runtime
export BC_BOOK_STUDIO_IMAGE='ghcr.io/dominikus02-source/bc-book-studio@sha256:<64-hex-dari-job-image>'
export BC_BOOK_STUDIO_MIGRATOR_IMAGE='ghcr.io/dominikus02-source/bc-book-studio-migrator@sha256:<64-hex-dari-job-image>'
export BC_BOOK_STUDIO_VERIFIED_SHA='<40-hex-commit-yang-diverifikasi>'
export BC_BOOK_STUDIO_EXPECTED_AUD='<AUD Access produksi>'

bash scripts/migrate-release.sh --check
bash scripts/migrate-release.sh --apply
bash scripts/deploy-release.sh --check
bash scripts/deploy-release.sh --apply
```

`--check` pada `migrate-release.sh` boleh menampilkan migrasi pending dan tetap keluar 0; skrip itu tidak membuat backup atau mengubah skema sampai `--apply`. `--check` pada `deploy-release.sh` tetap gagal jika masih ada migrasi pending.

## Rollback

- Rollback container web dilakukan oleh `scripts/deploy-release.sh` jika health check gagal; skema database **tidak** dikembalikan oleh skrip itu.
- Rollback database: pulihkan dump custom-format yang dicatat `migrate-release.sh` (`backups/release/<stamp>.pre-migrate.dump`) ke database `bookstudio` selama jendela pemeliharaan, misalnya dengan `pg_restore`, lalu periksa `migrate status` dan kesehatan aplikasi. Jangan menyunting tabel `_prisma_migrations` secara manual.
- Setelah rollback web atau database, konfirmasi sesi pengguna nyata sebelum mengumumkan rilis.

## Promosi SUPERADMIN untuk akun EDITOR yang sudah ada

`scripts/provision-superadmin.cjs` menolak akun yang sudah ada dengan role berbeda. API Superadmin juga tidak mempromosikan ke `SUPERADMIN`. Perubahan role akun EDITOR yang sudah aktif hanya boleh dilakukan operator berwenang setelah verifikasi identitas, dengan transaksi SQL yang diaudit. Contoh (ganti email hanya setelah identitas dikonfirmasi):

```sql
-- 1. Periksa baris yang akan diubah (harus tepat satu, role EDITOR, aktif).
SELECT id, email, role, active, "updatedAt"
FROM "StudioUser"
WHERE email = 'srphysics04@gmail.com';

-- 2. Terapkan hanya jika pemeriksaan di atas sesuai.
BEGIN;
UPDATE "StudioUser"
SET role = 'SUPERADMIN', "updatedAt" = NOW()
WHERE email = 'srphysics04@gmail.com'
  AND role = 'EDITOR'
  AND active = TRUE
RETURNING id, email, role, active, "updatedAt";
-- Pastikan RETURNING tepat 1 baris. Jika 0 baris, ROLLBACK.
COMMIT;
```

Catat approver, operator, waktu (zona Asia/Jakarta), dan alasan di tiket/log operasional. Pengguna harus keluar dan masuk kembali agar sesi merespons role baru. Jangan menaruh kredensial database di Git atau di pesan chat.
