ALTER TABLE "ProviderCredential" DROP CONSTRAINT IF EXISTS "ProviderCredential_provider_key";
CREATE INDEX IF NOT EXISTS "ProviderCredential_provider_idx" ON "ProviderCredential"("provider");
CREATE TABLE IF NOT EXISTS "AiUsageEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "credentialId" TEXT NOT NULL,
 "provider" TEXT NOT NULL,
 "model" TEXT NOT NULL,
 "purpose" TEXT NOT NULL,
 "actorId" TEXT,
 "inputTokens" INTEGER,
 "outputTokens" INTEGER,
 "totalTokens" INTEGER,
 "reported" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AiUsageEvent_credentialId_createdAt_idx" ON "AiUsageEvent"("credentialId","createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageEvent_createdAt_idx" ON "AiUsageEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageEvent_actorId_createdAt_idx" ON "AiUsageEvent"("actorId","createdAt");
