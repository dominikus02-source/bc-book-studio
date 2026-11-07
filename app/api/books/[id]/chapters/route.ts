import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { authorized, deny } from "../../../../../lib/auth";
import { chapterInput, badInput } from "../../../../../lib/validation";
import { appendRevision, lockDraftBook, RevisionError } from "../../../../../lib/revisions";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  try {
    const { id } = await params;
    const input = chapterInput.parse(await req.json());
    const chapter = await db.$transaction(async tx => {
      await lockDraftBook(tx, id);
      const last = await tx.chapter.findFirst({ where: { bookId: id }, orderBy: { position: "desc" } });
      const created = await tx.chapter.create({ data: { bookId: id, position: (last?.position ?? 0) + 1, ...input } });
      return (await appendRevision(tx, created.id, id, { title: input.title, legacyText: input.content }, { source: "human" }, 0)).chapter;
    });
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (error) {
    if (error instanceof RevisionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(badInput(error), { status: 400 });
  }
}
