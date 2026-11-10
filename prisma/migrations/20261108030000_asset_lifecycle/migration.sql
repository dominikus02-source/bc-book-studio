ALTER TABLE "BookAsset" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "BookAsset" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE "BookAssetRevision" ("id" TEXT NOT NULL, "assetId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "metadata" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BookAssetRevision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "BookAssetRevision_assetId_createdAt_idx" ON "BookAssetRevision"("assetId","createdAt");
ALTER TABLE "BookAssetRevision" ADD CONSTRAINT "BookAssetRevision_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "BookAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
