import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {identity,deny} from "../../../../../lib/auth";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const parsed=z.object({expectedVersion:z.string().datetime({offset:true})}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("Versi arsip wajib diisi.",428,"BOOK_VERSION_REQUIRED");
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId}});
  if(!book)return fail("Book not found",404);
  if(!book.archivedAt||book.status!=="DRAFT")return fail("Only archived drafts can be restored",409);
  if(book.updatedAt.getTime()!==new Date(parsed.data.expectedVersion).getTime())return fail("Arsip telah berubah. Muat ulang daftar arsip.",409,"BOOK_VERSION_CONFLICT");
  const updated=await tx.book.update({where:{id},data:{archivedAt:null}});
  await tx.review.create({data:{bookId:id,decision:"brief:restore",note:"Actor: "+ownerId}});
  return NextResponse.json({restored:true,book:updated},{headers:{"Cache-Control":"no-store"}});
 });
}
