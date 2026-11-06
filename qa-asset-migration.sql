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
