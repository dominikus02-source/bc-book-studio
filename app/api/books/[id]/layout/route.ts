import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {approvedManuscript} from "../../../../../lib/approval-snapshot";
import {layoutSettings,storedLayout,validLayout} from "../../../../../lib/book-layout";

type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const input=z.object({snapshot:z.iso.datetime({precision:3}),expectedVersion:z.number().int().nonnegative(),settings:layoutSettings.nullable()}).strict();

export async function GET(req:NextRequest,{params}:Context){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
 if(!book)return fail("Buku tidak ditemukan.",404);
 if(book.status!=="APPROVED"||!book.approvedAt)return fail("Selesaikan Review sebelum mengatur tata letak.",409);
 const source=await approvedManuscript(db,book);
 if(!source)return fail("Snapshot persetujuan belum tersedia.",409);
 const saved=await storedLayout(db,id,book.approvedAt,source.chapters);
 return NextResponse.json({
  snapshot:book.approvedAt.toISOString(),version:saved.version,saved:Boolean(saved.settings),
  locked:Boolean(book.publication&&!book.publication.unpublishedAt),
  chapters:source.chapters.map(({position,title,content})=>({position,title,excerpt:content.slice(0,420)})),
  settings:saved.settings??{pageSize:["A4","A5","B5"].includes(source.pageSize)?source.pageSize:"A4",order:source.chapters.map(chapter=>chapter.position)},
 },{headers});
}

export async function PATCH(req:NextRequest,{params}:Context){
 const user=await sessionUser(req);if(!user)return deny();
 const parsed=input.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("Konfigurasi tata letak tidak valid.",400);
 const {id}=await params;
 const {snapshot,expectedVersion,settings}=parsed.data;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
  if(!book)return fail("Buku tidak ditemukan.",404);
  if(book.status!=="APPROVED"||!book.approvedAt||book.approvedAt.toISOString()!==snapshot)return fail("Persetujuan buku telah berubah. Muat ulang.",409);
  if(book.publication&&!book.publication.unpublishedAt)return fail("Tarik publikasi aktif sebelum mengubah tata letak.",409);
  const source=await approvedManuscript(tx,book);
  if(!source)return fail("Snapshot persetujuan belum tersedia.",409);
  const saved=await storedLayout(tx,id,book.approvedAt,source.chapters);
  if(saved.version!==expectedVersion)return fail("Versi tata letak telah berubah. Muat ulang.",409);
  if(settings&&!validLayout(settings,source.chapters))return fail("Urutan harus memuat setiap bab snapshot tepat satu kali.",400);
  if(!settings&&!saved.settings)return fail("Belum ada tata letak aktif untuk diarsipkan.",409);
  const version=saved.version+1;
  const values={version,settings:settings??saved.settings!,archivedAt:settings?null:new Date()};
  await tx.bookLayout.upsert({
   where:{bookId_approvedAt:{bookId:id,approvedAt:book.approvedAt}},
   create:{bookId:id,approvedAt:book.approvedAt,...values},update:values,
  });
  await tx.review.create({data:{bookId:id,decision:settings?"layout:save":"layout:archive",note:"Versi "+version+" oleh "+user.id}});
  return NextResponse.json({version,saved:Boolean(settings)},{headers});
 });
}
