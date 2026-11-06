import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { identity, deny } from "../../../../lib/auth";
import { canCreateBook, quotaDenied } from "../../../../lib/usage";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  const title = "Bahasa Indonesia Kelas VII — Contoh Beta";
  const template = await db.book.findFirst({ where: { ownerId: "legacy-unassigned", title }, include: { chapters: { orderBy: { position: "asc" } } } });
  if (!template) return NextResponse.json({ error: "Template belum tersedia" }, { status: 503 });
  const existing = await db.book.findFirst({ where: { ownerId, title }, select: { id: true } });
  if (existing) return NextResponse.json({ bookId: existing.id, alreadyExists: true });
  if (!await canCreateBook(ownerId)) return quotaDenied();
  const book = await db.book.create({ data: {
    ownerId, title, grade: template.grade, subject: template.subject,
    description: template.description, chapters: { create: template.chapters.map(c => ({ position: c.position, title: c.title, content: c.content })) }
  } });
  return NextResponse.json({ bookId: book.id, alreadyExists: false }, { status: 201 });
}
