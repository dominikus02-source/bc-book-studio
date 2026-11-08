CREATE TABLE "BookPagination" (
    "bookId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookPagination_pkey" PRIMARY KEY ("bookId")
);
ALTER TABLE "BookPagination" ADD CONSTRAINT "BookPagination_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
