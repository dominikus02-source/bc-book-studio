CREATE TABLE "PrintOrder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "printerName" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "paper" TEXT NOT NULL,
    "binding" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrintOrder_ownerId_archivedAt_updatedAt_idx" ON "PrintOrder"("ownerId", "archivedAt", "updatedAt");
CREATE INDEX "PrintOrder_bookId_idx" ON "PrintOrder"("bookId");

ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StudioUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PrintOrder" (
  "id","ownerId","bookId","printerName","contact","quantity","paper","binding","color","size","unitPrice","dueDate","notes","status","archivedAt","createdAt","updatedAt"
)
SELECT
  d."id",
  d."ownerId",
  d.payload->>'bookId',
  COALESCE(d.payload->>'printerName', ''),
  COALESCE(d.payload->>'contact', ''),
  COALESCE(NULLIF(d.payload->>'quantity','')::integer, 1),
  COALESCE(d.payload->>'paper', 'HVS 80 gsm'),
  COALESCE(d.payload->>'binding', 'Perfect binding'),
  COALESCE(d.payload->>'color', 'BW'),
  COALESCE(d.payload->>'size', 'A5'),
  COALESCE(ROUND(NULLIF(d.payload->>'unitPrice','')::numeric), 0)::integer,
  COALESCE(d.payload->>'dueDate', ''),
  COALESCE(d.payload->>'notes', ''),
  COALESCE(d.payload->>'status', 'DRAFT'),
  CASE WHEN d.module = 'PRINT_ORDER_ARCHIVED' THEN d."updatedAt" ELSE NULL END,
  d."createdAt",
  d."updatedAt"
FROM "StudioFormDraft" d
WHERE d.module IN ('PRINT_ORDER', 'PRINT_ORDER_ARCHIVED')
  AND d.payload ? 'bookId'
  AND EXISTS (SELECT 1 FROM "Book" b WHERE b.id = d.payload->>'bookId' AND b."ownerId" = d."ownerId");
