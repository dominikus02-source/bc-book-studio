import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { identity, deny, sessionUser } from "../../../lib/auth";
import { createBook, badInput } from "../../../lib/validation";
import { canCreateBook, quotaDenied } from "../../../lib/usage";
import {stageReadiness} from "../../../lib/workflow";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const user = await sessionUser(req);
  if (!user) return deny();
  const archiveOnly=req.nextUrl.searchParams.get("archived")==="1";
  const canReview=["REVIEWER","ADMIN"].includes(user.role);
  const where=archiveOnly?{ownerId:user.id,archivedAt:{not:null}}:canReview?{archivedAt:null,OR:[{ownerId:user.id},{assignedReviewers:{some:{reviewerId:user.id}}}]}:{ownerId:user.id,archivedAt:null};
  const books = await db.book.findMany({ where, orderBy: { updatedAt: "desc" }, include: { chapters: { where:{archivedAt:null}, orderBy: { position: "asc" } }, reviews: { orderBy: { createdAt: "desc" } }, approvalSnapshots:{select:{approvedAt:true}},publication:{select:{unpublishedAt:true}} } });
  return NextResponse.json({ books:books.map(book=>({...book,isOwner:book.ownerId===user.id,stageReadiness:stageReadiness(book)})) }, { headers: { "Cache-Control": "no-store" } });
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
