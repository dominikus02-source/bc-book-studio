import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../lib/auth";
import {manuscriptVisibilityWhere} from "../../../../../../lib/manuscript-access";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;assetId:string}>};
const error=(message:string,status:number,code?:string)=>NextResponse.json({error:message,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
const update=z.object({
 expectedVersion:z.string().datetime({offset:true}),
 name:z.string().trim().min(1).max(150).optional(),
 altText:z.string().trim().min(5).max(250).optional(),
 license:z.enum(["OWNED","CC0","CC_BY","CC_BY_SA","LICENSED"]).optional(),
 sourceUrl:z.string().url().max(500).startsWith("https://").nullable().optional(),
 restore:z.literal(true).optional(),
}).strict();
const metadata=(a:{name:string;altText:string;license:string;sourceUrl:string|null;archivedAt:Date|null})=>({name:a.name,altText:a.altText,license:a.license,sourceUrl:a.sourceUrl,archivedAt:a.archivedAt?.toISOString()||null});
export async function GET(req:NextRequest,{params}:Ctx){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id,assetId}=await params;
 const where=manuscriptVisibilityWhere(actor,{id});
 const book=await db.book.findFirst({where,select:{id:true}});if(!book)return error("Not found",404);
 const asset=await db.bookAsset.findFirst({where:{id:assetId,bookId:id,archivedAt:null}});
 if(!asset)return error("Not found",404);
 return new NextResponse(Buffer.from(asset.bytes),{headers:{"Content-Type":asset.mime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline"}});
}
async function mutate(req:NextRequest,{params}:Ctx,archive:boolean){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id,assetId}=await params;
 const parsed=update.safeParse(await req.json().catch(()=>null));if(!parsed.success)return error("A valid expectedVersion is required",428);
 if(!archive&&Object.keys(parsed.data).every(k=>k==="expectedVersion"))return error("No changes supplied",400);
 return db.$transaction(async tx=>{
  const [book]=await tx.$queryRaw<{id:string;status:string}[]>`SELECT id,status FROM "Book" WHERE id=${id} AND "ownerId"=${actor.id} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!book)return error("Not found",404);
  if(book.status!=="DRAFT")return error("Draft assets only",409);
  const a=await tx.bookAsset.findFirst({where:{id:assetId,bookId:id}});if(!a)return error("Asset not found",404);
  if(a.updatedAt.getTime()!==new Date(parsed.data.expectedVersion).getTime())return error("Asset version changed; reload before editing",409,"ASSET_VERSION_CONFLICT");
  const now=new Date(Math.max(Date.now(),a.updatedAt.getTime()+1));
  if(archive){
   if(a.archivedAt)return error("Already archived",409);
   const chapters=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},select:{content:true}});
   const linked=chapters.some(ch=>ch.content.includes("(asset:"+assetId+")"));
   if(linked)return error("Remove this image from active chapters before archiving it",409);
   const asset=await tx.bookAsset.update({where:{id:assetId},data:{archivedAt:now,updatedAt:now}});
   await tx.bookAssetRevision.create({data:{assetId,actorId:actor.id,action:"ARCHIVE",metadata:metadata(a)}});
   return NextResponse.json({archived:true,asset:{id:asset.id,updatedAt:asset.updatedAt}});
  }
  if(parsed.data.restore){
   if(!a.archivedAt)return error("Asset already active",409);
   const asset=await tx.bookAsset.update({where:{id:assetId},data:{archivedAt:null,updatedAt:now}});
   await tx.bookAssetRevision.create({data:{assetId,actorId:actor.id,action:"RESTORE",metadata:metadata(a)}});
   return NextResponse.json({asset:{id:asset.id,updatedAt:asset.updatedAt}});
  }
  if(a.archivedAt)return error("Asset archived",409);
  const next={name:parsed.data.name??a.name,altText:parsed.data.altText??a.altText,license:parsed.data.license??a.license,sourceUrl:parsed.data.sourceUrl===undefined?a.sourceUrl:parsed.data.sourceUrl};
  if(JSON.stringify(next)===JSON.stringify({name:a.name,altText:a.altText,license:a.license,sourceUrl:a.sourceUrl}))return NextResponse.json({asset:{id:a.id,updatedAt:a.updatedAt},unchanged:true});
  const asset=await tx.bookAsset.update({where:{id:assetId},data:{...next,updatedAt:now}});
  await tx.bookAssetRevision.create({data:{assetId,actorId:actor.id,action:"UPDATE",metadata:metadata(a)}});
  return NextResponse.json({asset:{id:asset.id,updatedAt:asset.updatedAt}});
 });
}
export async function PATCH(req:NextRequest,ctx:Ctx){return mutate(req,ctx,false)}
export async function DELETE(req:NextRequest,ctx:Ctx){return mutate(req,ctx,true)}
