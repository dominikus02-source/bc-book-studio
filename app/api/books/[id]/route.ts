import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../lib/db";
import { identity, deny, sessionUser } from "../../../../lib/auth";
export const runtime = "nodejs";
const briefFields=["title","subject","description","targetAudience","writingGoal","bookType","genre","language"] as const;
const edit=z.object({
  expectedVersion:z.string().datetime({offset:true}),
  title:z.string().trim().min(3).max(250).optional(),
  grade:z.string().trim().min(1).max(40).optional(),
  subject:z.string().trim().min(2).max(120).optional(),
  description:z.string().max(12000).optional(),
  author:z.string().trim().min(2).max(180).optional(),
  bookType:z.enum(["FICTION","NONFICTION"]).optional(),
  genre:z.enum(["NOVEL","SHORT_STORY","ANTHOLOGY","POETRY","TEXTBOOK","REFERENCE","GUIDE","WORKBOOK"]).optional(),
  pageSize:z.enum(["A4","A5","B5"]).optional(),
  language:z.enum(["id","en"]).optional(),
  targetAudience:z.string().trim().max(300).optional(),
  writingGoal:z.string().trim().max(1500).optional(),
  editorialChecks:z.record(z.string().max(40),z.union([
  z.boolean(),
  z.string().transform(v => v === "true" || v === "1" || v === "yes" || v === "on")
])).optional(),
}).strict().refine(v=>Object.keys(v).some(k=>k!=="expectedVersion"),"At least one change required.")
.refine(v=>!(v.bookType||v.genre)||(Boolean(v.bookType)&&Boolean(v.genre)&&(["NOVEL","SHORT_STORY","ANTHOLOGY","POETRY"].includes(v.genre!)===(v.bookType==="FICTION"))),"Genre and book type must be changed together.");
type Ctx={params:Promise<{id:string}>};
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 if(req.nextUrl.searchParams.get("briefHistory")==="1"){
  const book=await db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{briefRevisions:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:50}}});
  return book?NextResponse.json({history:book.briefRevisions},{headers:{"Cache-Control":"no-store"}}):fail("Book not found",404);
 }
 const where=["REVIEWER","ADMIN"].includes(user.role)?{id,archivedAt:null,OR:[{ownerId:user.id},{assignedReviewers:{some:{reviewerId:user.id}}}]}:{id,ownerId:user.id,archivedAt:null};
 const book=await db.book.findFirst({where,include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},reviews:true}});
 return book?NextResponse.json({book:{...book,isOwner:book.ownerId===user.id}},{headers:{"Cache-Control":"no-store"}}):fail("Book not found",404);
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const raw=await req.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||!Object.prototype.hasOwnProperty.call(raw,"expectedVersion"))return fail("Muat versi terbaru sebelum menyimpan brief.",428,"BOOK_VERSION_REQUIRED");
 const parsed=edit.safeParse(raw);
 if(!parsed.success)return fail("Invalid book input: "+parsed.error.issues.map(i=>i.message).join("; "),400);
 const {expectedVersion,...changes}=parsed.data;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
  const current=await tx.book.findFirst({where:{id,ownerId,archivedAt:null}});
  if(!current)return fail("Book not found",404);
  if(current.status!=="DRAFT")return fail("Only drafts can be edited",409);
  if(current.updatedAt.getTime()!==new Date(expectedVersion).getTime())return fail("Buku telah berubah pada sesi lain. Muat ulang sebelum menyimpan.",409,"BOOK_VERSION_CONFLICT");
  const isChanged=Object.entries(changes).some(([k,v])=>JSON.stringify((current as unknown as Record<string,unknown>)[k])!==JSON.stringify(v));
  if(!isChanged)return NextResponse.json({book:current,unchanged:true});
  const book=await tx.book.update({where:{id},data:changes});
  if(briefFields.some(field=>current[field]!==book[field])){
   const snapshot=Object.fromEntries(briefFields.map(field=>[field,current[field]]));
   await tx.bookBriefRevision.create({data:{bookId:id,actorId:ownerId,snapshot}});
  }
  return NextResponse.json({book},{headers:{"Cache-Control":"no-store"}});
 });
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const data=await req.json().catch(()=>null);
 const parsed=z.object({expectedVersion:z.string().datetime({offset:true})}).strict().safeParse(data);
 if(!parsed.success)return fail("Versi buku wajib diisi sebelum pengarsipan.",428,"BOOK_VERSION_REQUIRED");
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId}});
  if(!book)return fail("Book not found",404);
  if(book.archivedAt||book.status!=="DRAFT")return fail("Only active drafts can be archived",409);
  if(book.updatedAt.getTime()!==new Date(parsed.data.expectedVersion).getTime())return fail("Buku telah berubah. Muat ulang sebelum mengarsipkan.",409,"BOOK_VERSION_CONFLICT");
  await tx.book.update({where:{id},data:{archivedAt:new Date()}});
  await tx.review.create({data:{bookId:id,decision:"brief:archive",note:"Actor: "+ownerId}});
  return NextResponse.json({archived:true},{headers:{"Cache-Control":"no-store"}});
 });
}
