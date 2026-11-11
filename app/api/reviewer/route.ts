import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../lib/db";
import {sessionUser,deny} from "../../../lib/auth";
import {reviewSubmissionMissing} from "../../../lib/review-readiness";
export const runtime="nodejs";

export async function GET(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 const reviewer=["REVIEWER","ADMIN"].includes(actor.role);
 const bookId=req.nextUrl.searchParams.get("bookId");
 if(bookId&&(bookId.length>80||!/^[\w-]+$/.test(bookId)))return NextResponse.json({error:"Identitas buku tidak valid."},{status:400});
 const books=await db.book.findMany({
  where:{archivedAt:null,...(bookId?{id:bookId}:{}),OR:[{ownerId:actor.id},...(reviewer?[{assignedReviewers:{some:{reviewerId:actor.id}}}]:[])]},
  orderBy:{updatedAt:"desc"},
  include:{
   chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},
   reviews:{orderBy:{createdAt:"desc"}},
   reviewNotes:{where:{status:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"}},
   assignedReviewers:{include:{reviewer:{select:{id:true,name:true,active:true,role:true}}}},
  }
 });
 const archived=await db.reviewerNote.findMany({where:{bookId:{in:books.map(b=>b.id)},status:"ARCHIVED"},orderBy:{createdAt:"desc"}});
 const archivedByBook=new Map<string,typeof archived>();
 for(const note of archived){const list=archivedByBook.get(note.bookId)||[];list.push(note);archivedByBook.set(note.bookId,list);}
 return NextResponse.json({
  viewer:{id:actor.id,email:actor.email,role:actor.role},
  assignments:books.map(book=>{
   const activeReviewers=book.assignedReviewers.filter(a=>a.reviewer.active&&["REVIEWER","ADMIN"].includes(a.reviewer.role)).length;
   return {book:{...book,archivedNotes:archivedByBook.get(book.id)||[],
    reviewSubmissionMissing:reviewSubmissionMissing(book,activeReviewers),
    isOwner:book.ownerId===actor.id,canReview:reviewer&&book.ownerId!==actor.id}};
  })
 },{headers:{"Cache-Control":"no-store"}});
}
