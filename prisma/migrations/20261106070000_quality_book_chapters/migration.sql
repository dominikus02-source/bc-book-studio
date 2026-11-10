ALTER TABLE "Book" ADD COLUMN "bookType" TEXT NOT NULL DEFAULT 'NONFICTION';
ALTER TABLE "Book" ADD COLUMN "genre" TEXT NOT NULL DEFAULT 'REFERENCE';
ALTER TABLE "Book" ADD COLUMN "editorialStage" TEXT NOT NULL DEFAULT 'BRIEF';
CREATE TABLE "ChapterRevision" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "chapterId" TEXT NOT NULL REFERENCES "Chapter"("id") ON DELETE CASCADE,
 "title" TEXT NOT NULL,
 "content" TEXT NOT NULL,
 "revision" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ChapterRevision_chapterId_revision_key" ON "ChapterRevision" ("chapterId","revision");
ALTER TABLE "Book" ADD COLUMN "editorialChecks" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE "BookReviewer" (
  "id" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookReviewer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookReviewer_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookReviewer_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "StudioUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BookReviewer_bookId_reviewerId_key" ON "BookReviewer" ("bookId","reviewerId");
CREATE INDEX "BookReviewer_reviewerId_assignedAt_idx" ON "BookReviewer" ("reviewerId","assignedAt");
CREATE TABLE "BookAsset"(
  "id" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "altText" TEXT NOT NULL,
  "license" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookAsset_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BookAsset_bookId_createdAt_idx" ON "BookAsset" ("bookId","createdAt");
ALTER TABLE "Book" ADD COLUMN "pageSize" TEXT NOT NULL DEFAULT 'A4';
ALTER TABLE "Book" ADD COLUMN "author" TEXT NOT NULL DEFAULT 'BC Book Studio';
