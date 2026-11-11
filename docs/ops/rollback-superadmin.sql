-- Rollback promosi: srphysics04@gmail.com dari SUPERADMIN kembali ke EDITOR.
-- Hanya berhasil jika akun itu saat ini tepat satu baris ber-role SUPERADMIN.
-- Catat alasan rollback di tiket operasional. Backup dulu ke backups/manual/.
-- psql: -v ON_ERROR_STOP=1

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

  IF rec.role <> 'SUPERADMIN' THEN
    RAISE EXCEPTION 'Expected current role SUPERADMIN, found % (id=%)', rec.role, rec.id;
  END IF;

  UPDATE "StudioUser"
  SET role = 'EDITOR', "updatedAt" = NOW()
  WHERE id = rec.id
    AND role = 'SUPERADMIN';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Rollback update failed; % rows changed', n;
  END IF;

  DELETE FROM "StudioSession" WHERE "userId" = rec.id;
  GET DIAGNOSTICS sessions_revoked = ROW_COUNT;

  RAISE NOTICE 'AUDIT role_change actor=operator email=% user_id=% old_role=SUPERADMIN new_role=EDITOR sessions_revoked=% at=%',
    rec.email, rec.id, sessions_revoked, (clock_timestamp() AT TIME ZONE 'Asia/Jakarta');
END
$$;

SELECT id, email, role, active, "updatedAt"
FROM "StudioUser"
WHERE lower(email) = 'srphysics04@gmail.com';

COMMIT;
