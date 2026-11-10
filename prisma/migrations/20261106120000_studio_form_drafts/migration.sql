CREATE TABLE "StudioFormDraft" (
 "id" TEXT NOT NULL,
 "ownerId" TEXT NOT NULL,
 "module" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "payload" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StudioFormDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudioFormDraft_ownerId_module_updatedAt_idx" ON "StudioFormDraft"("ownerId","module","updatedAt");
ALTER TABLE "StudioFormDraft" ADD CONSTRAINT "StudioFormDraft_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StudioUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
