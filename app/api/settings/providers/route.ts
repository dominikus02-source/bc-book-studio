import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { administrator,identity } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { credentialInput,encryptCredential,encryptionReady,safeCredential,safeMutation } from "../../../../lib/providers";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(req:NextRequest){
 const actorId=await identity(req);
 if(!actorId)return NextResponse.json({error:"Sesi studio tidak valid."},{status:401,headers});
 const canManage=Boolean(await administrator(req));
 const providers=await db.providerCredential.findMany({
  where:canManage?{}:{active:true},select:safeCredential,
  orderBy:[{active:"desc"},{provider:"asc"},{label:"asc"}]
 });
 return NextResponse.json({providers,canManage,encryptionReady:canManage?encryptionReady():undefined},{headers});
}
export async function POST(req:NextRequest){
 const actorId=await administrator(req);
 if(!actorId)return NextResponse.json({error:"Akses pengelola diperlukan."},{status:403,headers});
 if(!safeMutation(req))return NextResponse.json({error:"Permintaan tidak valid."},{status:403,headers});
 if(!encryptionReady())return NextResponse.json({error:"Penyimpanan rahasia belum siap."},{status:503,headers});
 const input=credentialInput.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Provider, label, model, API key, atau pengaturan model tidak valid."},{status:400,headers});
 const {apiKey,...data}=input.data,id=randomUUID();
 try{
  const provider=await db.$transaction(async tx=>{
   const result=await tx.providerCredential.create({data:{...data,id,encryptedKey:encryptCredential(apiKey,id),lastFour:apiKey.slice(-4)},select:safeCredential});
   await tx.credentialAudit.create({data:{actorId,credentialId:id,action:"CREATE"}});
   return result;
  });
  return NextResponse.json({provider},{status:201,headers});
 }catch{return NextResponse.json({error:"Tidak dapat menyimpan konfigurasi provider."},{status:409,headers})}
}
