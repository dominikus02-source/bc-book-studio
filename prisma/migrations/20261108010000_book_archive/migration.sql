ALTER TABLE "Book" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Book_ownerId_archivedAt_idx" ON "Book"("ownerId", "archivedAt");
