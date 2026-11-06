import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../../lib/db";
import { identity, deny } from "../../../../../../lib/auth";
export const runtime = "nodejs";
type Ctx = {params:Promise<{id:string;chapterId:string}>};
const schema=z.object({title:z.string().trim().min(2).max(180),content:z.string().trim().min(20).max(200000)}).strict();
const result=(error:string,status:number)=>NextResponse.json({error},{status});
export async function GET(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id,chapterId}=await params;
 const c=await db.chapter.findFirst({where:{id:chapterId,bookId:id,book:{ownerId}},include:{revisions:{orderBy:{revision:"desc"},take:50}}});
 return c?NextResponse.json({chapter:c},{headers:{"Cache-Control":"no-store"}}):result("Not found",404);
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id,chapterId}=await params;
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return result("Invalid chapter input",400);
 return db.$transaction(async tx=>{
  const c=await tx.chapter.findFirst({where:{id:chapterId,bookId:id,book:{ownerId}} ,include:{book:true}});
  if(!c)return result("Not found",404);
  if(c.book.status!=="DRAFT")return result("Draft only",409);
  if(c.title===parsed.data.title&&c.content===parsed.data.content)return NextResponse.json({chapter:c,unchanged:true});
  const latest=await tx.chapterRevision.aggregate({where:{chapterId},_max:{revision:true}});
  await tx.chapterRevision.create({data:{chapterId,title:c.title,content:c.content,revision:(latest._max.revision??0)+1}});
  const chapter=await tx.chapter.update({where:{id:chapterId},data:parsed.data});
  return NextResponse.json({chapter});
 });
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id,chapterId}=await params;
 return db.$transaction(async tx=>{
  const book=await tx.book.findFirst({where:{id,ownerId},select:{status:true}});
  if(!book)return result("Not found",404);
  if(book.status!=="DRAFT")return result("Draft only",409);
  const deleted=await tx.chapter.deleteMany({where:{id:chapterId,bookId:id}});
  if(!deleted.count)return result("Not found",404);
  const rest=await tx.chapter.findMany({where:{bookId:id},orderBy:{position:"asc"},select:{id:true}});
  for(let i=0;i<rest.length;i++)await tx.chapter.update({where:{id:rest[i].id},data:{position:-1-i}});
  for(let i=0;i<rest.length;i++)await tx.chapter.update({where:{id:rest[i].id},data:{position:i+1}});
  return NextResponse.json({deleted:true});
 });
}
