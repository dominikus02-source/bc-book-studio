import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { sessionUser, deny } from "../../../../../lib/auth";
import { manuscriptVisibilityWhere } from "../../../../../lib/manuscript-access";
import { lockDraftEditor } from "../../../../../lib/draft-access";
import { canEditIsbnPacket, emptyPacket, emptyPublisher, isbnPacketSchema, publisherDossierSchema } from "../../../../../lib/isbn-packet";

export const runtime = "nodejs";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const book = await db.book.findFirst({ where: manuscriptVisibilityWhere(actor, { id }), include: { chapters: { where: { archivedAt: null }, select: { title: true } }, isbnPacket: true, collaborators: { where: { userId: actor.id, archivedAt: null }, select: { id: true } } } });
  if (!book) return fail("Buku tidak ditemukan.", 404);
  if (book.companionKind) return fail("Bahan pendamping tidak memakai ISBN.", 409);
  const dossierRow = await db.publisherDossier.findUnique({ where: { id: "bci-publisher" } });
  const saved = isbnPacketSchema.safeParse(book.isbnPacket?.payload ?? {});
  const base = saved.success ? saved.data : emptyPacket();
  const packet = isbnPacketSchema.parse({
    ...base,
    title: base.title || book.title,
    authors: base.authors || book.author,
    synopsis: base.synopsis || book.description,
    trimSize: base.trimSize || book.pageSize,
    preface: base.preface || book.writingGoal,
  });
  const publisher = publisherDossierSchema.safeParse(dossierRow?.payload ?? {});
  return NextResponse.json({
    packet,
    publisher: publisher.success ? publisher.data : emptyPublisher(),
    chapters: book.chapters.map(chapter => chapter.title),
    canEdit: canEditIsbnPacket(actor, book, book.collaborators.length > 0),
    companion: false,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const parsed = isbnPacketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Data kelengkapan ISBN tidak valid.", 400);
  return db.$transaction(async tx => {
    const locked = await lockDraftEditor(tx, id, actor.id);
    const book = await tx.book.findFirst({ where: { id, archivedAt: null }, select: { ownerId: true, companionKind: true } });
    if (!book) return fail("Buku tidak ditemukan.", 404);
    const collaborating = Boolean(locked && locked.ownerId !== actor.id);
    if (!canEditIsbnPacket(actor, book, collaborating) || !locked) return fail("Anda hanya dapat membaca kelengkapan ISBN ini.", 403);
    const row = await tx.isbnPacket.upsert({ where: { bookId: id }, update: { payload: parsed.data, updatedById: actor.id }, create: { bookId: id, payload: parsed.data, updatedById: actor.id } });
    return NextResponse.json({ packet: isbnPacketSchema.parse(row.payload) });
  });
}
