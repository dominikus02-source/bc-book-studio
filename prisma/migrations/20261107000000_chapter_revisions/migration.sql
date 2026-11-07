BEGIN;

DO $$ BEGIN
  CREATE TYPE "RevisionSource" AS ENUM ('human', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "currentRevisionId" TEXT;

CREATE TABLE IF NOT EXISTS "Revision" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "blocks" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "authorId" TEXT,
  "source" "RevisionSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Revision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Revision_chapterId_fkey" FOREIGN KEY ("chapterId")
    REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Revision_chapterId_version_key" ON "Revision"("chapterId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_currentRevisionId_key" ON "Chapter"("currentRevisionId");

DO $$ BEGIN
  ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_currentRevisionId_fkey"
    FOREIGN KEY ("currentRevisionId") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Match the compact, sorted-key JSON used by hashBlocks.
WITH legacy AS (
  SELECT "id", "updatedAt", '[{"id":"c' || substr(md5("id"), 1, 24) ||
    '","text":' || to_json("content")::text || ',"type":"paragraph"}]' AS payload
  FROM "Chapter"
  WHERE "currentRevisionId" IS NULL
)
INSERT INTO "Revision" ("id", "chapterId", "version", "blocks", "contentHash", "source", "createdAt")
SELECT 'legacy-' || "id", "id", 1, payload::jsonb, encode(sha256(convert_to(payload, 'UTF8')), 'hex'), 'human', "updatedAt"
FROM legacy
ON CONFLICT ("chapterId", "version") DO NOTHING;

UPDATE "Chapter" AS chapter
SET "currentRevisionId" = revision."id"
FROM "Revision" AS revision
WHERE revision."chapterId" = chapter."id" AND revision."version" = 1
  AND chapter."currentRevisionId" IS NULL;

COMMIT;
