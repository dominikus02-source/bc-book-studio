import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {managerLockSql} from "../../../../../lib/draft-access";
import {adminOverrideNote} from "../../../../../lib/admin-override";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest,{params}:Ctx){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const parsed=z.object({expectedVersion:z.string().datetime({offset:true})}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("Versi arsip wajib diisi.",428,"BOOK_VERSION_REQUIRED");
 return db.$transaction(async tx=>{
  await tx.$queryRaw(managerLockSql(id,actor.id));
  const book=await tx.book.findFirst({where:actor.role==="SUPERADMIN"?{id}:{id,ownerId:actor.id}});
  if(!book)return fail("Book not found",404);
  if(!book.archivedAt||book.status!=="DRAFT")return fail("Only archived drafts can be restored",409);
  if(book.updatedAt.getTime()!==new Date(parsed.data.expectedVersion).getTime())return fail("Arsip telah berubah. Muat ulang daftar arsip.",409,"BOOK_VERSION_CONFLICT");
  const updated=await tx.book.update({where:{id},data:{archivedAt:null}});
  await tx.review.create({data:{bookId:id,decision:"brief:restore",note:adminOverrideNote(actor,book.ownerId,"Actor: "+actor.id)}});
  return NextResponse.json({restored:true,book:updated},{headers:{"Cache-Control":"no-store"}});
 });
}
