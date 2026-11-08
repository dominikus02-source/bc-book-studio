import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../../../../lib/db";
import {identity,deny} from "../../../../../../../../lib/auth";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;chapterId:string;sectionId:string}>};
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
const edit=z.object({
 expectedVersion:z.string().datetime({offset:true}),
 title:z.string().trim().min(2).max(180).optional(),
 objective:z.string().trim().min(2).max(1500).optional(),
 content:z.string().max(12000).optional(),
 genreTarget:z.enum(["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"]).optional(),
 accessTier:z.enum(["PUBLIC","PREMIUM","DRAFT"]).optional(),
 parentId:z.string().min(4).max(100).nullable().optional(),
 position:z.number().int().min(1).max(500).optional(),
 restore:z.boolean().optional(),
 restoreRevision:z.string().min(4).max(100).optional()
}).strict();
async function change(req:NextRequest,{params}:Ctx,archive:boolean){
 const actor=await identity(req);if(!actor)return deny();
 const {id,chapterId,sectionId}=await params;
 const parsed=edit.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("expectedVersion and valid section changes required",428);
 if(!archive&&Object.keys(parsed.data).every(k=>k==="expectedVersion"))return fail("No changes supplied",400);
 const {expectedVersion,...data}=parsed.data;
 return db.$transaction(async tx=>{
  const [book]=await tx.$queryRaw<{id:string;status:string;editorialStage:string}[]>`SELECT id,status,"editorialStage" FROM "Book" WHERE id=${id} AND "ownerId"=${actor} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!book)return fail("Not found",404);
  if(book.status!=="DRAFT"||!["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))return fail("Outline locked",409);
  const section=await tx.outlineSection.findFirst({where:{id:sectionId,bookId:id,chapterId,chapter:{archivedAt:null}}});
  if(!section)return fail("Section not found",404);
  if(section.updatedAt.getTime()!==new Date(expectedVersion).getTime())return fail("Section changed; reload before saving",409,"SECTION_VERSION_CONFLICT");
  if(archive){
   if(section.archivedAt)return fail("Already archived",409);
   const children=await tx.outlineSection.count({where:{parentId:sectionId,archivedAt:null}});
   if(children)return fail("Archive child sections first",409);
   const updated=await tx.outlineSection.update({where:{id:sectionId},data:{archivedAt:new Date(),updatedAt:new Date(Math.max(Date.now(),section.updatedAt.getTime()+1))}});
   await tx.outlineSectionRevision.create({data:{sectionId,actorId:actor,action:"ARCHIVE",snapshot:{title:section.title,objective:section.objective,content:section.content,genreTarget:section.genreTarget,accessTier:section.accessTier,position:section.position,parentId:section.parentId}}});
   return NextResponse.json({archived:true,section:updated});
  }
  if(data.restore){
   if(!section.archivedAt)return fail("Not archived",409);
   if(section.parentId){
    const parent=await tx.outlineSection.findFirst({where:{id:section.parentId,bookId:id,chapterId,archivedAt:null}});
    if(!parent)return fail("Restore parent section first",409);
   }
   const updated=await tx.outlineSection.update({where:{id:sectionId},data:{archivedAt:null,updatedAt:new Date(Math.max(Date.now(),section.updatedAt.getTime()+1))}});
   await tx.outlineSectionRevision.create({data:{sectionId,actorId:actor,action:"RESTORE",snapshot:{title:updated.title,objective:updated.objective,parentId:updated.parentId}}});
   return NextResponse.json({section:updated});
  }
  if(section.archivedAt)return fail("Section archived",409);
  if(data.restoreRevision){
   const rev=await tx.outlineSectionRevision.findFirst({where:{id:data.restoreRevision,sectionId}});
   if(!rev)return fail("Revision not found",404);
   const old=rev.snapshot as {title?:unknown;objective?:unknown;content?:unknown;genreTarget?:unknown;accessTier?:unknown};
   if(typeof old.title!=="string"||typeof old.objective!=="string")return fail("Revision snapshot invalid",409);
   const updated=await tx.outlineSection.update({where:{id:sectionId},data:{title:old.title,objective:old.objective,...(typeof old.content==="string"?{content:old.content}:{}),...(typeof old.genreTarget==="string"?{genreTarget:old.genreTarget}:{}),...(typeof old.accessTier==="string"?{accessTier:old.accessTier}:{}),updatedAt:new Date(Math.max(Date.now(),section.updatedAt.getTime()+1))}});
   await tx.outlineSectionRevision.create({data:{sectionId,actorId:actor,action:"RESTORE_REVISION",snapshot:{title:section.title,objective:section.objective,content:section.content,genreTarget:section.genreTarget,accessTier:section.accessTier,position:section.position,parentId:section.parentId}}});
   return NextResponse.json({section:updated});
  }
  if(data.parentId!==undefined&&data.parentId!==section.parentId){
   const activeChildCount=await tx.outlineSection.count({where:{parentId:sectionId,archivedAt:null}});
   if(activeChildCount)return fail("Move child sections first",409);
   if(data.parentId!==null){
    const parent=await tx.outlineSection.findFirst({where:{id:data.parentId,bookId:id,chapterId,archivedAt:null,parentId:null}});
    if(!parent||parent.id===sectionId)return fail("Invalid parent or circular hierarchy",400);
   }
  }
  if(data.position!==undefined||data.parentId!==undefined)return fail("Use the dedicated reorder API for structural moves",400);
  const updated=await tx.outlineSection.update({where:{id:sectionId},data:{title:data.title??section.title,objective:data.objective??section.objective,content:data.content??section.content,genreTarget:data.genreTarget??section.genreTarget,accessTier:data.accessTier??section.accessTier,updatedAt:new Date(Math.max(Date.now(),section.updatedAt.getTime()+1))}});
  await tx.outlineSectionRevision.create({data:{sectionId,actorId:actor,action:"UPDATE",snapshot:{title:section.title,objective:section.objective,content:section.content,genreTarget:section.genreTarget,accessTier:section.accessTier,position:section.position,parentId:section.parentId}}});
  return NextResponse.json({section:updated});
 });
}
export async function PATCH(req:NextRequest,ctx:Ctx){return change(req,ctx,false)}
export async function DELETE(req:NextRequest,ctx:Ctx){return change(req,ctx,true)}
