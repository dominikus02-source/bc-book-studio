CREATE TABLE "AiProviderCredential" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProviderCredential_enabled_isDefault_idx"
  ON "AiProviderCredential"("enabled", "isDefault");
