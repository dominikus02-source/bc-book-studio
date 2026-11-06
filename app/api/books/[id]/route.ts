import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../lib/db";
import { identity, deny, sessionUser } from "../../../../lib/auth";
export const runtime = "nodejs";
const edit = z.object({
  title: z.string().trim().min(3).max(250).optional(),
  grade: z.string().trim().min(1).max(40).optional(),
  subject: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(4000).optional(),
  author: z.string().trim().min(2).max(180).optional(),
  pageSize: z.enum(["A4","A5","B5"]).optional(),
  editorialStage: z.enum(["BRIEF","OUTLINE","WRITING","EDITING","REVIEW","LAYOUT"]).optional(),
  editorialChecks: z.record(z.string().max(40),z.boolean()).optional()
}).strict().refine(v => Object.keys(v).length > 0);
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await sessionUser(req); if (!user) return deny();
  const { id } = await params;
  const where=["REVIEWER","ADMIN"].includes(user.role)?{id,OR:[{ownerId:user.id},{assignedReviewers:{some:{reviewerId:user.id}}}]}:{id,ownerId:user.id};
  const book = await db.book.findFirst({ where, include: { chapters: { orderBy: { position: "asc" } }, reviews: true } });
  return book ? NextResponse.json({ book:{...book,isOwner:book.ownerId===user.id} }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Book not found" }, { status: 404 });
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ownerId = await identity(req); if (!ownerId) return deny();
  const { id } = await params;
  const parsed = edit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid book input" }, { status: 400 });
  const updated = await db.book.updateMany({ where: { id, ownerId, status: "DRAFT" }, data: parsed.data });
  if (!updated.count) {
    const exists = await db.book.findFirst({ where: { id, ownerId }, select: { status: true } });
    return NextResponse.json({ error: exists ? "Only drafts can be edited" : "Book not found" }, { status: exists ? 409 : 404 });
  }
  return NextResponse.json({ book: await db.book.findFirst({ where: { id, ownerId } }) });
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ownerId = await identity(req); if (!ownerId) return deny();
  const { id } = await params;
  const deleted = await db.book.deleteMany({ where: { id, ownerId, status: "DRAFT" } });
  if (!deleted.count) {
    const exists = await db.book.findFirst({ where: { id, ownerId }, select: { status: true } });
    return NextResponse.json({ error: exists ? "Only drafts can be deleted" : "Book not found" }, { status: exists ? 409 : 404 });
  }
  return NextResponse.json({ deleted: true });
}
