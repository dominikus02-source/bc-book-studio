CREATE TABLE "ProviderCredential" (
 "id" TEXT NOT NULL PRIMARY KEY, "provider" TEXT NOT NULL UNIQUE,
 "label" TEXT NOT NULL, "model" TEXT NOT NULL, "encryptedKey" TEXT NOT NULL,
 "lastFour" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ProviderCredential_one_active" ON "ProviderCredential" ("active") WHERE "active" = true;
CREATE TABLE "CredentialAudit" (
 "id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL, "credentialId" TEXT NOT NULL,
 "action" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
