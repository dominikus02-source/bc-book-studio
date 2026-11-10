import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../../lib/db";
import { identity, deny } from "../../../../../../lib/auth";
export const runtime = "nodejs";
type Ctx = {params:Promise<{id:string;chapterId:string}>};
const version=z.iso.datetime({precision:3}).optional();
const schema=z.union([
 z.object({title:z.string().trim().min(2).max(180),content:z.string().trim().min(20).max(200000),expectedVersion:version}).strict(),
 z.object({title:z.string().trim().min(2).max(180),outlineObjective:z.string().trim().min(1).max(1500),expectedVersion:version}).strict(),
 z.object({restoreArchived:z.literal(true),expectedVersion:version}).strict(),
 z.object({restoreRevision:z.number().int().positive(),expectedVersion:version}).strict(),
 z.object({restoreOutlineRevision:z.number().int().positive(),expectedVersion:version}).strict(),
]);
const result=(error:string,status:number)=>NextResponse.json({error},{status});
export async function GET(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id,chapterId}=await params;
 const c=await db.chapter.findFirst({where:{id:chapterId,bookId:id,archivedAt:null,book:{ownerId,archivedAt:null}},include:{revisions:{orderBy:{revision:"desc"},take:50}}});
 return c?NextResponse.json({chapter:c},{headers:{"Cache-Control":"no-store"}}):result("Not found",404);
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id,chapterId}=await params;
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return result("Invalid chapter input",400);
 return db.$transaction(async tx=>{
  const [book] = await tx.$queryRaw<{status:string;editorialStage:string}[]>`SELECT status, "editorialStage" FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!book)return result("Not found",404);
  const c=await tx.chapter.findFirst({where:{id:chapterId,bookId:id}});
  if(!c)return result("Not found",404);
  if(book.status!=="DRAFT")return result("Draft only",409);
  const {expectedVersion}=parsed.data;
  if(!expectedVersion)return result("expectedVersion is required; reload the chapter",428);
  const conflict=()=>NextResponse.json({
   code:"CHAPTER_VERSION_CONFLICT",
   error:"Bab telah berubah sejak dibuka. Salin perubahan Anda sebelum memuat versi terbaru.",
  },{status:409});
  if(c.updatedAt.toISOString()!==expectedVersion)return conflict();
  if("restoreArchived" in parsed.data){
   if(!c.archivedAt)return result("Chapter is already active",409);
   const last=await tx.chapter.aggregate({where:{bookId:id,archivedAt:null},_max:{position:true}});
   const updatedAt=new Date(Math.max(Date.now(),c.updatedAt.getTime()+1));
   const chapter=await tx.chapter.update({where:{id:chapterId},data:{archivedAt:null,position:(last._max.position??0)+1,updatedAt}});
   await tx.review.create({data:{bookId:id,decision:"chapter:restore",note:chapterId+" · "+ownerId}});
   return NextResponse.json({chapter});
  }
  if(c.archivedAt)return result("Chapter is archived",409);
  if("restoreOutlineRevision" in parsed.data){
   if(!["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))return result("Outline locked",409);
   const previous=await tx.chapterRevision.findUnique({where:{chapterId_revision:{chapterId,revision:parsed.data.restoreOutlineRevision}}});
   if(!previous||!previous.outlineObjective.trim())return result("Outline revision not found",404);
   const latest=await tx.chapterRevision.aggregate({where:{chapterId},_max:{revision:true}});
   await tx.chapterRevision.create({data:{chapterId,title:c.title,content:c.content,outlineObjective:c.outlineObjective,revision:(latest._max.revision??0)+1}});
   const chapter=await tx.chapter.update({where:{id:chapterId},data:{title:previous.title,outlineObjective:previous.outlineObjective,updatedAt:new Date(Math.max(Date.now(),c.updatedAt.getTime()+1))}});
   await tx.review.create({data:{bookId:id,decision:"outline:restore",note:"Chapter "+chapterId+" revision "+parsed.data.restoreOutlineRevision+" by "+ownerId}});
   return NextResponse.json({chapter});
  }
  if("outlineObjective" in parsed.data){
   if(!["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))return result("Outline only",409);
   if(c.title===parsed.data.title&&c.outlineObjective===parsed.data.outlineObjective)return NextResponse.json({chapter:c,unchanged:true});
   const latest=await tx.chapterRevision.aggregate({where:{chapterId},_max:{revision:true}});
   await tx.chapterRevision.create({data:{chapterId,title:c.title,content:c.content,outlineObjective:c.outlineObjective,revision:(latest._max.revision??0)+1}});
   const updatedAt=new Date(Math.max(Date.now(),c.updatedAt.getTime()+1));
   const chapter=await tx.chapter.update({where:{id:chapterId},data:{title:parsed.data.title,outlineObjective:parsed.data.outlineObjective,updatedAt}});
   return NextResponse.json({chapter});
  }
  const source = "restoreRevision" in parsed.data
   ? await tx.chapterRevision.findUnique({
    where:{chapterId_revision:{chapterId,revision:parsed.data.restoreRevision}},
    select:{title:true,content:true},
   })
   : parsed.data;
  if(!source)return result("Revision not found in this chapter",404);
  const {title,content}=source;
  if(c.title===title&&c.content===content)return NextResponse.json({chapter:c,unchanged:true});
  const updatedAt=new Date(Math.max(Date.now(),c.updatedAt.getTime()+1));
  const updated=await tx.chapter.updateMany({
   where:{id:chapterId,bookId:id,updatedAt:c.updatedAt},
   data:{title,content,updatedAt},
  });
  if(!updated.count)return conflict();
  const latest=await tx.chapterRevision.aggregate({where:{chapterId},_max:{revision:true}});
  await tx.chapterRevision.create({data:{chapterId,title:c.title,content:c.content,outlineObjective:c.outlineObjective,revision:(latest._max.revision??0)+1}});
  const chapter=await tx.chapter.findUniqueOrThrow({where:{id:chapterId}});
  return NextResponse.json({chapter});
 });
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id,chapterId}=await params;
 const parsed=z.object({expectedVersion:z.iso.datetime({precision:3})}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return result("expectedVersion is required before archiving",428);
 return db.$transaction(async tx=>{
  const [book]=await tx.$queryRaw<{status:string}[]>`SELECT status FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!book)return result("Not found",404);
  if(book.status!=="DRAFT")return result("Draft only",409);
  const chapter=await tx.chapter.findFirst({where:{id:chapterId,bookId:id}});
  if(!chapter)return result("Not found",404);
  if(chapter.archivedAt)return NextResponse.json({deleted:true,archived:true});
  if(chapter.updatedAt.toISOString()!==parsed.data.expectedVersion)return NextResponse.json({code:"CHAPTER_VERSION_CONFLICT",error:"Bab berubah. Muat ulang sebelum mengarsipkan."},{status:409});
  const minimum=await tx.chapter.aggregate({where:{bookId:id},_min:{position:true}});
  const now=new Date(Math.max(Date.now(),chapter.updatedAt.getTime()+1));
  await tx.chapter.update({where:{id:chapterId},data:{archivedAt:now,updatedAt:now,position:Math.min(0,minimum._min.position??0)-1}});
  const rest=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},orderBy:{position:"asc"},select:{id:true,position:true}});
  for(const [index,row] of rest.entries()){
   if(row.position!==index+1)await tx.chapter.update({where:{id:row.id},data:{position:index+1}});
  }
  await tx.review.create({data:{bookId:id,decision:"chapter:archive",note:chapterId+" · "+ownerId}});
  return NextResponse.json({deleted:true,archived:true});
 });
}
