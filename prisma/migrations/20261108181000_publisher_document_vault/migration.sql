-- Publisher document vault for official administrative evidence.
-- This creates a new table only; existing book and ISBN records are unchanged.
CREATE TABLE "PublisherDocument" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublisherDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublisherDocument_publisherId_kind_createdAt_idx" ON "PublisherDocument"("publisherId","kind","createdAt");
ALTER TABLE "PublisherDocument" ADD CONSTRAINT "PublisherDocument_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "PublisherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublisherDocument" ADD CONSTRAINT "PublisherDocument_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "StudioUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
