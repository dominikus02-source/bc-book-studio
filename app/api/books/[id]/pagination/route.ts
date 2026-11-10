import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import type {PaginationSettings} from "../../../../../lib/book-pagination";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {DEFAULT_PAGINATION,paginationSchema} from "../../../../../lib/book-pagination";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const noStore={"Cache-Control":"no-store"};
const failure=(error:string,status:number)=>NextResponse.json({error},{status,headers:noStore});
const version=z.number().int().nonnegative();
const patch=z.union([z.object({expectedVersion:version,settings:paginationSchema}).strict(),z.object({expectedVersion:version,restoreVersion:z.number().int().positive()}).strict()]);
export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();const {id}=await params;
 if(!await db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true}}))return failure("Buku tidak ditemukan.",404);
 const record=await db.bookPagination.findUnique({where:{bookId:id}}),parsed=paginationSchema.safeParse(record?.settings);
 const history=await db.bookPaginationRevision.findMany({where:{bookId:id},orderBy:{version:"desc"},take:50,select:{version:true,action:true,archivedAt:true,createdAt:true}});
 return NextResponse.json({settings:parsed.success?parsed.data:DEFAULT_PAGINATION,version:record?.version??0,saved:Boolean(record&&!record.archivedAt),history},{headers:noStore});
}
async function mutate(req:NextRequest,{params}:Ctx,reset:boolean){
 const user=await sessionUser(req);if(!user)return deny();const {id}=await params;
 const raw=await req.json().catch(()=>null);
 if(!raw||typeof raw.expectedVersion!=="number")return failure("Versi pengaturan wajib diisi.",428);
 const parsed=reset?z.object({expectedVersion:version}).strict().safeParse(raw):patch.safeParse(raw);
 if(!parsed.success)return failure("Pengaturan pagination tidak valid.",400);
 const value=parsed.data as {expectedVersion:number;restoreVersion?:number;settings?:PaginationSettings};
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
  if(!book)return failure("Buku tidak ditemukan.",404);
  if(book.publication&&!book.publication.unpublishedAt)return failure("Tarik publikasi aktif sebelum mengubah pagination.",409);
  const prev=await tx.bookPagination.findUnique({where:{bookId:id}});
  if((prev?.version??0)!==value.expectedVersion)return failure("Konflik versi. Perubahan lokal belum disimpan.",409);
  let settings=DEFAULT_PAGINATION,archivedAt:Date|null=reset?new Date():null,action=reset?"RESET":"SAVE";
  if(typeof value.restoreVersion==="number"){
   const old=await tx.bookPaginationRevision.findUnique({where:{bookId_version:{bookId:id,version:value.restoreVersion}}});if(!old)return failure("Riwayat pagination tidak ditemukan.",404);
   const p=paginationSchema.safeParse(old.settings);if(!p.success)return failure("Riwayat tidak valid.",409);
   settings=p.data;archivedAt=old.archivedAt;action="RESTORE";
  }else if(value.settings)settings=value.settings;
  if(prev)await tx.bookPaginationRevision.upsert({where:{bookId_version:{bookId:id,version:prev.version}},update:{},create:{bookId:id,version:prev.version,settings:prev.settings===null?Prisma.JsonNull:prev.settings,archivedAt:prev.archivedAt,actorId:"LEGACY_UNKNOWN",action:"BASELINE"}});
  const nextVersion=(prev?.version??0)+1;
  await tx.bookPagination.upsert({where:{bookId:id},create:{bookId:id,settings,version:nextVersion,archivedAt},update:{settings,version:nextVersion,archivedAt}});
  await tx.bookPaginationRevision.create({data:{bookId:id,version:nextVersion,settings,archivedAt,actorId:user.id,action}});
  await tx.review.create({data:{bookId:id,decision:"pagination:"+action.toLowerCase(),note:"Version "+nextVersion+" by "+user.id}});
  return NextResponse.json({settings,version:nextVersion,saved:!archivedAt},{headers:noStore});
 });
}
export async function PATCH(req:NextRequest,ctx:Ctx){return mutate(req,ctx,false)}
export async function DELETE(req:NextRequest,ctx:Ctx){return mutate(req,ctx,true)}
