import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { identity, deny, sessionUser } from "../../../lib/auth";
import { createBook, badInput } from "../../../lib/validation";
import { canCreateBook, quotaDenied } from "../../../lib/usage";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const user = await sessionUser(req);
  if (!user) return deny();
  const canReview=["REVIEWER","ADMIN"].includes(user.role);
  const where=canReview?{OR:[{ownerId:user.id},{assignedReviewers:{some:{reviewerId:user.id}}}]}:{ownerId:user.id};
  const books = await db.book.findMany({ where, orderBy: { updatedAt: "desc" }, include: { chapters: { orderBy: { position: "asc" } }, reviews: { orderBy: { createdAt: "desc" } } } });
  return NextResponse.json({ books:books.map(book=>({...book,isOwner:book.ownerId===user.id})) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  try {
    const input = createBook.parse(await req.json());
    if (!await canCreateBook(ownerId)) return quotaDenied();
    const book = await db.book.create({ data: { ...input, ownerId }, include: { chapters: true, reviews: true } });
    return NextResponse.json({ book }, { status: 201 });
  } catch (error) { return NextResponse.json(badInput(error), { status: 400 }); }
}
