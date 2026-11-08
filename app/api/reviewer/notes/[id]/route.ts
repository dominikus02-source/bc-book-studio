import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import type {Prisma} from "@prisma/client";
import {db} from "../../../../../lib/db";
import {reviewerAccess} from "../../../../../lib/reviewer-access";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const schema=z.object({chapterId:z.string().min(10).nullable().optional(),expectedVersion:z.string().datetime().optional(),content:z.string().trim().min(3).max(10000).optional(),category:z.enum(["CONTENT","FACT","CITATION","LANGUAGE","ACCESSIBILITY","COPYRIGHT","PEDAGOGY"]).optional(),severity:z.enum(["SUGGESTION","MAJOR","CRITICAL"]).optional(),status:z.enum(["OPEN","RESOLVED"]).optional()}).strict().refine(x=>Object.keys(x).length>0);
async function owned(req:NextRequest,id:string,tx:Prisma.TransactionClient){
 const initial=await tx.reviewerNote.findUnique({where:{id}});
 if(!initial)return null;
 await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${initial.bookId} FOR UPDATE`;
 const note=await tx.reviewerNote.findUnique({where:{id}});
 if(!note)return null;
 const access=await reviewerAccess(req,note.bookId,tx);
 return access?.actor.id===note.reviewerId?{note,access}:null;
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const {id}=await params;const p=schema.safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:"Invalid input"},{status:400});
 return db.$transaction(async tx=>{
 const found=await owned(req,id,tx);if(!found)return NextResponse.json({error:"Not found"},{status:404});
 if(found.access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 if(p.data.expectedVersion&&found.note.updatedAt.toISOString()!==p.data.expectedVersion)return NextResponse.json({error:"Catatan sudah berubah di sesi lain. Muat ulang dahulu."},{status:409});
 if(p.data.chapterId&&!await tx.chapter.findFirst({where:{id:p.data.chapterId,bookId:found.note.bookId,archivedAt:null}}))return NextResponse.json({error:"Bab tidak ditemukan atau telah diarsipkan"},{status:400});
 const {expectedVersion,...patch}=p.data;
 await tx.review.create({data:{bookId:found.note.bookId,decision:"note:update",note:JSON.stringify({id,previous:found.note,actor:found.access.actor.id})}});
 return NextResponse.json({note:await tx.reviewerNote.update({where:{id},data:patch})});
 });
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const {id}=await params;return db.$transaction(async tx=>{const found=await owned(req,id,tx);if(!found)return NextResponse.json({error:"Not found"},{status:404});
 if(found.access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 await tx.review.create({data:{bookId:found.note.bookId,decision:"note:remove",note:JSON.stringify({previous:found.note,actor:found.access.actor.id})}});
 await tx.reviewerNote.delete({where:{id}});return NextResponse.json({deleted:true});
 });
}
