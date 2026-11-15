-- Additive collaborators and per-book review policy.
-- No existing rows are rewritten.
-- CHECK and FOREIGN KEY constraints are NOT VALID: existing rows are not scanned.
-- PostgreSQL still enforces them on later INSERT and UPDATE.
-- Do not run VALIDATE CONSTRAINT against production data in this migration.
-- Rollback: DROP TRIGGER, DROP FUNCTION, DROP TABLE "BookCollaborator",
-- drop the new Book columns and the ReviewPolicy type. ChapterRevision.actorId
-- may be dropped only if no application release still writes it.

CREATE TYPE "ReviewPolicy" AS ENUM ('ANY', 'ALL', 'MAJORITY', 'MIN_N', 'LEAD');

ALTER TABLE "Book" ADD COLUMN "reviewPolicy" "ReviewPolicy" NOT NULL DEFAULT 'ANY';
ALTER TABLE "Book" ADD COLUMN "reviewMinApprovals" INTEGER;
ALTER TABLE "Book" ADD COLUMN "leadReviewerId" TEXT;

ALTER TABLE "Book" ADD CONSTRAINT "Book_reviewMinApprovals_range"
  CHECK ("reviewMinApprovals" IS NULL OR ("reviewMinApprovals" >= 1 AND "reviewMinApprovals" <= 50)) NOT VALID;

ALTER TABLE "Book" ADD CONSTRAINT "Book_leadReviewerId_fkey"
  FOREIGN KEY ("leadReviewerId") REFERENCES "StudioUser"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

CREATE INDEX "Book_leadReviewerId_idx" ON "Book"("leadReviewerId");

ALTER TABLE "ChapterRevision" ADD COLUMN "actorId" TEXT;

CREATE TABLE "BookCollaborator" (
  "id" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'EDITOR',
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "BookCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookCollaborator_bookId_userId_key" ON "BookCollaborator"("bookId", "userId");
CREATE INDEX "BookCollaborator_userId_archivedAt_idx" ON "BookCollaborator"("userId", "archivedAt");

ALTER TABLE "BookCollaborator" ADD CONSTRAINT "BookCollaborator_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookCollaborator" ADD CONSTRAINT "BookCollaborator_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "StudioUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookCollaborator" ADD CONSTRAINT "BookCollaborator_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "StudioUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "BookCollaborator" ADD CONSTRAINT "BookCollaborator_role_editor"
  CHECK ("role" = 'EDITOR') NOT VALID;

-- The book owner cannot be a collaborator. An active collaborator cannot also
-- be an assigned reviewer, and a reviewer cannot be restored as a collaborator.
CREATE OR REPLACE FUNCTION "book_collaborator_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."archivedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Book"
    WHERE "id" = NEW."bookId" AND "ownerId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'book owner cannot be a collaborator'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "BookReviewer"
    WHERE "bookId" = NEW."bookId" AND "reviewerId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'assigned reviewer cannot be a collaborator'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "BookCollaborator_guard" ON "BookCollaborator";
CREATE TRIGGER "BookCollaborator_guard"
BEFORE INSERT OR UPDATE OF "bookId", "userId", "archivedAt" ON "BookCollaborator"
FOR EACH ROW
EXECUTE PROCEDURE "book_collaborator_guard"();

-- Keep the existing owner guard and also reject active collaborators.
CREATE OR REPLACE FUNCTION "book_reviewer_not_owner"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Book"
    WHERE "id" = NEW."bookId" AND "ownerId" = NEW."reviewerId"
  ) THEN
    RAISE EXCEPTION 'book owner cannot be assigned as reviewer'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "BookCollaborator"
    WHERE "bookId" = NEW."bookId" AND "userId" = NEW."reviewerId" AND "archivedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'collaborator cannot be assigned as reviewer'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
