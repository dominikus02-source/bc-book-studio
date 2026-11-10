import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {approvedManuscript} from "../../../../../lib/approval-snapshot";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {packageSchema,publishingDefaults,publishingFields} from "../../../../../lib/publishing-package";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
const moduleFor=(id:string)=>"PUBLISHING_PACKAGE:"+id;
const headers={"Cache-Control":"no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
async function source(id:string,ownerId:string){
 return db.book.findFirst({where:{id,archivedAt:null,OR:[{ownerId},{assignedReviewers:{some:{reviewerId:ownerId}}}]},select:{
 id:true,ownerId:true,approvedAt:true,status:true,updatedAt:true,title:true,subject:true,grade:true,author:true,genre:true,bookType:true,
 targetAudience:true,writingGoal:true,description:true,
 chapters:{where:{archivedAt:null},orderBy:{position:"asc"},select:{title:true,content:true,outlineObjective:true}}
 }});
}
export async function GET(req:NextRequest,{params}:Context){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await source(id,actor.id);if(!book)return fail("Buku tidak ditemukan.",404);
 const row=await db.studioFormDraft.findFirst({where:{ownerId:book.ownerId,module:moduleFor(id)},orderBy:{updatedAt:"desc"}});
 const defaults=publishingDefaults(book);
 const existing=packageSchema.partial().safeParse(row?.payload);
 const merged=Object.fromEntries(publishingFields.map(field=>[field,existing.success?existing.data[field]??defaults[field]:defaults[field]]));
 const snapshot=book.status==="APPROVED"?await approvedManuscript(db,book):null;
 const data=snapshot?.publishingPackage??packageSchema.parse(merged);
 const missingFields=publishingFields.filter(field=>!existing.success||typeof existing.data[field]!=="string");
 return NextResponse.json({snapshotComplete:Boolean(snapshot),snapshotId:snapshot?book.id+":"+book.approvedAt!.toISOString():null,data,defaults,saved:Boolean(existing.success),missingFields,updatedAt:row?.updatedAt?.toISOString()??null,sourceUpdatedAt:book.updatedAt.toISOString(),sourceChapters:book.chapters.map(c=>({title:c.title,outlineObjective:c.outlineObjective})),status:book.status},{headers});
}
const writeSchema=z.object({data:packageSchema,expectedVersion:z.string().datetime({offset:true}).nullable(),sourceUpdatedAt:z.string().datetime({offset:true}).optional()}).strict();
export async function PUT(req:NextRequest,{params}:Context){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await source(id,actor.id);if(!book)return fail("Buku tidak ditemukan.",404);
 if(book.ownerId!==actor.id)return fail("Buku tidak ditemukan.",404);
 if(book.status!=="DRAFT")return fail("Paket penerbitan hanya dapat disunting saat DRAFT.",409);
 const parsed=writeSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("Data paket penerbitan atau versi penyimpanan tidak valid.",400);
 const {data,expectedVersion,sourceUpdatedAt}=parsed.data;
 if(sourceUpdatedAt&&sourceUpdatedAt!==book.updatedAt.toISOString())return fail("Data buku telah berubah; muat ulang konteks sebelum menyimpan.",409);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${actor.id} FOR UPDATE`;
  const locked=await tx.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null}});
  if(!locked)return fail("Buku tidak ditemukan.",404);
  if(locked.status!=="DRAFT")return fail("Paket terkunci selama review atau setelah persetujuan.",409);
  if(sourceUpdatedAt&&sourceUpdatedAt!==locked.updatedAt.toISOString())return fail("Konteks buku berubah. Muat ulang.",409);
  const current=await tx.studioFormDraft.findFirst({where:{ownerId:actor.id,module:moduleFor(id)},orderBy:{updatedAt:"desc"}});
  if(current){
   if(!expectedVersion||current.updatedAt.toISOString()!==expectedVersion)return fail("Versi paket berubah di tempat lain. Muat ulang agar tidak menimpa pekerjaan pengguna.",409);
   const result=await tx.studioFormDraft.updateMany({where:{id:current.id,updatedAt:current.updatedAt},data:{payload:data,title:"Paket penerbitan "+id}});
   if(result.count!==1)return fail("Konflik revisi; paket belum tersimpan.",409);
  }else{
   if(expectedVersion)return fail("Paket di server berubah; muat ulang.",409);
   await tx.studioFormDraft.create({data:{ownerId:actor.id,module:moduleFor(id),title:"Paket penerbitan "+id,payload:data}});
  }
  const persisted=await tx.studioFormDraft.findFirst({where:{ownerId:actor.id,module:moduleFor(id)},orderBy:{updatedAt:"desc"}});
  return NextResponse.json({saved:true,updatedAt:persisted?.updatedAt.toISOString(),sourceUpdatedAt:book.updatedAt.toISOString()},{headers});
 });
}
