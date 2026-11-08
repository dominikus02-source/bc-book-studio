ALTER TABLE "OutlineSection" DROP CONSTRAINT "OutlineSection_parentId_fkey";
ALTER TABLE "OutlineSection" ADD CONSTRAINT "OutlineSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OutlineSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
