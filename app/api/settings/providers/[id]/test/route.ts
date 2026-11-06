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
  let ok=false;
  try {
    const key=decryptCredential(row.encryptedKey,row.id);
    await invokeProvider(parsed.data,row.model,key,[{role:"user",content:"Balas singkat dengan kata OK."}],{maxTokens:64,timeoutMs:12000});
    ok=true;
  }catch{/* Sanitized below; never echo provider response or secret. */}
  await db.credentialAudit.create({data:{actorId,credentialId:id,action:ok?"TEST_OK":"TEST_FAILED"}}).catch(()=>null);
  return NextResponse.json({ok,message:ok?"Provider merespons dengan benar.":"Tes gagal. Periksa kunci, nama model, kuota, atau penagihan."},{headers});
}
