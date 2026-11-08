import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../../../lib/db";
import {identity,deny} from "../../../../../../../lib/auth";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;chapterId:string}>};
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
const input=z.object({title:z.string().trim().min(2).max(180),objective:z.string().trim().min(2).max(1500),parentId:z.string().min(4).max(100).nullable().default(null),content:z.string().max(12000).optional(),genreTarget:z.enum(["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"]).optional(),accessTier:z.enum(["PUBLIC","PREMIUM","DRAFT"]).optional()}).strict();
export async function GET(req:NextRequest,{params}:Ctx){
 const actor=await identity(req);if(!actor)return deny();
 const {id,chapterId}=await params;
 const chapter=await db.chapter.findFirst({where:{id:chapterId,bookId:id,archivedAt:null,book:{ownerId:actor,archivedAt:null}}});
 if(!chapter)return fail("Not found",404);
 const sections=await db.outlineSection.findMany({where:{bookId:id,chapterId},orderBy:[{position:"asc"},{createdAt:"asc"}],include:{revisions:{orderBy:{createdAt:"desc"},take:25}}});
 return NextResponse.json({sections},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const actor=await identity(req);if(!actor)return deny();
 const {id,chapterId}=await params;
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Invalid section",400);
 return db.$transaction(async tx=>{
  const [book]=await tx.$queryRaw<{id:string;status:string;editorialStage:string}[]>`SELECT id,status,"editorialStage" FROM "Book" WHERE id=${id} AND "ownerId"=${actor} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!book)return fail("Not found",404);
  if(book.status!=="DRAFT"||!["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))return fail("Outline is locked",409);
  const chapter=await tx.chapter.findFirst({where:{id:chapterId,bookId:id,archivedAt:null}});if(!chapter)return fail("Chapter not found",404);
  const parentId=parsed.data.parentId;
  if(parentId){
   const parent=await tx.outlineSection.findFirst({where:{id:parentId,bookId:id,chapterId,archivedAt:null,parentId:null}});
   if(!parent)return fail("Parent must be an active top-level section of this chapter",400);
  }
  const existing=await tx.outlineSection.findMany({where:{chapterId,parentId,archivedAt:null},select:{position:true}});
  const position=Math.max(0,...existing.map(x=>x.position))+1;
  const section=await tx.outlineSection.create({data:{bookId:id,chapterId,parentId,position,title:parsed.data.title,objective:parsed.data.objective,content:parsed.data.content||"",genreTarget:parsed.data.genreTarget||"NONFICTION",accessTier:parsed.data.accessTier||"DRAFT"}});
  await tx.outlineSectionRevision.create({data:{sectionId:section.id,actorId:actor,action:"CREATE",snapshot:{title:section.title,objective:section.objective,parentId,position}}});
  return NextResponse.json({section},{status:201});
 });
}
