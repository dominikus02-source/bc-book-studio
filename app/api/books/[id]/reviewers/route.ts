import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {canAssignReviewers} from "../../../../../lib/manuscript-access";
import {completeApproval,roundState} from "../../../../../lib/review-decision";
import {COUNTED_REVIEWER_ROLES,REVIEW_POLICIES,unassignKeepsPolicyPossible,type ReviewPolicyName} from "../../../../../lib/review-policy";
import {managerLockSql} from "../../../../../lib/draft-access";
import {adminOverrideNote} from "../../../../../lib/admin-override";
import {finishWithNotify,reviewMail,sendEach} from "../../../../../lib/notify";
type Ctx={params:Promise<{id:string}>};
const error=(message:string,status:number)=>NextResponse.json({error:message},{status});
const policyBody=z.object({
 reviewPolicy:z.enum(REVIEW_POLICIES),
 reviewMinApprovals:z.number().int().min(1).max(50).nullable().optional(),
 leadReviewerId:z.string().min(1).max(100).nullable().optional(),
}).strict();

export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:user.role==="SUPERADMIN"?{id,archivedAt:null}:{id,ownerId:user.id,archivedAt:null},select:{id:true,ownerId:true,reviewPolicy:true,reviewMinApprovals:true,leadReviewerId:true,status:true}});
 if(!book||!canAssignReviewers(user.id,book.ownerId,user.role))return error("Not found",404);
 const assigned=await db.bookReviewer.findMany({where:{bookId:id},include:{reviewer:{select:{name:true,email:true,role:true,active:true}}}});
 const collaborators=await db.bookCollaborator.findMany({where:{bookId:id,archivedAt:null},select:{userId:true}});
 const hidden=[book.ownerId,...collaborators.map(row=>row.userId)];
 if(user.role!=="SUPERADMIN"||user.id===book.ownerId)hidden.push(user.id);
 const available=await db.studioUser.findMany({where:{active:true,role:{in:["REVIEWER","ADMIN"]},id:{notIn:hidden}},select:{id:true,name:true,email:true,role:true},orderBy:[{name:"asc"},{email:"asc"}],take:200});
 const selfEligible=user.role==="SUPERADMIN"&&user.id!==book.ownerId&&!hidden.includes(user.id)&&!assigned.some(row=>row.reviewerId===user.id);
 const choices=selfEligible?[{id:user.id,name:user.name,email:user.email,role:user.role},...available]:available;
 return NextResponse.json({
  policy:{reviewPolicy:book.reviewPolicy,reviewMinApprovals:book.reviewMinApprovals,leadReviewerId:book.leadReviewerId,locked:book.status!=="DRAFT"},
  reviewers:assigned.map(a=>({id:a.id,reviewerId:a.reviewerId,name:a.reviewer.name,email:a.reviewer.email,role:a.reviewer.role,active:a.reviewer.active,assignedAt:a.assignedAt})),
  available:choices.map(a=>({...a,assigned:assigned.some(r=>r.reviewerId===a.id)})),
 },{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=policyBody.safeParse(await req.json().catch(()=>null));
 if(!body.success)return error("Kebijakan review tidak valid.",400);
 return db.$transaction(async tx=>{
  await tx.$queryRaw(managerLockSql(id,user.id));
  const book=await tx.book.findFirst({where:user.role==="SUPERADMIN"?{id,archivedAt:null}:{id,ownerId:user.id,archivedAt:null}});
  if(!book||!canAssignReviewers(user.id,book.ownerId,user.role))return error("Not found",404);
  if(book.status!=="DRAFT")return error("Kebijakan review terkunci setelah naskah diajukan.",409);
  const assigned=await tx.bookReviewer.findMany({where:{bookId:id},select:{reviewerId:true}});
  const ids=assigned.map(row=>row.reviewerId);
  const minN=body.data.reviewMinApprovals??null;
  const lead=body.data.leadReviewerId??null;
  if(body.data.reviewPolicy==="MIN_N"&&(minN==null||minN<1||(ids.length>0&&minN>ids.length)))return error("Jumlah persetujuan minimum harus antara 1 dan jumlah peninjau.",400);
  if(body.data.reviewPolicy==="LEAD"&&(!lead||!ids.includes(lead)))return error("Pilih reviewer utama dari peninjau yang sudah ditugaskan.",400);
  if(body.data.reviewPolicy!=="MIN_N"&&minN!=null)return error("Batas jumlah hanya dipakai untuk kebijakan minimum.",400);
  if(body.data.reviewPolicy!=="LEAD"&&lead)return error("Reviewer utama hanya dipakai untuk kebijakan reviewer utama.",400);
  const saved=await tx.book.update({where:{id},data:{reviewPolicy:body.data.reviewPolicy,reviewMinApprovals:body.data.reviewPolicy==="MIN_N"?minN:null,leadReviewerId:body.data.reviewPolicy==="LEAD"?lead:null}});
  await tx.review.create({data:{bookId:id,decision:"review:policy",note:adminOverrideNote(user,book.ownerId,"Actor: "+user.id+"; policy: "+saved.reviewPolicy+(saved.reviewMinApprovals?"; min: "+saved.reviewMinApprovals:"")+(saved.leadReviewerId?"; lead: "+saved.leadReviewerId:""))}});
  return NextResponse.json({policy:{reviewPolicy:saved.reviewPolicy,reviewMinApprovals:saved.reviewMinApprovals,leadReviewerId:saved.leadReviewerId}});
 });
}

export async function POST(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=z.object({email:z.string().email().max(254)}).strict().safeParse(await req.json().catch(()=>null));
 if(!body.success)return error("Invalid reviewer",400);
 const outcome=await db.$transaction(async tx=>{
  await tx.$queryRaw(managerLockSql(id,user.id));
  const book=await tx.book.findFirst({where:user.role==="SUPERADMIN"?{id,archivedAt:null}:{id,ownerId:user.id,archivedAt:null},select:{id:true,status:true,title:true,ownerId:true}});
  if(!book||!canAssignReviewers(user.id,book.ownerId,user.role))return {response:error("Not found",404),mail:null as (() => Promise<void>)|null};
  if(book.status!=="DRAFT")return {response:error("Reviewer assignments locked",409),mail:null};
  const reviewer=await tx.studioUser.findUnique({where:{email:body.data.email.toLowerCase().trim()}});
  const self=Boolean(reviewer&&reviewer.id===user.id);
  const staff=Boolean(reviewer&&reviewer.active&&["REVIEWER","ADMIN"].includes(reviewer.role)&&!self);
  const selfAdmin=Boolean(self&&user.role==="SUPERADMIN"&&reviewer?.role==="SUPERADMIN"&&reviewer.active&&reviewer.id!==book.ownerId);
  if(!reviewer||(!staff&&!selfAdmin))return {response:error("Eligible reviewer not found",404),mail:null};
  const collaborator=await tx.bookCollaborator.findFirst({where:{bookId:id,userId:reviewer.id,archivedAt:null},select:{id:true}});
  if(collaborator)return {response:error("Kolaborator tidak dapat ditugaskan sebagai peninjau buku yang sama.",409),mail:null};
  const record=await tx.bookReviewer.upsert({where:{bookId_reviewerId:{bookId:id,reviewerId:reviewer.id}},update:{},create:{bookId:id,reviewerId:reviewer.id,assignedById:user.id}});
  await tx.review.create({data:{bookId:id,decision:"reviewer:assign",note:adminOverrideNote(user,book.ownerId,reviewer.id+" by "+user.id)}});
  return {response:NextResponse.json({assigned:true,id:record.id},{status:201}),mail:()=>sendEach([reviewer],person=>reviewMail("assigned",person,book))};
 });
 return finishWithNotify(outcome.response,outcome.mail);
}

export async function DELETE(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=z.object({reviewerId:z.string().min(1).max(100)}).safeParse(await req.json().catch(()=>null));
 if(!body.success)return error("Invalid reviewer",400);
 const outcome=await db.$transaction(async tx=>{
  await tx.$queryRaw(managerLockSql(id,user.id));
  const book=await tx.book.findFirst({where:user.role==="SUPERADMIN"?{id,archivedAt:null}:{id,ownerId:user.id,archivedAt:null}});
  if(!book||!canAssignReviewers(user.id,book.ownerId,user.role))return {response:error("Not found",404),mail:null as (() => Promise<void>)|null};
  if(book.status!=="DRAFT"&&book.status!=="REVIEW")return {response:error("Reviewer assignments locked",409),mail:null};
  const policy=book.reviewPolicy as ReviewPolicyName;
  if(book.status==="REVIEW"){
   const assigned=await tx.bookReviewer.findMany({where:{bookId:id,reviewer:{active:true,role:{in:[...COUNTED_REVIEWER_ROLES]}}},select:{reviewerId:true}});
   const ids=assigned.map(row=>row.reviewerId);
   if(!ids.includes(body.data.reviewerId))return {response:error("Peninjau tidak ditemukan pada buku ini.",404),mail:null};
   const possible=unassignKeepsPolicyPossible({policy,assignedIds:ids,removeId:body.data.reviewerId,minN:book.reviewMinApprovals,leadReviewerId:book.leadReviewerId});
   if(!possible.ok)return {response:error(possible.error,409),mail:null};
  }
  await tx.bookReviewer.deleteMany({where:{bookId:id,reviewerId:body.data.reviewerId}});
  await tx.review.create({data:{bookId:id,decision:"reviewer:remove",note:adminOverrideNote(user,book.ownerId,body.data.reviewerId+" by "+user.id)}});
  if(book.status!=="REVIEW")return {response:NextResponse.json({removed:true}),mail:null};
  const state=await roundState(tx,{...book,reviewPolicy:policy});
  await tx.review.create({data:{bookId:id,decision:"review:threshold",note:adminOverrideNote(user,book.ownerId,"Actor: "+user.id+"; "+state.verdict.label+"; tersisa: "+state.assignedIds.length)}});
  if(!state.verdict.met)return {response:NextResponse.json({removed:true,progress:state.verdict}),mail:null};
  if(state.blockers){
   await tx.review.create({data:{bookId:id,decision:"review:threshold",note:"Ambang tercapai tetapi temuan MAJOR atau CRITICAL masih terbuka."}});
   return {response:NextResponse.json({removed:true,progress:state.verdict,blockedByNotes:true}),mail:null};
  }
  const approverId=[...state.approverIds][0];
  if(!approverId)return {response:NextResponse.json({removed:true,progress:state.verdict}),mail:null};
  const finalized=await completeApproval(tx,{...book,reviewPolicy:policy},approverId);
  if(!finalized.ok)return {response:error(finalized.error,finalized.status),mail:null};
  const owner=await tx.studioUser.findUnique({where:{id:book.ownerId},select:{email:true,name:true,active:true}});
  return {response:NextResponse.json({removed:true,book:finalized.book,progress:state.verdict}),mail:owner?()=>sendEach([owner],person=>reviewMail("approved",person,finalized.book)):null};
 });
 return finishWithNotify(outcome.response,outcome.mail);
}
