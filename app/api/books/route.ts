import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { identity, deny, sessionUser } from "../../../lib/auth";
import { createBook, badInput } from "../../../lib/validation";
import { canCreateBook, quotaDenied } from "../../../lib/usage";
import {stageReadiness} from "../../../lib/workflow";
import {isManuscriptReviewerRole,manuscriptVisibilityWhere} from "../../../lib/manuscript-access";
import {bookListFilter,bookListPage,parseBookListQuery} from "../../../lib/book-list-query";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const user = await sessionUser(req);
  if (!user) return deny();
  const parsed=parseBookListQuery(req.nextUrl.searchParams);
  if("error" in parsed)return NextResponse.json({error:parsed.error},{status:400,headers:{"Cache-Control":"no-store"}});
  const archiveOnly=req.nextUrl.searchParams.get("archived")==="1";
  const mine=req.nextUrl.searchParams.get("mine")==="1";
  const where={AND:[manuscriptVisibilityWhere(user,{archived:archiveOnly,mine}),bookListFilter(parsed)]};
  const include={chapters:{where:{archivedAt:null},orderBy:{position:"asc" as const}},reviews:{orderBy:{createdAt:"desc" as const}},approvalSnapshots:{select:{approvedAt:true}},publication:{select:{unpublishedAt:true}},collaborators:{where:{userId:user.id,archivedAt:null},select:{id:true}},assignedReviewers:{where:{reviewerId:user.id},select:{reviewerId:true}}};
  const total=await db.book.count({where});
  const books = await db.book.findMany({ where, orderBy: { updatedAt: "desc" }, include, ...(parsed.limit?{take:parsed.limit,skip:(parsed.page-1)*parsed.limit}:{}) });
  const page=bookListPage(books,parsed,total);
  return NextResponse.json({ books:books.map(book=>{const {collaborators,assignedReviewers,...rest}=book;const isOwner=book.ownerId===user.id;const isCollaborator=!isOwner&&collaborators.length>0;const canReview=!isOwner&&!isCollaborator&&assignedReviewers.length>0&&(isManuscriptReviewerRole(user.role)||user.role==="SUPERADMIN");return {...rest,isOwner,isCollaborator,canReview,canEditDraft:book.status==="DRAFT"&&(user.role==="SUPERADMIN"||isOwner||isCollaborator),stageReadiness:stageReadiness(book)};}), ...page }, { headers: { "Cache-Control": "no-store" } });
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
