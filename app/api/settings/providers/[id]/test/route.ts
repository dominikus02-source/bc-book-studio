import { NextRequest, NextResponse } from "next/server";
import { administrator } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";
import { decryptCredential, invokeProvider, providerSchema, safeMutation } from "../../../../../../lib/providers";

export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const actorId=await administrator(req);
  if(!actorId)return NextResponse.json({error:"Akses pengelola diperlukan."},{status:403,headers});
  if(!safeMutation(req))return NextResponse.json({error:"Permintaan tidak valid."},{status:403,headers});
  const {id}=await params;
  const row=await db.providerCredential.findUnique({where:{id}});
  if(!row)return NextResponse.json({error:"Provider tidak ditemukan."},{status:404,headers});
  const parsed=providerSchema.safeParse(row.provider);
  if(!parsed.success)return NextResponse.json({ok:false,message:"Tipe provider tidak didukung."},{headers});
  let usage:{inputTokens:number;outputTokens:number;totalTokens:number;estimated:boolean}|undefined;
  try {
    const key=decryptCredential(row.encryptedKey,row.id);
    const result=await invokeProvider(parsed.data,row.model,key,[{role:"user",content:"Balas singkat dengan kata OK."}],{maxTokens:64,temperature:row.temperature,timeoutMs:12000});
    usage=result.usage;
  }catch{/* Sanitized below; never echo provider response or secret. */}
  const ok=Boolean(usage);
  if(usage)await db.usageEvent.create({data:{userId:actorId,credentialId:row.id,provider:row.provider,model:row.model,
    inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,totalTokens:usage.totalTokens,estimated:usage.estimated}}).catch(()=>null);
  await db.credentialAudit.create({data:{actorId,credentialId:id,action:ok?"TEST_OK":"TEST_FAILED"}}).catch(()=>null);
  return NextResponse.json({ok,message:ok?"Provider merespons dengan benar.":"Tes gagal. Periksa kunci, nama model, kuota, atau penagihan."},{headers});
}
