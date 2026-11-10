import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import type {Prisma} from "@prisma/client";
import {db} from "../../../../../lib/db";
import {reviewerAccess} from "../../../../../lib/reviewer-access";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const patchSchema=z.object({chapterId:z.string().min(10).nullable().optional(),expectedVersion:z.string().datetime(),content:z.string().trim().min(3).max(10000).optional(),category:z.enum(["CONTENT","FACT","CITATION","LANGUAGE","ACCESSIBILITY","COPYRIGHT","PEDAGOGY"]).optional(),severity:z.enum(["SUGGESTION","MAJOR","CRITICAL"]).optional(),status:z.enum(["OPEN","RESOLVED"]).optional()}).strict().refine(x=>Object.keys(x).some(key=>key!=="expectedVersion"));
const restoreSchema=z.object({expectedVersion:z.string().datetime(),restore:z.literal(true)}).strict();
const schema=z.union([patchSchema,restoreSchema]);
async function owned(req:NextRequest,id:string,tx:Prisma.TransactionClient,allowArchived=false){
 const initial=await tx.reviewerNote.findUnique({where:{id}});
 if(!initial)return null;
 await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${initial.bookId} FOR UPDATE`;
 const note=await tx.reviewerNote.findUnique({where:{id}});
 if(!note||(!allowArchived&&note.status==="ARCHIVED"))return null;
 const access=await reviewerAccess(req,note.bookId,tx);
 return access?.actor.id===note.reviewerId?{note,access}:null;
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const {id}=await params;const p=schema.safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:"Invalid input"},{status:400});
 return db.$transaction(async tx=>{
 const restoring="restore" in p.data;
 const found=await owned(req,id,tx,restoring);if(!found)return NextResponse.json({error:"Not found"},{status:404});
 if(found.access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 if(p.data.expectedVersion&&found.note.updatedAt.toISOString()!==p.data.expectedVersion)return NextResponse.json({error:"Catatan sudah berubah di sesi lain. Muat ulang dahulu."},{status:409});
 if("restore" in p.data){
  if(found.note.status!=="ARCHIVED")return NextResponse.json({error:"Catatan tidak diarsipkan."},{status:409});
  await tx.review.create({data:{bookId:found.note.bookId,decision:"note:restore",note:JSON.stringify({id,actor:found.access.actor.id})}});
  return NextResponse.json({note:await tx.reviewerNote.update({where:{id},data:{status:"OPEN"}})});
 }
 if(p.data.chapterId&&!await tx.chapter.findFirst({where:{id:p.data.chapterId,bookId:found.note.bookId,archivedAt:null}}))return NextResponse.json({error:"Bab tidak ditemukan atau telah diarsipkan"},{status:400});
 const {expectedVersion,...patch}=p.data;
 await tx.review.create({data:{bookId:found.note.bookId,decision:"note:update",note:JSON.stringify({id,previous:found.note,actor:found.access.actor.id})}});
 return NextResponse.json({note:await tx.reviewerNote.update({where:{id},data:patch})});
 });
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const {id}=await params;
 const version=z.object({expectedVersion:z.string().datetime()}).strict().safeParse(await req.json().catch(()=>null));
 if(!version.success)return NextResponse.json({error:"Versi catatan wajib diisi. Muat ulang dahulu."},{status:400});
 return db.$transaction(async tx=>{const found=await owned(req,id,tx);if(!found)return NextResponse.json({error:"Not found"},{status:404});
 if(found.access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 if(found.note.updatedAt.toISOString()!==version.data.expectedVersion)return NextResponse.json({error:"Catatan sudah berubah di sesi lain. Muat ulang dahulu."},{status:409});
 await tx.review.create({data:{bookId:found.note.bookId,decision:"note:remove",note:JSON.stringify({previous:found.note,actor:found.access.actor.id})}});
 await tx.reviewerNote.update({where:{id},data:{status:"ARCHIVED"}});return NextResponse.json({deleted:true,archived:true});
 });
}
