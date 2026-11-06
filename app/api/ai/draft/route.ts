import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { identity,deny } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { activeProvider,invokeProvider,safeMutation } from "../../../../lib/providers";
import { canGenerate,quotaDenied } from "../../../../lib/usage";
export const runtime="nodejs";
const schema=z.object({
 providerCredentialId:z.string().trim().min(1).max(80),
 bookType:z.enum(["FICTION","NONFICTION"]),
 title:z.string().trim().min(2).max(160),
 genre:z.string().trim().max(80).default(""),
 targetAudience:z.string().trim().min(2).max(120),
 topic:z.string().trim().min(4).max(250),
 learningGoals:z.string().trim().min(10).max(2000)
}).strict();
const dailyLimit=()=>{const n=Number(process.env.STUDIO_DAILY_TOKEN_LIMIT);return Number.isInteger(n)&&n>0?Math.min(2_000_000,n):50000};
export async function POST(req:NextRequest){
 const userId=await identity(req);
 if(!userId)return deny();
 if(!safeMutation(req))return NextResponse.json({error:"Permintaan tidak valid."},{status:403});
 const input=schema.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Isi template uji belum lengkap."},{status:400});
 const provider=await activeProvider(input.data.providerCredentialId).catch(()=>null);
 if(!provider)return NextResponse.json({error:"Model tidak tersedia. Pilih model aktif."},{status:404});
 if(!await canGenerate(userId))return quotaDenied();
 const start=new Date();start.setUTCHours(0,0,0,0);
 const current=await db.usageEvent.aggregate({where:{userId,createdAt:{gte:start}},_sum:{totalTokens:true}});
 const limit=dailyLimit(),used=current._sum.totalTokens??0,remaining=Math.max(0,limit-used);
 if(remaining<64)return quotaDenied();
 const maxTokens=Math.min(provider.maxTokens,Number(process.env.AI_MAX_OUTPUT_TOKENS)||3000,remaining);
 const system=input.data.bookType==="FICTION"
  ?"Anda penulis dan editor fiksi berbahasa Indonesia. Buat draf bab yang orisinal sesuai genre, pembaca, premis, dan tujuan. Tampilkan adegan konkret, karakter konsisten, konflik berkembang, serta akhir bab yang mengundang pembaca melanjutkan. Jangan meniru gaya penulis hidup."
  :"Anda penulis buku nonfiksi berbahasa Indonesia. Buat draf bab terstruktur, mudah dipahami pembaca sasaran, akurat, dan memenuhi tujuan. Tandai klaim yang memerlukan sumber; jangan mengarang sitasi.";
 try{
  const result=await invokeProvider(provider.provider,provider.model,provider.apiKey,[
   {role:"system",content:system},
   {role:"user",content:JSON.stringify({title:input.data.title,genre:input.data.genre,
    audience:input.data.targetAudience,topic:input.data.topic,goals:input.data.learningGoals})}
  ],{maxTokens,temperature:provider.temperature,timeoutMs:45000});
  await db.usageEvent.create({data:{userId,credentialId:provider.id,provider:provider.provider,model:provider.model,
   inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens,totalTokens:result.usage.totalTokens,estimated:result.usage.estimated}});
  return NextResponse.json({draft:result.content,provider:{id:provider.id,name:provider.provider,model:provider.model},
   usage:{...result.usage,remainingTokens:Math.max(0,remaining-result.usage.totalTokens),dailyLimit:limit},
   note:"Ini draf awal. Tinjau fakta atau orisinalitas, hak cipta, kesesuaian pembaca, dan mutu editorial sebelum disimpan."},
   {headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Generasi gagal. Periksa key, model, kuota, atau tagihan provider."},{status:502,headers:{"Cache-Control":"no-store"}});
 }
}
