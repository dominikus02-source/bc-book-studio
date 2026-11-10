import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../../../../lib/db";
import {identity,deny} from "../../../../../../../../lib/auth";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;chapterId:string}>};
const input=z.object({parentId:z.string().min(4).max(100).nullable(),ids:z.array(z.string().min(4).max(100)).min(1).max(500),expectedOrder:z.array(z.string().min(4).max(100)).min(1).max(500)}).strict();
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function PATCH(req:NextRequest,{params}:Ctx){
 const actor=await identity(req);if(!actor)return deny();
 const {id,chapterId}=await params;
 const data=await req.json().catch(()=>null);
 if(!data||!Object.prototype.hasOwnProperty.call(data,"expectedOrder"))return fail("expectedOrder is required",428);
 const parsed=input.safeParse(data);if(!parsed.success)return fail("Invalid reorder payload",400);
 const {ids,expectedOrder,parentId}=parsed.data;
 if(new Set(ids).size!==ids.length||new Set(expectedOrder).size!==expectedOrder.length)return fail("Duplicate ids",400);
 return db.$transaction(async tx=>{
  const [book]=await tx.$queryRaw<{id:string;status:string;editorialStage:string}[]>`SELECT id,status,"editorialStage" FROM "Book" WHERE id=${id} AND "ownerId"=${actor} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!book)return fail("Not found",404);
  if(book.status!=="DRAFT"||!["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))return fail("Outline locked",409);
  const chapter=await tx.chapter.findFirst({where:{id:chapterId,bookId:id,archivedAt:null}});
  if(!chapter)return fail("Chapter not found",404);
  const rows=await tx.outlineSection.findMany({where:{bookId:id,chapterId,parentId,archivedAt:null},orderBy:[{position:"asc"},{createdAt:"asc"}]});
  const order=rows.map(x=>x.id);
  if(order.length!==ids.length||order.some(x=>!ids.includes(x)))return fail("Sections changed",409);
  if(order.some((x,i)=>x!==expectedOrder[i]))return fail("Stale order; reload",409);
  if(order.every((x,i)=>x===ids[i]))return NextResponse.json({ordered:true,unchanged:true});
  for(let i=0;i<ids.length;i++){
   const section=rows.find(x=>x.id===ids[i])!;
   await tx.outlineSection.update({where:{id:section.id},data:{position:i+1,updatedAt:new Date(Math.max(Date.now(),section.updatedAt.getTime()+1))}});
   await tx.outlineSectionRevision.create({data:{sectionId:section.id,actorId:actor,action:"REORDER",snapshot:{title:section.title,objective:section.objective,position:section.position,parentId}}});
  }
  return NextResponse.json({ordered:true});
 });
}
