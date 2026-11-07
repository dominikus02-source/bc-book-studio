import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {reviewerAccess} from "../../../../../lib/reviewer-access";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const schema=z.object({content:z.string().trim().min(3).max(10000).optional(),category:z.enum(["CONTENT","FACT","CITATION","LANGUAGE","ACCESSIBILITY","COPYRIGHT","PEDAGOGY"]).optional(),severity:z.enum(["SUGGESTION","MAJOR","CRITICAL"]).optional(),status:z.enum(["OPEN","RESOLVED"]).optional()}).strict().refine(x=>Object.keys(x).length>0);
async function owned(req:NextRequest,id:string){
 const note=await db.reviewerNote.findUnique({where:{id}});
 if(!note)return null;
 const access=await reviewerAccess(req,note.bookId);
 return access?.actor.id===note.reviewerId?{note,access}:null;
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const {id}=await params;const p=schema.safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:"Invalid input"},{status:400});
 const found=await owned(req,id);if(!found)return NextResponse.json({error:"Not found"},{status:404});
 if(found.access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 return NextResponse.json({note:await db.reviewerNote.update({where:{id},data:p.data})});
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const {id}=await params;const found=await owned(req,id);if(!found)return NextResponse.json({error:"Not found"},{status:404});
 if(found.access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 await db.reviewerNote.delete({where:{id}});return NextResponse.json({deleted:true});
}
