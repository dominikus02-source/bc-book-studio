-- Append-only release evidence; old versions deliberately remain auditable.
CREATE TABLE "BookPublishingEvidence" (
  "id" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "layoutVersion" INTEGER NOT NULL,
  "referenceUrl" TEXT,
  "isbn" TEXT,
  "checksum" TEXT,
  "validator" TEXT,
  "validatorVersion" TEXT,
  "artifactBytes" INTEGER,
  "note" TEXT NOT NULL,
  "reviewedSubmissionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookPublishingEvidence_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BookPublishingEvidence"
  ADD CONSTRAINT "BookPublishingEvidence_bookId_fkey" FOREIGN KEY ("bookId")
  REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "BookPublishingEvidence_bookId_kind_approvedAt_layoutVersion_createdAt_idx"
  ON "BookPublishingEvidence"("bookId","kind","approvedAt","layoutVersion","createdAt");
CREATE INDEX "BookPublishingEvidence_bookId_createdAt_idx"
  ON "BookPublishingEvidence"("bookId","createdAt");
