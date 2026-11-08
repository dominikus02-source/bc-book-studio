import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {DEFAULT_PAGINATION,paginationSchema} from "../../../../../lib/book-pagination";

type Ctx={params:Promise<{id:string}>};
const noStore={"Cache-Control":"no-store"};
const failure=(error:string,status:number)=>NextResponse.json({error},{status,headers:noStore});
const patch=z.object({expectedVersion:z.number().int().nonnegative(),settings:paginationSchema}).strict();

export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true}});
 if(!book)return failure("Buku tidak ditemukan.",404);
 const record=await db.bookPagination.findUnique({where:{bookId:id}});
 const parsed=paginationSchema.safeParse(record?.settings);
 return NextResponse.json({settings:parsed.success?parsed.data:DEFAULT_PAGINATION,version:record?.version??0,saved:Boolean(record)}, {headers:noStore});
}

export async function PATCH(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const parsed=patch.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return failure("Pengaturan pagination tidak valid.",400);
 const {id}=await params;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
  if(!book)return failure("Buku tidak ditemukan.",404);
  if(book.publication&&!book.publication.unpublishedAt)return failure("Tarik publikasi aktif sebelum mengubah pagination.",409);
  const prev=await tx.bookPagination.findUnique({where:{bookId:id}});
  if((prev?.version??0)!==parsed.data.expectedVersion)return failure("Konflik versi. Muat ulang.",409);
  const version=(prev?.version??0)+1;
  await tx.bookPagination.upsert({where:{bookId:id},create:{bookId:id,settings:parsed.data.settings,version},update:{settings:parsed.data.settings,version}});
  return NextResponse.json({saved:true,version,settings:parsed.data.settings},{headers:noStore});
 });
}

export async function DELETE(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},include:{publication:true}});
  if(!book)return failure("Buku tidak ditemukan.",404);
  if(book.publication&&!book.publication.unpublishedAt)return failure("Buku sedang diterbitkan.",409);
  await tx.bookPagination.deleteMany({where:{bookId:id}});
  return NextResponse.json({settings:DEFAULT_PAGINATION,version:0,saved:false},{headers:noStore});
 });
}
