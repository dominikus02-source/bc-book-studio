CREATE TABLE "OutlineSection" (
"id" TEXT NOT NULL, "bookId" TEXT NOT NULL, "chapterId" TEXT NOT NULL, "parentId" TEXT,
"position" INTEGER NOT NULL, "title" TEXT NOT NULL, "objective" TEXT NOT NULL,
"archivedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "OutlineSection_pkey" PRIMARY KEY ("id"));
CREATE TABLE "OutlineSectionRevision" (
"id" TEXT NOT NULL, "sectionId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
"action" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "OutlineSectionRevision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "OutlineSection_chapterId_parentId_archivedAt_position_idx" ON "OutlineSection"("chapterId","parentId","archivedAt","position");
CREATE INDEX "OutlineSection_bookId_archivedAt_idx" ON "OutlineSection"("bookId","archivedAt");
CREATE INDEX "OutlineSectionRevision_sectionId_createdAt_idx" ON "OutlineSectionRevision"("sectionId","createdAt");
ALTER TABLE "OutlineSection" ADD CONSTRAINT "OutlineSection_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutlineSection" ADD CONSTRAINT "OutlineSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OutlineSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutlineSectionRevision" ADD CONSTRAINT "OutlineSectionRevision_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "OutlineSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
