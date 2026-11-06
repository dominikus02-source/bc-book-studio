import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { authorized, deny } from "../../../../lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  const book = await db.book.findUnique({
    where: { id },
    include: { chapters: { orderBy: { position: "asc" } } },
  });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ book });
}
