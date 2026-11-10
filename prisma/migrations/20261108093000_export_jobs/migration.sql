CREATE TABLE "ExportJob" (
 "id" TEXT NOT NULL, "bookId" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED', "preview" BOOLEAN NOT NULL DEFAULT TRUE,
 "sizes" JSONB NOT NULL, "progress" INTEGER NOT NULL DEFAULT 0,
 "currentStep" TEXT NOT NULL DEFAULT 'Queued', "cancellationRequested" BOOLEAN NOT NULL DEFAULT FALSE,
 "leaseUntil" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0,
 "error" TEXT, "resultBytes" INTEGER, "resultSha256" TEXT,
 "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StudioUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ExportJob_ownerId_createdAt_idx" ON "ExportJob"("ownerId","createdAt");
CREATE INDEX "ExportJob_status_leaseUntil_idx" ON "ExportJob"("status","leaseUntil");
