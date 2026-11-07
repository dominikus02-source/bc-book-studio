import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../lib/db";
import {reviewerAccess} from "../../../../lib/reviewer-access";
export const runtime="nodejs";
const input=z.object({bookId:z.string().min(10),chapterId:z.string().nullable().optional(),category:z.enum(["CONTENT","FACT","CITATION","LANGUAGE","ACCESSIBILITY","COPYRIGHT","PEDAGOGY"]),severity:z.enum(["SUGGESTION","MAJOR","CRITICAL"]),content:z.string().trim().min(3).max(10000)}).strict();
export async function POST(req:NextRequest){
 const p=input.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Invalid input"},{status:400});
 const access=await reviewerAccess(req,p.data.bookId);if(!access)return NextResponse.json({error:"Forbidden"},{status:403});
 if(access.book.status!=="REVIEW")return NextResponse.json({error:"Book not in review"},{status:409});
 if(p.data.chapterId&&!await db.chapter.findFirst({where:{id:p.data.chapterId,bookId:p.data.bookId}}))return NextResponse.json({error:"Invalid chapter"},{status:400});
 const note=await db.reviewerNote.create({data:{bookId:p.data.bookId,reviewerId:access.actor.id,chapterId:p.data.chapterId||null,category:p.data.category,severity:p.data.severity,content:p.data.content}});
 return NextResponse.json({note},{status:201});
}
