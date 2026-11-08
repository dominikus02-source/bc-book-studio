CREATE TABLE "BookApprovalSnapshot" (
  "bookId" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "manuscript" JSONB NOT NULL,
  CONSTRAINT "BookApprovalSnapshot_pkey" PRIMARY KEY ("bookId", "approvedAt"),
  CONSTRAINT "BookApprovalSnapshot_bookId_fkey" FOREIGN KEY ("bookId")
    REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
