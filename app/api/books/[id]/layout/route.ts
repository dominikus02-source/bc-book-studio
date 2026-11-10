import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {approvedManuscript} from "../../../../../lib/approval-snapshot";
import {layoutSettings,storedLayout,validLayout,layoutBlocks} from "../../../../../lib/book-layout";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const identity={snapshot:z.iso.datetime({precision:3}),expectedVersion:z.number().int().nonnegative()};
const input=z.union([z.object({...identity,settings:layoutSettings.nullable()}).strict(),z.object({...identity,restoreVersion:z.number().int().positive()}).strict()]);
export async function GET(req:NextRequest,{params}:Context){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
 if(!book)return fail("Buku tidak ditemukan.",404);
 if(book.status!=="APPROVED"||!book.approvedAt)return fail("Selesaikan Review sebelum mengatur tata letak.",409);
 const source=await approvedManuscript(db,book);if(!source)return fail("Snapshot lengkap belum tersedia; buat revisi dan review ulang.",409);
 const saved=await storedLayout(db,id,book.approvedAt,source.chapters);
 const history=await db.bookLayoutRevision.findMany({where:{bookId:id,approvedAt:book.approvedAt},orderBy:{version:"desc"},take:50,select:{version:true,archivedAt:true,createdAt:true}});
 return NextResponse.json({snapshot:book.approvedAt.toISOString(),version:saved.version,saved:Boolean(saved.settings),locked:Boolean(book.publication&&!book.publication.unpublishedAt),
  chapters:source.chapters.map(({position,title,content})=>({position,title,excerpt:content.slice(0,420),blocks:layoutBlocks(content).map(({index,kind,excerpt})=>({index,kind,excerpt}))})),
  settings:saved.settings??{pageSize:["A4","A5","B5"].includes(source.pageSize)?source.pageSize:"A4",order:source.chapters.map(c=>c.position)},history},{headers});
}
export async function PATCH(req:NextRequest,{params}:Context){
 const user=await sessionUser(req);if(!user)return deny();
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Konfigurasi tata letak tidak valid.",400);
 const {id}=await params,{snapshot,expectedVersion}=parsed.data;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
  if(!book)return fail("Buku tidak ditemukan.",404);
  if(book.status!=="APPROVED"||!book.approvedAt||book.approvedAt.toISOString()!==snapshot)return fail("Persetujuan berubah. Muat ulang tanpa menimpa perubahan lokal.",409);
  if(book.publication&&!book.publication.unpublishedAt)return fail("Tarik publikasi aktif sebelum mengubah tata letak.",409);
  const source=await approvedManuscript(tx,book);if(!source)return fail("Snapshot lengkap belum tersedia.",409);
  const saved=await storedLayout(tx,id,book.approvedAt,source.chapters);
  if(saved.version!==expectedVersion)return fail("Versi tata letak berubah. Perubahan lokal belum disimpan.",409);
  let settings;
  if("restoreVersion" in parsed.data){
   const previous=await tx.bookLayoutRevision.findUnique({where:{bookId_approvedAt_version:{bookId:id,approvedAt:book.approvedAt,version:parsed.data.restoreVersion}}});
   if(!previous)return fail("Versi tata letak tidak ditemukan.",404);
   const value=layoutSettings.safeParse(previous.settings);if(!value.success)return fail("Versi lama tidak valid.",409);
   settings=previous.archivedAt?null:value.data;
  }else settings=parsed.data.settings;
  if(settings&&!validLayout(settings,source.chapters))return fail("Urutan harus memuat seluruh bab dan blok snapshot tepat satu kali.",400);
  if(!settings&&!saved.storedSettings)return fail("Belum ada tata letak untuk diarsipkan.",409);
  if(saved.version&&saved.storedSettings)await tx.bookLayoutRevision.upsert({where:{bookId_approvedAt_version:{bookId:id,approvedAt:book.approvedAt,version:saved.version}},update:{},create:{bookId:id,approvedAt:book.approvedAt,version:saved.version,settings:saved.storedSettings,archivedAt:saved.archivedAt,actorId:"LEGACY_UNKNOWN"}});
  const version=saved.version+1,archivedAt=settings?null:new Date(),stored=settings??saved.storedSettings!;
  await tx.bookLayout.upsert({where:{bookId_approvedAt:{bookId:id,approvedAt:book.approvedAt}},create:{bookId:id,approvedAt:book.approvedAt,version,settings:stored,archivedAt},update:{version,settings:stored,archivedAt}});
  await tx.bookLayoutRevision.create({data:{bookId:id,approvedAt:book.approvedAt,version,settings:stored,archivedAt,actorId:user.id}});
  await tx.review.create({data:{bookId:id,decision:"restoreVersion" in parsed.data?"layout:restore":settings?"layout:save":"layout:archive",note:"Versi "+version+" oleh "+user.id}});
  return NextResponse.json({version,saved:Boolean(settings),settings},{headers});
 });
}
