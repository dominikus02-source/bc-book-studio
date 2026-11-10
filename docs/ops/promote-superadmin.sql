-- Promosi terverifikasi: srphysics04@gmail.com dari EDITOR ke SUPERADMIN.
-- Jalankan hanya setelah identitas pemilik akun dikonfirmasi operator berwenang.
-- Tidak ada tabel audit role di skema aplikasi (CredentialAudit khusus kredensial
-- penyedia AI). Jejak audit dicatat lewat RAISE NOTICE dan harus disalin ke tiket
-- operasional (approver, operator, waktu Asia/Jakarta, alasan).
-- Sesi tidak menyimpan salinan role: lib/auth.ts membaca StudioUser.role setiap
-- permintaan. Penghapusan sesi tetap dilakukan agar pengguna masuk ulang setelah
-- kenaikan wewenang.
--
-- Prasyarat: backup pg_dump custom-format ke backups/manual/ terlebih dahulu.
-- psql: -v ON_ERROR_STOP=1
-- Rollback: docs/ops/rollback-superadmin.sql

BEGIN;

DO $$
DECLARE
  n integer;
  rec record;
  sessions_revoked integer;
BEGIN
  SELECT COUNT(*) INTO n
  FROM "StudioUser"
  WHERE lower(email) = 'srphysics04@gmail.com';

  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 StudioUser for srphysics04@gmail.com, found %', n;
  END IF;

  SELECT id, email, role, active
  INTO rec
  FROM "StudioUser"
  WHERE lower(email) = 'srphysics04@gmail.com'
  FOR UPDATE;

  IF rec.role <> 'EDITOR' THEN
    RAISE EXCEPTION 'Expected current role EDITOR, found % (id=%)', rec.role, rec.id;
  END IF;

  IF rec.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Expected an active account before promotion, found active=% (id=%)', rec.active, rec.id;
  END IF;

  UPDATE "StudioUser"
  SET role = 'SUPERADMIN', "updatedAt" = NOW()
  WHERE id = rec.id
    AND role = 'EDITOR'
    AND active = TRUE;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Promotion update failed; % rows changed', n;
  END IF;

  DELETE FROM "StudioSession" WHERE "userId" = rec.id;
  GET DIAGNOSTICS sessions_revoked = ROW_COUNT;

  RAISE NOTICE 'AUDIT role_change actor=operator email=% user_id=% old_role=EDITOR new_role=SUPERADMIN sessions_revoked=% at=%',
    rec.email, rec.id, sessions_revoked, (clock_timestamp() AT TIME ZONE 'Asia/Jakarta');
END
$$;

SELECT id, email, role, active, "updatedAt"
FROM "StudioUser"
WHERE lower(email) = 'srphysics04@gmail.com';

COMMIT;
