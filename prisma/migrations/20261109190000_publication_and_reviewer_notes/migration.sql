CREATE TABLE IF NOT EXISTS "BookPublication" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unpublishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "BookPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewerNote" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "chapterId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'CONTENT',
    "severity" TEXT NOT NULL DEFAULT 'SUGGESTION',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookPublication_bookId_key" ON "BookPublication"("bookId");

CREATE INDEX IF NOT EXISTS "BookPublication_unpublishedAt_publishedAt_idx" ON "BookPublication"("unpublishedAt", "publishedAt");

CREATE INDEX IF NOT EXISTS "ReviewerNote_bookId_reviewerId_createdAt_idx" ON "ReviewerNote"("bookId", "reviewerId", "createdAt");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookPublication_bookId_fkey' AND conrelid = '"BookPublication"'::regclass) THEN ALTER TABLE "BookPublication" ADD CONSTRAINT "BookPublication_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReviewerNote_bookId_fkey' AND conrelid = '"ReviewerNote"'::regclass) THEN ALTER TABLE "ReviewerNote" ADD CONSTRAINT "ReviewerNote_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;