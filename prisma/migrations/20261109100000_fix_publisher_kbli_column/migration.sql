-- Normalize the publisher business-classification column name.
-- The initial migration used a mixed-case quoted identifier in some local copies.
-- This is safe for both fresh installs and databases that already have the canonical column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PublisherProfile'
      AND column_name = 'kbI'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PublisherProfile'
      AND column_name = 'kbli'
  ) THEN
    ALTER TABLE "PublisherProfile" RENAME COLUMN "kbI" TO "kbli";
  END IF;
END $$;
