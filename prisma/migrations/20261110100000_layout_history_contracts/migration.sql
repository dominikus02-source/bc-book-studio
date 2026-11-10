-- Additive only. Existing approvals, layouts and jobs are not rewritten.
ALTER TABLE "BookPagination" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ExportJob" ADD COLUMN "sourceApprovedAt" TIMESTAMP(3), ADD COLUMN "sourceLayoutVersion" INTEGER, ADD COLUMN "sourcePaginationVersion" INTEGER, ADD COLUMN "sourceSnapshotHash" TEXT;
CREATE TABLE "BookLayoutRevision" (
 "id" TEXT NOT NULL, "bookId" TEXT NOT NULL, "approvedAt" TIMESTAMP(3) NOT NULL, "version" INTEGER NOT NULL,
 "settings" JSONB NOT NULL, "archivedAt" TIMESTAMP(3), "actorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BookLayoutRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookLayoutRevision_version_positive" CHECK ("version" > 0),
 CONSTRAINT "BookLayoutRevision_approval_fkey" FOREIGN KEY ("bookId","approvedAt") REFERENCES "BookApprovalSnapshot"("bookId","approvedAt") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BookLayoutRevision_bookId_approvedAt_version_key" ON "BookLayoutRevision"("bookId","approvedAt","version");
CREATE TABLE "BookPaginationRevision" (
 "id" TEXT NOT NULL, "bookId" TEXT NOT NULL, "version" INTEGER NOT NULL, "settings" JSONB NOT NULL, "archivedAt" TIMESTAMP(3),
 "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BookPaginationRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookPaginationRevision_version_positive" CHECK ("version" > 0),
 CONSTRAINT "BookPaginationRevision_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BookPaginationRevision_bookId_version_key" ON "BookPaginationRevision"("bookId","version");
