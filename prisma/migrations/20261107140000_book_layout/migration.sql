CREATE TABLE "BookLayout" (
  "bookId" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "settings" JSONB NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookLayout_pkey" PRIMARY KEY ("bookId","approvedAt"),
  CONSTRAINT "BookLayout_bookId_approvedAt_fkey" FOREIGN KEY ("bookId","approvedAt")
    REFERENCES "BookApprovalSnapshot"("bookId","approvedAt") ON DELETE RESTRICT ON UPDATE CASCADE
);
