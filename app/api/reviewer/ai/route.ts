import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../lib/db";
import {reviewerAccess} from "../../../../lib/reviewer-access";
import {activeProvider,invokeProvider} from "../../../../lib/providers";
import {canGenerate,quotaDenied} from "../../../../lib/usage";
export const runtime="nodejs";
const input=z.object({bookId:z.string().min(10),focus:z.enum(["GENERAL","FACT","PEDAGOGY","LANGUAGE","ACCESSIBILITY","COPYRIGHT"]).default("GENERAL")}).strict();
export async function POST(req:NextRequest){
 const p=input.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Invalid request"},{status:400});
 const access=await reviewerAccess(req,p.data.bookId);if(!access)return NextResponse.json({error:"Forbidden"},{status:403});
 if(access.book.status!=="REVIEW")return NextResponse.json({error:"Review closed"},{status:409});
 if(!await canGenerate(access.actor.id))return quotaDenied();
 const chapters=await db.chapter.findMany({where:{bookId:p.data.bookId},orderBy:{position:"asc"},select:{title:true,content:true}});
 const provider=await activeProvider().catch(()=>null);
 if(!provider)return NextResponse.json({error:"AI provider belum aktif. Gunakan catatan manual."},{status:503});
 try{
  const result=await invokeProvider(provider.provider,provider.model,provider.apiKey,[{role:"system",content:"Anda asisten reviewer editorial independen. Buat daftar temuan berbasis kutipan singkat naskah, kategori, tingkat urgensi, dan rekomendasi. Jangan mengarang fakta, referensi, atau keputusan persetujuan. Tandai klaim yang butuh verifikasi manusia. Jangan menyatakan naskah telah disetujui."},{role:"user",content:JSON.stringify({focus:p.data.focus,title:access.book.title,grade:access.book.grade,subject:access.book.subject,chapters:chapters.map(c=>({title:c.title,content:c.content.slice(0,11000)})).slice(0,8)})}],{maxTokens:1700,timeoutMs:45000});
  return NextResponse.json({suggestion:result,model:provider.model,warning:"Saran AI bukan keputusan reviewer. Simpan catatan setelah diperiksa."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Model AI tidak merespons. Coba kembali atau tinjau manual."},{status:502});}
}
