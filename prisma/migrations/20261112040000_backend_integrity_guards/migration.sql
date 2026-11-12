-- Non-destructive integrity guards.
-- No rows are updated, deleted, or rewritten.
-- CHECK and FOREIGN KEY constraints are NOT VALID: existing rows are not scanned.
-- PostgreSQL still enforces them on later INSERT and UPDATE of those rows.
-- Before production apply, run the read-only predicate at the bottom of this file.
-- If it returns any id, stop and decide how to repair that row. Do not VALIDATE
-- until that predicate is empty. Rollback is DROP CONSTRAINT / DROP TRIGGER only.
-- Book.ownerId is intentionally not a foreign key: templates use ownerId
-- 'legacy-unassigned', which is not a StudioUser.

ALTER TABLE "Book" ADD CONSTRAINT "Book_editorialStage_known"
  CHECK ("editorialStage" IN ('BRIEF', 'OUTLINE', 'WRITING', 'EDITING', 'REVIEW', 'LAYOUT')) NOT VALID;

ALTER TABLE "Book" ADD CONSTRAINT "Book_approval_pointer_consistent"
  CHECK (
    ("status" = 'APPROVED' AND "approvedAt" IS NOT NULL)
    OR ("status" <> 'APPROVED' AND "approvedAt" IS NULL)
  ) NOT VALID;

ALTER TABLE "ReviewerNote" ADD CONSTRAINT "ReviewerNote_status_known"
  CHECK ("status" IN ('OPEN', 'RESOLVED', 'ARCHIVED')) NOT VALID;
ALTER TABLE "ReviewerNote" ADD CONSTRAINT "ReviewerNote_severity_known"
  CHECK ("severity" IN ('SUGGESTION', 'MAJOR', 'CRITICAL')) NOT VALID;
ALTER TABLE "ReviewerNote" ADD CONSTRAINT "ReviewerNote_category_known"
  CHECK ("category" IN ('CONTENT', 'FACT', 'CITATION', 'LANGUAGE', 'ACCESSIBILITY', 'COPYRIGHT', 'PEDAGOGY')) NOT VALID;

ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_status_known"
  CHECK ("status" IN ('QUEUED', 'RUNNING', 'COMPLETE', 'CANCELLED', 'FAILED', 'EXPIRED')) NOT VALID;

ALTER TABLE "OutlineSection" ADD CONSTRAINT "OutlineSection_genreTarget_known"
  CHECK ("genreTarget" IN ('FANTASY', 'ROMANCE', 'SCI_FI', 'NONFICTION', 'THRILLER')) NOT VALID;
ALTER TABLE "OutlineSection" ADD CONSTRAINT "OutlineSection_accessTier_known"
  CHECK ("accessTier" IN ('PUBLIC', 'PREMIUM', 'DRAFT')) NOT VALID;

-- New and updated assignments must name a real account. Existing rows are not scanned.
ALTER TABLE "BookReviewer" ADD CONSTRAINT "BookReviewer_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "StudioUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- The author of a book cannot also be its assigned reviewer.
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "BookReviewer_not_owner" ON "BookReviewer";
CREATE TRIGGER "BookReviewer_not_owner"
BEFORE INSERT OR UPDATE OF "bookId", "reviewerId" ON "BookReviewer"
FOR EACH ROW
EXECUTE PROCEDURE "book_reviewer_not_owner"();

-- Outline rows must stay on the chapter they claim, and a parent must be a
-- different top-level section of that same chapter.
CREATE OR REPLACE FUNCTION "outline_section_matches_chapter"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  chapter_book text;
BEGIN
  SELECT "bookId" INTO chapter_book FROM "Chapter" WHERE "id" = NEW."chapterId";
  IF chapter_book IS NULL OR chapter_book IS DISTINCT FROM NEW."bookId" THEN
    RAISE EXCEPTION 'outline section bookId must match its chapter'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW."parentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "OutlineSection" parent
    WHERE parent."id" = NEW."parentId"
      AND parent."id" <> NEW."id"
      AND parent."bookId" = NEW."bookId"
      AND parent."chapterId" = NEW."chapterId"
      AND parent."parentId" IS NULL
  ) THEN
    RAISE EXCEPTION 'outline parent must be a top-level section of the same chapter'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "OutlineSection_book_matches_chapter" ON "OutlineSection";
CREATE TRIGGER "OutlineSection_book_matches_chapter"
BEFORE INSERT OR UPDATE OF "bookId", "chapterId", "parentId" ON "OutlineSection"
FOR EACH ROW
EXECUTE PROCEDURE "outline_section_matches_chapter"();

-- Read-only preflight. Do not run this as part of apply; it is documentation.
-- SELECT "id" FROM "Book"
--  WHERE "editorialStage" NOT IN ('BRIEF','OUTLINE','WRITING','EDITING','REVIEW','LAYOUT')
--     OR ("status" = 'APPROVED') IS DISTINCT FROM ("approvedAt" IS NOT NULL);
-- SELECT "id" FROM "ReviewerNote"
--  WHERE "status" NOT IN ('OPEN','RESOLVED','ARCHIVED')
--     OR "severity" NOT IN ('SUGGESTION','MAJOR','CRITICAL')
--     OR "category" NOT IN ('CONTENT','FACT','CITATION','LANGUAGE','ACCESSIBILITY','COPYRIGHT','PEDAGOGY');
-- SELECT "id" FROM "ExportJob"
--  WHERE "status" NOT IN ('QUEUED','RUNNING','COMPLETE','CANCELLED','FAILED','EXPIRED');
-- SELECT "id" FROM "OutlineSection"
--  WHERE "genreTarget" NOT IN ('FANTASY','ROMANCE','SCI_FI','NONFICTION','THRILLER')
--     OR "accessTier" NOT IN ('PUBLIC','PREMIUM','DRAFT');
-- SELECT r."id" FROM "BookReviewer" r
--  LEFT JOIN "StudioUser" u ON u."id" = r."assignedById"
--  WHERE u."id" IS NULL;
-- SELECT r."id" FROM "BookReviewer" r
--  JOIN "Book" b ON b."id" = r."bookId" AND b."ownerId" = r."reviewerId";
-- SELECT s."id" FROM "OutlineSection" s
--  LEFT JOIN "Chapter" c ON c."id" = s."chapterId"
--  WHERE c."id" IS NULL OR c."bookId" IS DISTINCT FROM s."bookId";
