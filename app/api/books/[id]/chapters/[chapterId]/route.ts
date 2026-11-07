import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { authorized, deny } from "../../../../../../lib/auth";
import { chapterInput, badInput } from "../../../../../../lib/validation";

import { appendRevision, lockDraftBook, RevisionError } from "../../../../../../lib/revisions";

const updateInput = chapterInput.extend({ expectedVersion: z.number().int().nonnegative().optional() });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  if (!authorized(req)) return deny();
  try {
    const { id, chapterId } = await params;
    const input = updateInput.parse(await req.json());
    const chapter = await db.$transaction(async (tx) => {
      await lockDraftBook(tx, id);
      const saved = await appendRevision(tx, chapterId, id, {
        title: input.title,
        legacyText: input.content,
      }, { source: "human" }, input.expectedVersion);
      return saved.chapter;
    });
    return NextResponse.json({ chapter });
  } catch (error) {
    if (error instanceof RevisionError) return NextResponse.json({ error: error.message }, { status: error.status });
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
