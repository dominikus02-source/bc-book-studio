import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { administrator } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { credentialInput,encryptCredential,encryptionReady,safeCredential,safeMutation } from "../../../../lib/providers";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(req:NextRequest){
 if(!await administrator(req))return NextResponse.json({error:"Hanya pengelola yang dapat mengatur API key."},{status:403,headers});
 const providers=await db.providerCredential.findMany({select:safeCredential,orderBy:{provider:"asc"}});
 return NextResponse.json({providers,encryptionReady:encryptionReady()},{headers});
}
export async function POST(req:NextRequest){
 const actorId=await administrator(req);
 if(!actorId)return NextResponse.json({error:"Akses pengelola diperlukan."},{status:403,headers});
 if(!safeMutation(req))return NextResponse.json({error:"Permintaan tidak valid."},{status:403,headers});
 if(!encryptionReady())return NextResponse.json({error:"Penyimpanan rahasia belum siap."},{status:503,headers});
 const input=credentialInput.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Provider, label, model, atau API key tidak valid."},{status:400,headers});
 const {apiKey,...data}=input.data,id=randomUUID();
 try{
 const provider=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741905)`;
   if(data.active)await tx.providerCredential.updateMany({where:{active:true},data:{active:false}});
   const result=await tx.providerCredential.create({data:{...data,id,encryptedKey:encryptCredential(apiKey,id),lastFour:apiKey.slice(-4)},select:safeCredential});
   await tx.credentialAudit.create({data:{actorId,credentialId:id,action:"CREATE"}});
   return result;
 });
 return NextResponse.json({provider},{status:201,headers});
 }catch{return NextResponse.json({error:"Tidak dapat menyimpan provider. Provider mungkin sudah terdaftar."},{status:409,headers})}
}
