import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
type Ctx={params:Promise<{id:string}>};
const error=(message:string,status:number)=>NextResponse.json({error:message},{status});
export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:user.id},select:{id:true}});
 if(!book)return error("Not found",404);
 const assigned=await db.bookReviewer.findMany({where:{bookId:id},include:{reviewer:{select:{name:true,email:true,role:true}}}});
 const available=await db.studioUser.findMany({where:{active:true,role:{in:["REVIEWER","ADMIN"]},id:{not:user.id}},select:{id:true,name:true,email:true,role:true},orderBy:[{name:"asc"},{email:"asc"}],take:200});
 return NextResponse.json({reviewers:assigned.map(a=>({id:a.id,reviewerId:a.reviewerId,name:a.reviewer.name,email:a.reviewer.email,role:a.reviewer.role,assignedAt:a.assignedAt})),available:available.map(a=>({...a,assigned:assigned.some(r=>r.reviewerId===a.id)}))},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=z.object({email:z.string().email().max(254)}).strict().safeParse(await req.json().catch(()=>null));
 if(!body.success)return error("Invalid reviewer",400);
 const book=await db.book.findFirst({where:{id,ownerId:user.id},select:{id:true,status:true}});
 if(!book)return error("Not found",404);
 if(book.status!=="DRAFT")return error("Reviewer assignments locked",409);
 const reviewer=await db.studioUser.findUnique({where:{email:body.data.email.toLowerCase().trim()}});
 if(!reviewer||!reviewer.active||!["REVIEWER","ADMIN"].includes(reviewer.role)||reviewer.id===user.id)return error("Eligible reviewer not found",404);
 const record=await db.bookReviewer.upsert({where:{bookId_reviewerId:{bookId:id,reviewerId:reviewer.id}},update:{},create:{bookId:id,reviewerId:reviewer.id,assignedById:user.id}});
 return NextResponse.json({assigned:true,id:record.id},{status:201});
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=z.object({reviewerId:z.string().min(1).max(100)}).safeParse(await req.json().catch(()=>null));
 if(!body.success)return error("Invalid reviewer",400);
 const book=await db.book.findFirst({where:{id,ownerId:user.id},select:{status:true}});
 if(!book)return error("Not found",404);
 if(book.status!=="DRAFT")return error("Reviewer assignments locked",409);
 await db.bookReviewer.deleteMany({where:{bookId:id,reviewerId:body.data.reviewerId}});
 return NextResponse.json({removed:true});
}
