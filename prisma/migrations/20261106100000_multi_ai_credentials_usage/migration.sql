DROP INDEX IF EXISTS "ProviderCredential_one_active";
DROP INDEX IF EXISTS "ProviderCredential_provider_key";
ALTER TABLE "ProviderCredential" ADD COLUMN "maxTokens" INTEGER NOT NULL DEFAULT 1800;
ALTER TABLE "ProviderCredential" ADD COLUMN "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4;
CREATE INDEX "ProviderCredential_active_provider_idx" ON "ProviderCredential" ("active", "provider");
CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "totalTokens" INTEGER NOT NULL,
  "estimated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent" ("userId", "createdAt");
CREATE INDEX "UsageEvent_credentialId_createdAt_idx" ON "UsageEvent" ("credentialId", "createdAt");
