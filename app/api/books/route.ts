import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { identity, deny, sessionUser } from "../../../lib/auth";
import { createBook, badInput } from "../../../lib/validation";
import { canCreateBook, quotaDenied } from "../../../lib/usage";
import {briefMissing,stageReadiness,transition} from "../../../lib/workflow";
import {starterChapter} from "../../../lib/guided-book";
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
    const {startWriting, ...fields} = input;
    if (!await canCreateBook(ownerId)) return quotaDenied();
    if (startWriting) {
      const missing = briefMissing(fields);
      if (missing.length) return NextResponse.json({ error: "Lengkapi isian awal sebelum mulai menulis.", missing }, { status: 400 });
    }
    const created = await db.book.create({ data: { ...fields, ownerId }, include: { chapters: true, reviews: true } });
    if (!startWriting) return NextResponse.json({ book: created }, { status: 201 });
    try {
      const toOutline = await transition(created.id, "OUTLINE", {id: ownerId});
      if (toOutline.status !== 200) return NextResponse.json({ book: created, startedWriting: false, error: "Buku tersimpan. Lengkapi Ide sebelum menulis." }, { status: 201 });
      const starter = starterChapter(fields.language);
      await db.chapter.create({ data: { bookId: created.id, position: 1, ...starter } });
      const toWriting = await transition(created.id, "WRITING", {id: ownerId});
      const book = await db.book.findUniqueOrThrow({ where: { id: created.id }, include: { chapters: { orderBy: { position: "asc" } }, reviews: true } });
      return NextResponse.json({ book, startedWriting: toWriting.status === 200 }, { status: 201 });
    } catch {
      return NextResponse.json({ book: created, startedWriting: false, error: "Buku tersimpan, tetapi bab awal belum dibuat. Lanjutkan dari Ide." }, { status: 201 });
    }
  } catch (error) { return NextResponse.json(badInput(error), { status: 400 }); }
}
