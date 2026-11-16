import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { sessionUser, deny } from "../../../../../lib/auth";
import { lockDraftEditor } from "../../../../../lib/draft-access";
import { manuscriptVisibilityWhere } from "../../../../../lib/manuscript-access";
import { COMPANION_KINDS, COMPANION_LABEL, companionChapterDraft, companionCompleteness, companionGenre, isCompanionKind } from "../../../../../lib/companions";

export const runtime = "nodejs";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function parentFor(actor: { id: string; role: string }, id: string) {
  return db.book.findFirst({
    where: { ...manuscriptVisibilityWhere(actor, { id }), companionKind: null },
    include: { chapters: { where: { archivedAt: null }, orderBy: { position: "asc" } }, companions: { where: { archivedAt: null }, include: { chapters: { where: { archivedAt: null }, select: { content: true } } } } },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const book = await parentFor(actor, id);
  if (!book) return fail("Buku tidak ditemukan.", 404);
  const companions = COMPANION_KINDS.map(kind => {
    const row = book.companions.find(item => item.companionKind === kind);
    const progress = companionCompleteness(row?.chapters || []);
    return { kind, label: COMPANION_LABEL[kind], id: row?.id || null, title: row?.title || null, ...progress };
  });
  return NextResponse.json({ companions, isbnRequired: false }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const body = z.object({ kind: z.string() }).strict().safeParse(await req.json().catch(() => null));
  if (!body.success || !isCompanionKind(body.data.kind)) return fail("Jenis bahan pendamping tidak dikenal.", 400);
  const kind = body.data.kind;
  return db.$transaction(async tx => {
    const locked = await lockDraftEditor(tx, id, actor.id);
    if (!locked) return fail("Hanya penulis atau kolaborator yang dapat membuat bahan pendamping.", 403);
    const book = await tx.book.findFirst({ where: { id, archivedAt: null, companionKind: null }, include: { chapters: { where: { archivedAt: null }, orderBy: { position: "asc" } } } });
    if (!book) return fail("Buku utama tidak ditemukan.", 404);
    if (book.status !== "DRAFT") return fail("Bahan pendamping baru dibuat saat buku utama masih draf.", 409);
    const existing = await tx.book.findFirst({ where: { parentBookId: id, companionKind: kind, archivedAt: null }, select: { id: true, title: true } });
    if (existing) return NextResponse.json({ companion: existing, created: false });
    const label = COMPANION_LABEL[kind];
    const companion = await tx.book.create({
      data: {
        ownerId: book.ownerId,
        parentBookId: id,
        companionKind: kind,
        title: (label + " — " + book.title).slice(0, 180),
        grade: book.grade,
        subject: book.subject,
        description: label + " untuk buku " + book.title + ". Bahan ini tidak memerlukan ISBN.",
        targetAudience: book.targetAudience,
        writingGoal: "Mendampingi " + book.title + " pada setiap bab.",
        bookType: "NONFICTION",
        genre: companionGenre(kind),
        pageSize: book.pageSize,
        author: book.author,
        editorialStage: book.chapters.length ? "WRITING" : "BRIEF",
      },
    });
    for (const [index, chapter] of book.chapters.entries()) {
      const draft = companionChapterDraft(kind, book.title, chapter, index);
      await tx.chapter.create({ data: { bookId: companion.id, position: index + 1, ...draft } });
    }
    await tx.review.create({ data: { bookId: id, decision: "companion:create", note: kind + " by " + actor.id + " -> " + companion.id } });
    return NextResponse.json({ companion: { id: companion.id, title: companion.title, kind }, created: true }, { status: 201 });
  });
}
