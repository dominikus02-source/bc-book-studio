import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { authorized, deny } from "../../../../../../lib/auth";
import { chapterInput, badInput } from "../../../../../../lib/validation";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  if (!authorized(req)) return deny();
  try {
    const { id, chapterId } = await params;
    const input = chapterInput.parse(await req.json());
    const book = await db.book.findUnique({ where: { id } });
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    if (book.status !== "DRAFT") return NextResponse.json({ error: "Book must be draft" }, { status: 409 });
    const chapter = await db.chapter.update({
      where: { id: chapterId, bookId: id },
      data: input,
    });
    return NextResponse.json({ chapter });
  } catch (error) {
    return NextResponse.json(badInput(error), { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  if (!authorized(req)) return deny();
  const { id, chapterId } = await params;
  const book = await db.book.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "DRAFT") return NextResponse.json({ error: "Book must be draft" }, { status: 409 });
  await db.chapter.delete({ where: { id: chapterId, bookId: id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
