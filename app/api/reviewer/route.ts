import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../lib/db";
import {sessionUser,deny} from "../../../lib/auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 const reviewer=["REVIEWER","ADMIN"].includes(actor.role);
 const books=await db.book.findMany({
  where:{archivedAt:null,OR:[{ownerId:actor.id},...(reviewer?[{assignedReviewers:{some:{reviewerId:actor.id}}}]:[])]},
  orderBy:{updatedAt:"desc"},
  include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},reviews:{orderBy:{createdAt:"desc"}},
   reviewNotes:{where:{status:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"}}}
 });
 return NextResponse.json({viewer:{id:actor.id,email:actor.email,role:actor.role},
  assignments:books.map(book=>({book:{...book,isOwner:book.ownerId===actor.id,canReview:reviewer&&book.ownerId!==actor.id}}))
 },{headers:{"Cache-Control":"no-store"}});
}
