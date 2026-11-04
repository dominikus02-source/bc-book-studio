# Tahap 1C.4.1 — Bukti Docker Persistence & Staging Recovery

**Status: BLOCKED sampai pengujian Docker nyata pada commit final selesai dan semua assertion terbukti lulus.**

## Baseline dan lingkungan
- Baseline pengguna: `56e07f874b6ed0c701dfdb6e03666eff0c3a8dd5`.
- PC pengembangan `DESKTOP-2NM1AUE`: `docker` dan `podman` tidak ditemukan; tidak ada Docker Desktop pada jalur standar yang diperiksa. Working tree salinan kerja terpisah pada branch benar, HEAD lokal masih `15cd88e`, bersih; perubahan berikutnya dipush langsung ke branch melalui GitHub.
- Jangan menjalankan uji pada host `bc-prod-01` atau database BahasaCerdas. Pengujian Docker dijadwalkan di GitHub Actions Ubuntu dengan proyek Compose unik `bc-studio-ci-<run_id>`, volume unik, dan secret sementara yang dibuat di runner.
- CI baseline sebelumnya membuktikan unit/integration test, **bukan** Docker Compose volume recreate.

## Diagram service dan volume

```text
frontend ──> backend ──> postgres ──> postgres_data:/var/lib/postgresql/data
                  └─────> redis ─────> redis_data:/data (AOF everysec)
worker (UID 10001) ────> redis
       └───────────────> studio_audit_data:/var/lib/bc-book-studio/audit (SQLite WAL)
audit-init (root, one-shot) ─> chown 10001:10001; chmod 0700
worker depends_on audit-init service_completed_successfully
```

## Konfigurasi audit
- `backend/Dockerfile`: `USER studio`, dibuat dengan UID 10001.
- `compose.staging.yml`: worker `STUDIO_AUDIT_DB=/var/lib/bc-book-studio/audit/audit.sqlite3`, mount named volume `studio_audit_data`, `audit-init` one-shot, Redis `--appendonly yes --appendfsync everysec`, PostgreSQL named volume `postgres_data`.
- Docker Compose belum pernah diuji secara langsung di PC ini; file konfigurasi dan tes string bukan bukti izin volume benar pada Docker runtime.

## Pengujian nyata yang ditambahkan
Workflow `.github/workflows/staging-docker-persistence.yml` menjalankan `backend/tests/staging_docker_recovery.sh` pada GitHub-hosted Ubuntu Docker engine. Script memuat timestamp, command dan exit status melalui `set -euo pipefail`, tanpa mencetak secret. Pengujian dirancang untuk:
1. `docker compose up -d --build --wait` seluruh stack staging nonproduksi.
2. Verifikasi UID 10001, ownership dan permission mode 0700, event SQLite, dan `PRAGMA integrity_check`.
3. Simpan marker Redis serta event outbox, dan baris PostgreSQL staging.
4. `stop`/ `rm`/ `up` container worker tanpa `down -v`; baca ulang event SQLite.
5. Recreate Redis dengan named volume sama; cek marker dan outbox masih ada.
6. Recreate PostgreSQL dengan named volume sama; cek baris tersimpan.
7. Rekonsiliasi outbox dua kali ke SQLite; cek event dan idempotensi.
8. Tampilkan `docker compose ps -a` pada akhir, tanpa membuka credential.

**Hasil per volume: menunggu eksekusi workflow dan bukti log.** Tes kontrol negatif dengan volume berbeda, SQLite sementara unavailable, worker restart saat job aktif, dan simulasi tanpa kehilangan hasil final **belum tercakup** oleh script ini. Tidak ada klaim 100% acceptance.

## Bukti CI
- Baseline sebelumnya: [Backend](https://github.com/dominikus02-source/bc-book-studio/actions/runs/41756308892) SUCCESS; tiga workflow pada commit terbaru harus diverifikasi ulang.
- Workflow baru: [Staging Docker persistence recovery](https://github.com/dominikus02-source/bc-book-studio/actions/workflows/staging-docker-persistence.yml) — status eksekusi harus dibaca dari run aktual.
- Tes konfigurasi `backend/tests/test_staging_persistence_contract.py` ada, tetapi tidak menggantikan uji Docker.

## Risiko dan keputusan
- Redis AOF everysec dapat kehilangan penulisan terakhir pada kegagalan host; tidak diklaim tahan power loss.
- SQLite WAL berada pada named volume khusus; backup dan restore terpisah masih wajib diuji berkala.
- Docker test tidak boleh menggunakan data, server, atau database produksi BahasaCerdas.
- Perlu menambahkan kontrol negatif dan pemulihan pekerjaan aktif sebelum menandai 11 acceptance gates PASS.

**Keputusan: BLOCKED sampai hasil workflow Docker nyata terverifikasi.**
