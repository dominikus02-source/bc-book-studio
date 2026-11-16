import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {reviewInput,badInput} from "../../../../../lib/validation";
import {checkpointsFor} from "../../../../../lib/editorial";
import {briefMissing} from "../../../../../lib/workflow";
import {canDecideReview,canSubmitReview} from "../../../../../lib/manuscript-access";
import {completeApproval,roundState} from "../../../../../lib/review-decision";
import {COUNTED_REVIEWER_ROLES,policyVerdict,type ReviewPolicyName} from "../../../../../lib/review-policy";
import {adminOverrideNote} from "../../../../../lib/admin-override";
import {finishWithNotify,reviewMail,sendEach,type MailRecipient} from "../../../../../lib/notify";
export const runtime="nodejs";
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
const reviewerNote=(text:string,actorId:string)=>text+" [Reviewer: "+actorId+"]";
const tell=(people:MailRecipient[],kind:"submitted"|"approved"|"returned",book:{id:string;title:string})=>()=>sendEach(people,person=>reviewMail(kind,person,book));

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const parsed=reviewInput.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json(badInput(parsed.error),{status:400});
 const {action,note}=parsed.data;
 const outcome=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} FOR UPDATE`;
  const book=await tx.book.findUnique({where:{id},include:{_count:{select:{chapters:{where:{archivedAt:null}}}}}});
  if(!book||book.archivedAt)return {response:fail("Not found",404),mail:null as (() => Promise<void>)|null};
  const policy=book.reviewPolicy as ReviewPolicyName;
  const collaborating=Boolean(await tx.bookCollaborator.findFirst({where:{bookId:id,userId:actor.id,archivedAt:null},select:{id:true}}));
  if(action==="submit"){
   if(!canSubmitReview(actor.id,book.ownerId))return {response:fail("Not found",404),mail:null};
   if(book.status!=="DRAFT"||book._count.chapters<1)return {response:fail("Invalid transition",409),mail:null};
   if(!["WRITING","EDITING"].includes(book.editorialStage))return {response:fail("Selesaikan Ide dan Rancang sebelum mengajukan review.",409),mail:null};
   const missing=briefMissing(book);
   if(missing.length)return {response:fail("Lengkapi Ide: "+missing.join("; "),409),mail:null};
   const chapters=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},select:{content:true,outlineObjective:true}});
   if(chapters.some(chapter=>!chapter.outlineObjective.trim()))return {response:fail("Lengkapi tujuan setiap bab di Rancang.",409),mail:null};
   if(chapters.some(chapter=>chapter.content.trim().length<20))return {response:fail("Complete manuscript content for each chapter before review",409),mail:null};
   const checks=(book.editorialChecks||{}) as Record<string,unknown>;
   if(checkpointsFor(book.bookType).some(item=>checks[item.key]!==true))return {response:fail("Missing editorial checkpoints",409),mail:null};
   const assigned=await tx.bookReviewer.findMany({where:{bookId:id,reviewerId:{not:actor.id},reviewer:{active:true,role:{in:[...COUNTED_REVIEWER_ROLES]}}},select:{reviewerId:true}});
   if(!assigned.length)return {response:fail("Assign independent reviewer",409),mail:null};
   if(policy==="LEAD"&&(!book.leadReviewerId||!assigned.some(row=>row.reviewerId===book.leadReviewerId)))return {response:fail("Tentukan reviewer utama di antara peninjau yang ditugaskan.",409),mail:null};
   if(policy==="MIN_N"&&((book.reviewMinApprovals??0)<1||(book.reviewMinApprovals??0)>assigned.length))return {response:fail("Jumlah persetujuan minimum harus antara 1 dan jumlah peninjau.",409),mail:null};
   const updatedCount=await tx.book.updateMany({where:{id,status:"DRAFT"},data:{status:"REVIEW",editorialStage:"REVIEW",approvedAt:null}});
   if(!updatedCount.count)return {response:fail("Invalid transition",409),mail:null};
   await tx.review.create({data:{bookId:id,decision:"submit",note:"Submitted by owner"}});
   const people=await tx.studioUser.findMany({where:{id:{in:assigned.map(row=>row.reviewerId)},active:true},select:{email:true,name:true,active:true}});
   const saved=await tx.book.findUniqueOrThrow({where:{id}});
   return {response:NextResponse.json({book:saved}),mail:tell(people,"submitted",saved)};
  }
  const eligible=await tx.studioUser.findFirst({where:{id:actor.id,active:true,role:{in:[...COUNTED_REVIEWER_ROLES]}},select:{id:true}});
  const assignedRow=await tx.bookReviewer.findUnique({where:{bookId_reviewerId:{bookId:id,reviewerId:actor.id}}});
  if(!eligible||!canDecideReview(actor,book,Boolean(assignedRow),collaborating))return {response:fail("Not authorized",403),mail:null};
  if(book.status!=="REVIEW")return {response:fail("Invalid transition",409),mail:null};
  if(!note.trim())return {response:fail("Review note required",400),mail:null};
  if(action==="approve"&&await tx.reviewerNote.count({where:{bookId:id,severity:{in:["CRITICAL","MAJOR"]},status:"OPEN"}}))return {response:fail("Selesaikan semua temuan MAJOR dan CRITICAL sebelum persetujuan akhir.",409),mail:null};
  const owner=await tx.studioUser.findUnique({where:{id:book.ownerId},select:{email:true,name:true,active:true}});
  if(action==="reject"){
   const updatedCount=await tx.book.updateMany({where:{id,status:"REVIEW"},data:{status:"DRAFT",editorialStage:"WRITING",approvedAt:null}});
   if(!updatedCount.count)return {response:fail("Invalid transition",409),mail:null};
   await tx.review.create({data:{bookId:id,decision:"reject",note:adminOverrideNote(actor,book.ownerId,reviewerNote(note,actor.id)+" Persetujuan pada putaran ini tidak lagi berlaku.")}});
   const saved=await tx.book.findUniqueOrThrow({where:{id}});
   return {response:NextResponse.json({book:saved,progress:{label:"Naskah dikembalikan. Persetujuan pada putaran ini tidak lagi berlaku."}}),mail:owner?tell([owner],"returned",saved):null};
  }
  const state=await roundState(tx,{...book,reviewPolicy:policy});
  const already=state.approverIds.has(actor.id);
  const next=new Set(state.approverIds);
  next.add(actor.id);
  const verdict=policyVerdict({policy,assignedIds:state.assignedIds,approverIds:next,leadReviewerId:book.leadReviewerId,minN:book.reviewMinApprovals});
  if(!already)await tx.review.create({data:{bookId:id,decision:"approve",note:adminOverrideNote(actor,book.ownerId,reviewerNote(note,actor.id))}});
  if(!verdict.met){
   const pendingBook=await tx.book.findUniqueOrThrow({where:{id}});
   return {response:NextResponse.json({book:pendingBook,pending:true,progress:verdict}),mail:null};
  }
  const finalized=await completeApproval(tx,{...book,reviewPolicy:policy},actor.id);
  if(!finalized.ok)return {response:fail(finalized.error,finalized.status),mail:null};
  return {response:NextResponse.json({book:finalized.book,progress:verdict}),mail:owner?tell([owner],"approved",finalized.book):null};
 });
 return finishWithNotify(outcome.response,outcome.mail);
}
