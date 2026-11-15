import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../lib/db";
import {sessionUser,deny} from "../../../lib/auth";
import {reviewSubmissionMissing} from "../../../lib/review-readiness";
import {isManuscriptReviewerRole,manuscriptVisibilityWhere} from "../../../lib/manuscript-access";
import {bookListFilter,bookListPage,parseBookListQuery} from "../../../lib/book-list-query";
import {currentRoundApproverIds,policyVerdict,type ReviewPolicyName} from "../../../lib/review-policy";
export const runtime="nodejs";

export async function GET(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 const parsed=parseBookListQuery(req.nextUrl.searchParams);
 if("error" in parsed)return NextResponse.json({error:parsed.error},{status:400,headers:{"Cache-Control":"no-store"}});
 const reviewer=isManuscriptReviewerRole(actor.role);
 const where={AND:[manuscriptVisibilityWhere(actor),bookListFilter(parsed)]};
 const total=await db.book.count({where});
 const books=await db.book.findMany({
  where,
  orderBy:{updatedAt:"desc"},
  ...(parsed.limit?{take:parsed.limit,skip:(parsed.page-1)*parsed.limit}:{}),
  include:{
   chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},
   reviews:{orderBy:{createdAt:"desc"}},
   reviewNotes:{where:{status:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"}},
   assignedReviewers:{include:{reviewer:{select:{id:true,name:true,active:true,role:true}}}},
   collaborators:{where:{userId:actor.id,archivedAt:null},select:{id:true}},
  }
 });
 const archived=await db.reviewerNote.findMany({where:{bookId:{in:books.map(b=>b.id)},status:"ARCHIVED"},orderBy:{createdAt:"desc"}});
 const archivedByBook=new Map<string,typeof archived>();
 for(const note of archived){const list=archivedByBook.get(note.bookId)||[];list.push(note);archivedByBook.set(note.bookId,list);}
 const page=bookListPage(books,parsed,total);
 return NextResponse.json({
  viewer:{id:actor.id,email:actor.email,role:actor.role},
  ...page,
  assignments:books.map(book=>{
   const activeAssigned=book.assignedReviewers.filter(a=>a.reviewer.active&&["REVIEWER","ADMIN"].includes(a.reviewer.role));
   const approvers=currentRoundApproverIds(book.reviews,activeAssigned.map(row=>row.reviewerId));
   const progress=policyVerdict({policy:(book.reviewPolicy||"ANY") as ReviewPolicyName,assignedIds:activeAssigned.map(row=>row.reviewerId),approverIds:approvers,leadReviewerId:book.leadReviewerId,minN:book.reviewMinApprovals});
   const {collaborators,...rest}=book;
   const isOwner=book.ownerId===actor.id;
   const isCollaborator=!isOwner&&collaborators.length>0;
   return {book:{...rest,archivedNotes:archivedByBook.get(book.id)||[],
    reviewSubmissionMissing:reviewSubmissionMissing(book,activeAssigned.length),
    reviewProgress:progress,
    isOwner,isCollaborator,canReview:reviewer&&!isOwner&&!isCollaborator}};
  })
 },{headers:{"Cache-Control":"no-store"}});
}
