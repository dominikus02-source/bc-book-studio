import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {manuscriptVisibilityWhere} from "../../../../../lib/manuscript-access";
import {applyLayout,storedLayout} from "../../../../../lib/book-layout";
import {approvedManuscript} from "../../../../../lib/approval-snapshot";
import {publicationReadiness} from "../../../../../lib/publishing-readiness";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const publicationInput=z.union([
 z.object({action:z.literal("publish"),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal("unpublish")}).strict(),
]);
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
export async function GET(req:NextRequest,{params}:Ctx){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:manuscriptVisibilityWhere(actor,{id}),include:{publication:true}});
 if(!book)return fail("Book not found",404);
 const p=book.publication;
 return NextResponse.json({publication:p?{version:p.version,publishedAt:p.publishedAt,unpublishedAt:p.unpublishedAt,publicUrl:p.unpublishedAt?null:"/read/"+id}:null},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const parsed=publicationInput.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("Invalid action or missing publishing confirmation",400);
 const input=parsed.data;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${actor.id} FOR UPDATE`;
  const book=await tx.book.findUnique({where:{id},include:{publication:true,chapters:{where:{archivedAt:null}},publishingEvidence:true}});
  if(!book||book.ownerId!==actor.id||book.archivedAt)return fail("Book not found",404);
  if(input.action==="publish"){
   if(book.status!=="APPROVED"||!book.approvedAt)return fail("Reviewer approval and chapters required",409);
   if(book.publication&&!book.publication.unpublishedAt)return fail("Already published",409);
   const approved = await approvedManuscript(tx,book);
   if (!approved) return fail("Approval snapshot missing; request a new review",409);
   const layout=await storedLayout(tx,id,book.approvedAt,approved.chapters);
   if(!layout.settings)return fail("Simpan tata letak buku sebelum publikasi.",409);
   const preflight=publicationReadiness(book,{saved:true,version:layout.version},true,book.publishingEvidence);
   if(preflight.decision!=="EVIDENCE_REVIEWED_PENDING_INDEPENDENT_RELEASE"){
    const names=preflight.checks.filter(check=>!check.satisfied).map(check=>check.label);
    return fail("NO_GO: persyaratan publikasi belum lengkap. "+[...preflight.problems,...names].slice(0,12).join("; "),409);
   }

   const {title,author,grade,subject,description,bookType,chapters,pageSize,assets,publishingPackage,language}=applyLayout(approved,layout.settings);
   const snapshot={title,author,grade,subject,description,bookType,chapters,pageSize,assets,publishingPackage,language,schemaVersion:2,layoutVersion:layout.version};
   const p=await tx.bookPublication.upsert({where:{bookId:id},create:{bookId:id,publishedById:actor.id,snapshot},update:{publishedById:actor.id,publishedAt:new Date(),unpublishedAt:null,version:{increment:1},snapshot}});
   await tx.review.create({data:{bookId:id,decision:"publish",note:"Publication version "+p.version+" by "+actor.id}});
   return NextResponse.json({publication:{version:p.version,publicUrl:"/read/"+id}});
  }
  if(!book.publication||book.publication.unpublishedAt)return fail("Not published",409);
  await tx.bookPublication.update({where:{bookId:id},data:{unpublishedAt:new Date()}});
  await tx.review.create({data:{bookId:id,decision:"unpublish",note:"Unpublished by "+actor.id}});
  return NextResponse.json({unpublished:true});
 });
}
