-- Companion books linked to a parent manuscript.
-- Additive only. New checks and the parent foreign key are NOT VALID.
-- Existing rows are not scanned and are not rewritten, except the publisher
-- imprint default for rows that still hold the previous built-in imprint name.
-- Do not validate these constraints against production data in this migration.

ALTER TABLE "Book" ADD COLUMN "parentBookId" TEXT;
ALTER TABLE "Book" ADD COLUMN "companionKind" TEXT;

ALTER TABLE "Book" ADD CONSTRAINT "Book_parentBookId_fkey"
  FOREIGN KEY ("parentBookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

ALTER TABLE "Book" ADD CONSTRAINT "Book_companionKind_known"
  CHECK ("companionKind" IS NULL OR "companionKind" IN ('LKPD', 'PANDUAN_GURU', 'KUNCI_BUKU', 'KUNCI_LKS')) NOT VALID;

ALTER TABLE "Book" ADD CONSTRAINT "Book_companion_has_parent"
  CHECK (("companionKind" IS NULL AND "parentBookId" IS NULL) OR ("companionKind" IS NOT NULL AND "parentBookId" IS NOT NULL)) NOT VALID;

CREATE INDEX "Book_parentBookId_idx" ON "Book"("parentBookId");

ALTER TABLE "PublisherProfile" ALTER COLUMN "imprintName" SET DEFAULT 'Teras Kata';
ALTER TABLE "IsbnApplication" ALTER COLUMN "imprint" SET DEFAULT 'Teras Kata';

UPDATE "PublisherProfile"
SET "imprintName" = 'Teras Kata'
WHERE "imprintName" = 'Bahasa Cerdas Indonesia';

CREATE TABLE "PublisherDossier" (
  "id" TEXT NOT NULL DEFAULT 'bci-publisher',
  "payload" JSONB NOT NULL,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublisherDossier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IsbnPacket" (
  "bookId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IsbnPacket_pkey" PRIMARY KEY ("bookId")
);

ALTER TABLE "IsbnPacket" ADD CONSTRAINT "IsbnPacket_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
