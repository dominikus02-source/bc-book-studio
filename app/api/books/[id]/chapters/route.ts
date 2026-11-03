import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { authorized, deny } from "../../../../../lib/auth";
import { chapterInput, badInput } from "../../../../../lib/validation";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  try {
    const { id } = await params;
    const input = chapterInput.parse(await req.json());
    const chapter = await db.$transaction(async tx => {
      const book = await tx.book.findUnique({ where: { id }, include: { chapters: { orderBy: { position: "desc" }, take: 1 } } });
      if (!book) throw new Error("NOT_FOUND");
      if (book.status !== "DRAFT") throw new Error("LOCKED");
      return tx.chapter.create({ data: { bookId: id, position: (book.chapters[0]?.position ?? 0) + 1, ...input } });
    });
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(msg === "NOT_FOUND" ? { error: "Book not found" } : msg === "LOCKED" ? { error: "Return book to draft before editing" } : badInput(error), { status: msg === "NOT_FOUND" ? 404 : msg === "LOCKED" ? 409 : 400 });
  }
}
