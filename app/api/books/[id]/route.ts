import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { authorized, deny } from "../../../../lib/auth";
import { createBook, badInput } from "../../../../lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  const book = await db.book.findUnique({
    where: { id },
    include: { chapters: { orderBy: { position: "asc" }, include: { currentRevision: { select: { version: true } } } }, reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ book });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  try {
    const { id } = await params;
    const input = createBook.parse(await req.json());
    const book = await db.book.update({
      where: { id },
      data: input,
    });
    return NextResponse.json({ book });
  } catch (error) {
    return NextResponse.json(badInput(error), { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  await db.book.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
