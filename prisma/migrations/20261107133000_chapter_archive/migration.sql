ALTER TABLE "Chapter" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "BookBriefRevision" (
  "id" TEXT PRIMARY KEY,
  "bookId" TEXT NOT NULL REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BookBriefRevision_bookId_createdAt_idx" ON "BookBriefRevision"("bookId", "createdAt");
