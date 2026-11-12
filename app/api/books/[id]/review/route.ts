import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {reviewInput,badInput} from "../../../../../lib/validation";
import {checkpointsFor} from "../../../../../lib/editorial";
import {briefMissing} from "../../../../../lib/workflow";
import {referencedAssets} from "../../../../../lib/approval-snapshot";
import {resolvedPublishingPackage,publishingSequence} from "../../../../../lib/publishing-package";
import {canDecideReview} from "../../../../../lib/manuscript-access";
export const runtime="nodejs";
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const parsed=reviewInput.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json(badInput(parsed.error),{status:400});
 const {action,note}=parsed.data;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} FOR UPDATE`;
  const book=await tx.book.findUnique({where:{id},include:{_count:{select:{chapters:{where:{archivedAt:null}}}}}});
  if(!book||book.archivedAt)return fail("Not found",404);
  if(action==="submit"){
   if(book.ownerId!==actor.id)return fail("Not found",404);
   if(book.status!=="DRAFT"||book._count.chapters<1)return fail("Invalid transition",409);
   if(!["WRITING","EDITING"].includes(book.editorialStage))return fail("Selesaikan Ide dan Rancang sebelum mengajukan review.",409);
   const missing=briefMissing(book);
   if(missing.length)return fail("Lengkapi Ide: "+missing.join("; "),409);
   const chapters=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},select:{content:true,outlineObjective:true}});
   if(chapters.some(chapter=>!chapter.outlineObjective.trim()))return fail("Lengkapi tujuan setiap bab di Rancang.",409);
   if(chapters.some(chapter=>chapter.content.trim().length<20))return fail("Complete manuscript content for each chapter before review",409);
   const checks=(book.editorialChecks||{}) as Record<string,unknown>;
   if(checkpointsFor(book.bookType).some(item=>checks[item.key]!==true))return fail("Missing editorial checkpoints",409);
   const assignmentCount=await tx.bookReviewer.count({where:{bookId:id,reviewerId:{not:actor.id},reviewer:{active:true,role:{in:["REVIEWER","ADMIN"]}}}});
   if(!assignmentCount)return fail("Assign independent reviewer",409);
  }else{
   const eligible=await tx.studioUser.findFirst({where:{id:actor.id,active:true,role:{in:["REVIEWER","ADMIN"]}},select:{id:true}});
   const assigned=await tx.bookReviewer.findUnique({where:{bookId_reviewerId:{bookId:id,reviewerId:actor.id}}});
   if(!eligible||!canDecideReview(actor,book,Boolean(assigned)))return fail("Not authorized",403);
   if(book.status!=="REVIEW")return fail("Invalid transition",409);
   if(!note.trim())return fail("Review note required",400);
   if(action==="approve"&&await tx.reviewerNote.count({where:{bookId:id,severity:{in:["CRITICAL","MAJOR"]},status:"OPEN"}}))return fail("Selesaikan semua temuan MAJOR dan CRITICAL sebelum persetujuan akhir.",409);
  }
  const status=action==="submit"?"REVIEW":action==="approve"?"APPROVED":"DRAFT";
  const approvedAt = status === "APPROVED" ? new Date() : null;
  if (approvedAt) {
   const chapters = await tx.chapter.findMany({
    where: {bookId:id,archivedAt:null}, orderBy: {position:"asc"},
    select: {title:true, content:true, position:true},
   });
   if (!chapters.length||chapters.some(chapter=>chapter.content.trim().length<20)) return fail("Approval requires complete chapter content",409);
   const packageRow=await tx.studioFormDraft.findFirst({where:{ownerId:book.ownerId,module:"PUBLISHING_PACKAGE:"+id},orderBy:{updatedAt:"desc"}});
   const publishingPackage=resolvedPublishingPackage(book,packageRow?.payload);
   const refs = referencedAssets(publishingSequence(publishingPackage,chapters));
   if (refs.length > 20) return fail("Too many embedded images",409);
   const files = refs.length ? await tx.bookAsset.findMany({where:{bookId:id,id:{in:refs}}}) : [];
   if (files.length !== refs.length) return fail("Restore missing images before approval",409);
   const assets = files.map(({id,mime,bytes,altText,license,sourceUrl}) => ({
    id,mime,data:Buffer.from(bytes).toString("base64"),altText,license,sourceUrl,
   }));
   const {title,author,subject,grade,description,bookType,genre,pageSize} = book;
   const updated = await tx.book.updateMany({
    where: {id,status:"REVIEW"}, data: {status,approvedAt},
   });
   if (!updated.count) return fail("Invalid transition",409);
   await tx.bookApprovalSnapshot.create({data:{
    bookId:id,approvedAt,reviewerId:actor.id,
    manuscript:{schemaVersion:2,language:"id",publishingPackage,title,author,subject,grade,description,bookType,genre,pageSize,chapters,assets},
   }});
  } else {
   const updated = await tx.book.updateMany({
    where: {id,status:book.status}, data: {status,approvedAt:null},
   });
   if (!updated.count) return fail("Invalid transition",409);
  }
  const updated = await tx.book.findUniqueOrThrow({where:{id}});
  await tx.review.create({data:{bookId:id,decision:action,note:action==="submit"?"Submitted by owner":note+" [Reviewer: "+actor.id+"]"}});
  return NextResponse.json({book:updated});
 });
}
