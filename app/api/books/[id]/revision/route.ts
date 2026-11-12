import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createHash} from "node:crypto";
import {snapshotSchema} from "../../../../../lib/approval-snapshot";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {manuscriptVisibilityWhere} from "../../../../../lib/manuscript-access";
export const runtime="nodejs";
const input=z.object({expectedVersion:z.string().datetime({offset:true}),confirmed:z.literal(true)}).strict();
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const parsed=input.safeParse(await req.json().catch(()=>null));
 const fail=(error:string,status:number)=>NextResponse.json({error},{status});
 if(!parsed.success)return fail("Versi buku dan konfirmasi revisi diperlukan.",400);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${actor.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null},include:{publication:true}});
  if(!book)return fail("Buku tidak ditemukan.",404);
  if(book.status!=="APPROVED"||!book.approvedAt)return fail("Revisi baru memerlukan buku yang sudah disetujui.",409);
  if(book.updatedAt.toISOString()!==parsed.data.expectedVersion)return fail("Buku berubah. Muat ulang sebelum membuat revisi.",409);
  if(book.publication&&!book.publication.unpublishedAt)return fail("Tarik publikasi lebih dahulu sebelum memulai revisi.",409);
  const previous=await tx.bookApprovalSnapshot.findUnique({where:{bookId_approvedAt:{bookId:id,approvedAt:book.approvedAt}}});
  if(!previous)return fail("Snapshot persetujuan sebelumnya tidak ditemukan.",409);
  await tx.bookBriefRevision.create({data:{bookId:id,actorId:actor.id,snapshot:{action:"revision:start",fromApprovedAt:book.approvedAt.toISOString(),manuscript:previous.manuscript}}});
  const updated=await tx.book.update({where:{id},data:{status:"DRAFT",approvedAt:null,editorialStage:"WRITING",editorialChecks:{}}});
  await tx.review.create({data:{bookId:id,decision:"revision:start",note:"Actor: "+actor.id+"; immutable source approval: "+book.approvedAt.toISOString()+"; new draft requires independent review."}});
  return NextResponse.json({book:updated,previousApprovedAt:book.approvedAt,requiresReview:true},{headers:{"Cache-Control":"no-store"}});
 });
}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await sessionUser(req);if(!actor)return deny();const {id}=await params;
 const book=await db.book.findFirst({where:manuscriptVisibilityWhere(actor,{id}),select:{id:true,title:true,status:true,updatedAt:true,approvedAt:true}});
 if(!book)return NextResponse.json({error:"Buku tidak ditemukan."},{status:404});
 const rows=await db.bookApprovalSnapshot.findMany({where:{bookId:id},orderBy:{approvedAt:"desc"},take:50,include:{layout:{select:{version:true,archivedAt:true}}}});
 return NextResponse.json({book,approvals:rows.map(row=>{
  const parsed=snapshotSchema.safeParse(row.manuscript);
  return {approvedAt:row.approvedAt,current:row.approvedAt.getTime()===book.approvedAt?.getTime(),complete:parsed.success,title:parsed.success?parsed.data.title:book.title,chapterCount:parsed.success?parsed.data.chapters.length:null,sha256:createHash("sha256").update(JSON.stringify(row.manuscript)).digest("hex"),layoutVersion:row.layout?.version??0};
 })},{headers:{"Cache-Control":"no-store"}});
}
