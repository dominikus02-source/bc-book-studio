import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../../lib/db";
import {identity,deny} from "../../../../../../lib/auth";
export const runtime="nodejs";
const schema=z.object({
 ids:z.array(z.string().min(1).max(100)).min(1).max(500),
 expectedOrder:z.array(z.string().min(1).max(100)).min(1).max(500),
}).strict();
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const input=await req.json().catch(()=>null);
 if(!input||!Object.prototype.hasOwnProperty.call(input,"expectedOrder"))return fail("Muat urutan terbaru sebelum mengubah kerangka.",428,"ORDER_VERSION_REQUIRED");
 const parsed=schema.safeParse(input);
 if(!parsed.success)return fail("Invalid order",400);
 const {ids,expectedOrder}=parsed.data;
 if(new Set(ids).size!==ids.length||new Set(expectedOrder).size!==expectedOrder.length)return fail("Duplicate chapter ID",400);
 return db.$transaction(async tx=>{
  const [locked]=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!locked)return fail("Book not found",404);
  const book=await tx.book.findFirst({where:{id,ownerId,archivedAt:null},select:{status:true,editorialStage:true}});
  if(!book)return fail("Book not found",404);
  if(book.status!=="DRAFT"||!["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))return fail("Outline is not editable",409);
  const chapters=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},select:{id:true,position:true},orderBy:[{position:"asc"},{id:"asc"}]});
  const current=chapters.map(ch=>ch.id);
  if(current.length!==ids.length||current.some(ch=>!ids.includes(ch)))return fail("Chapter mismatch. Reload the outline.",409,"ORDER_VERSION_CONFLICT");
  if(current.length!==expectedOrder.length||current.some((ch,i)=>ch!==expectedOrder[i]))return fail("Urutan kerangka berubah pada sesi lain. Muat ulang sebelum mengurutkan.",409,"ORDER_VERSION_CONFLICT");
  if(current.every((ch,i)=>ch===ids[i]))return NextResponse.json({ordered:true,unchanged:true});
  const tail=await tx.chapter.aggregate({where:{bookId:id},_min:{position:true}});
  const temporary=Math.min(0,tail._min.position??0)-1;
  for(let i=0;i<chapters.length;i++)await tx.chapter.update({where:{id:chapters[i].id},data:{position:temporary-i}});
  for(let i=0;i<ids.length;i++)await tx.chapter.update({where:{id:ids[i]},data:{position:i+1}});
  await tx.review.create({data:{bookId:id,decision:"outline:reorder",note:"Actor: "+ownerId+"; from: "+current.join(",")+"; to: "+ids.join(",")}});
  return NextResponse.json({ordered:true},{headers:{"Cache-Control":"no-store"}});
 });
}
