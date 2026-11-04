ALTER TABLE "Book" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT 'legacy-unassigned';
ALTER TABLE "Book" ALTER COLUMN "ownerId" DROP DEFAULT;
CREATE INDEX "Book_ownerId_updatedAt_idx" ON "Book"("ownerId", "updatedAt");
