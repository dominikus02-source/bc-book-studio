import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {reviewInput,badInput} from "../../../../../lib/validation";
import {checkpointsFor} from "../../../../../lib/editorial";
export const runtime="nodejs";
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const parsed=reviewInput.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json(badInput(parsed.error),{status:400});
 const {action,note}=parsed.data;
 return db.$transaction(async tx=>{
  const book=await tx.book.findUnique({where:{id},include:{_count:{select:{chapters:true}}}});
  if(!book)return fail("Not found",404);
  if(action==="submit"){
   if(book.ownerId!==actor.id)return fail("Not found",404);
   if(book.status!=="DRAFT"||book._count.chapters<1)return fail("Invalid transition",409);
   const checks=(book.editorialChecks||{}) as Record<string,unknown>;
   if(checkpointsFor(book.bookType).some(item=>checks[item.key]!==true))return fail("Missing editorial checkpoints",409);
   const assignmentCount=await tx.bookReviewer.count({where:{bookId:id}});
   if(!assignmentCount)return fail("Assign independent reviewer",409);
  }else{
   if(!["REVIEWER","ADMIN"].includes(actor.role)||actor.id===book.ownerId)return fail("Not authorized",403);
   const assigned=await tx.bookReviewer.findUnique({where:{bookId_reviewerId:{bookId:id,reviewerId:actor.id}}});
   if(!assigned)return fail("Not authorized",403);
   if(book.status!=="REVIEW")return fail("Invalid transition",409);
   if(!note.trim())return fail("Review note required",400);
  }
  const status=action==="submit"?"REVIEW":action==="approve"?"APPROVED":"DRAFT";
  const updated=await tx.book.update({where:{id},data:{status,approvedAt:status==="APPROVED"?new Date():null}});
  await tx.review.create({data:{bookId:id,decision:action,note:action==="submit"?"Submitted by owner":note+" [Reviewer: "+actor.id+"]"}});
  return NextResponse.json({book:updated});
 });
}
