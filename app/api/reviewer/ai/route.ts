import {recordAiUsage} from "../../../../lib/ai-usage";
import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../lib/db";
import {reviewerAccess} from "../../../../lib/reviewer-access";
import {activeProvider,invokeProvider} from "../../../../lib/providers";
import {canGenerate,quotaDenied} from "../../../../lib/usage";
import {runEditorialAgent,runEditorialOrchestrator,reviewFocus} from "../../../../lib/editorial-review-agent";
export const runtime="nodejs";
const input=z.object({
  bookId:z.string().min(10),
  focus:reviewFocus.default("GENERAL"),
  mode:z.enum(["single","orchestrator"]).default("single")
}).strict();
export async function POST(req:NextRequest){
 const p=input.safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:"Invalid request"},{status:400});
 const access=await reviewerAccess(req,p.data.bookId);
 if(!access)return NextResponse.json({error:"Forbidden"},{status:403});
 if(access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 if(!await canGenerate(access.actor.id))return quotaDenied();
 const chapters=await db.chapter.findMany({where:{bookId:p.data.bookId,archivedAt:null},orderBy:{position:"asc"},select:{title:true,content:true}});
 const context={title:access.book.title,grade:access.book.grade,subject:access.book.subject,chapters};
 try{
  if(p.data.mode==="orchestrator"){
   const result=await runEditorialOrchestrator(context,{actorId:access.actor.id});
   return NextResponse.json({...result,model:"orchestrator",warning:result.warning},{headers:{"Cache-Control":"no-store"}});
  }
  const result=await runEditorialAgent(p.data.focus,context,{actorId:access.actor.id});
  return NextResponse.json({
   suggestion:result.raw||result.summary,
   structured:result,
   model:result.agent,
   warning:"Saran AI bukan keputusan reviewer. Simpan catatan setelah diperiksa."
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  if(e instanceof Error && e.message==="AI_PROVIDER_UNAVAILABLE")return NextResponse.json({error:"AI provider belum aktif. Gunakan catatan manual."},{status:503});
  return NextResponse.json({error:"Model AI tidak merespons. Coba kembali atau tinjau manual."},{status:502});
 }
}
