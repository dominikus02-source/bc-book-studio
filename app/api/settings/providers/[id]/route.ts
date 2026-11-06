import { NextRequest,NextResponse } from "next/server";
import { administrator } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";
import { credentialUpdate,encryptCredential,encryptionReady,safeCredential,safeMutation } from "../../../../../lib/providers";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actorId=await administrator(req);
 if(!actorId)return NextResponse.json({error:"Akses pengelola diperlukan."},{status:403,headers});
 if(!safeMutation(req))return NextResponse.json({error:"Permintaan tidak valid."},{status:403,headers});
 const input=credentialUpdate.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Perubahan tidak valid."},{status:400,headers});
 const {id}=await params,{apiKey,...data}=input.data;
 if(apiKey&&!encryptionReady())return NextResponse.json({error:"Penyimpanan rahasia belum siap."},{status:503,headers});
 try{
  const provider=await db.$transaction(async tx=>{
   const result=await tx.providerCredential.update({where:{id},data:{...data,...(apiKey?{encryptedKey:encryptCredential(apiKey,id),lastFour:apiKey.slice(-4)}:{})},select:safeCredential});
   await tx.credentialAudit.create({data:{actorId,credentialId:id,action:apiKey?"ROTATE":"UPDATE"}});
   return result;
  });
  return NextResponse.json({provider},{headers});
 }catch{return NextResponse.json({error:"Provider tidak ditemukan atau perubahan gagal."},{status:404,headers})}
}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actorId=await administrator(req);
 if(!actorId)return NextResponse.json({error:"Akses pengelola diperlukan."},{status:403,headers});
 if(!safeMutation(req))return NextResponse.json({error:"Permintaan tidak valid."},{status:403,headers});
 const {id}=await params;
 try{
  await db.$transaction(async tx=>{
   await tx.credentialAudit.create({data:{actorId,credentialId:id,action:"DELETE"}});
   await tx.providerCredential.delete({where:{id}});
  });
  return NextResponse.json({deleted:true},{headers});
 }catch{return NextResponse.json({error:"Provider tidak ditemukan."},{status:404,headers})}
}
