import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { sessionUser, deny } from "../../../../../../lib/auth";
import { manuscriptVisibilityWhere } from "../../../../../../lib/manuscript-access";
import { emptyPacket, emptyPublisher, isbnPacketSchema, isbnZip, publisherDossierSchema } from "../../../../../../lib/isbn-packet";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const book = await db.book.findFirst({ where: manuscriptVisibilityWhere(actor, { id }), include: { chapters: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: { title: true } }, isbnPacket: true } });
  if (!book) return NextResponse.json({ error: "Buku tidak ditemukan." }, { status: 404 });
  if (book.companionKind) return NextResponse.json({ error: "Bahan pendamping tidak memakai ISBN." }, { status: 409 });
  const dossier = await db.publisherDossier.findUnique({ where: { id: "bci-publisher" } });
  const publisher = publisherDossierSchema.safeParse(dossier?.payload ?? {});
  const packet = isbnPacketSchema.safeParse(book.isbnPacket?.payload ?? {});
  const bytes = await isbnZip(publisher.success ? publisher.data : emptyPublisher(), packet.success ? packet.data : emptyPacket(), book.chapters);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/zip", "Content-Disposition": "attachment; filename=\"paket-isbn.zip\"", "Cache-Control": "no-store" } });
}
