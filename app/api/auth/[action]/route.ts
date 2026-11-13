import { NextRequest,NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sessionUser } from "../../../../lib/auth";
import { checkPassword,createOneTimeToken,hashToken,passwordHash,randomToken,sendAccountEmail } from "../../../../lib/account";
import { activationEmailAllowed } from "@/lib/account-email";
export const runtime="nodejs";
const generic={message:"Jika alamat email terdaftar, instruksi akan dikirim."};
const response=(v:object,status=200)=>NextResponse.json(v,{status,headers:{"Cache-Control":"no-store"}});
const validEmail=(v:unknown)=>typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPass=(v:unknown)=>typeof v==="string"&&v.length>=12&&v.length<=128;
const origin=()=>{const url=new URL(process.env.APP_ORIGIN||"https://bcbookstudio.bahasacerdas.com");if(url.protocol!=="https:"&&url.hostname!=="localhost")throw new Error("APP_ORIGIN must use HTTPS");return url.origin;};
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;
 if(action!=="me")return response({error:"Not found"},404);
 const user=await sessionUser(req);
 return response(user?{authenticated:true,user}:{authenticated:false});
}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;
 if(action==="logout"){
  const raw=req.cookies.get("bcstudio_session")?.value;
  if(raw)await db.studioSession.deleteMany({where:{tokenHash:hashToken(raw)}});
  const res=response({success:true});
  res.cookies.set("bcstudio_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  return res;
 }
 let data:Record<string,unknown>;
 try{data=await req.json();}catch{return response({error:"Invalid JSON"},400);}
 const email=typeof data.email==="string"?data.email.toLowerCase().trim():"";
 if(action==="login"){
  if(!validEmail(email)||typeof data.password!=="string")return response({error:"Email atau kata sandi salah."},401);
  const user=await db.studioUser.findUnique({where:{email}});
  if(!user||!user.active||!user.passwordHash||!checkPassword(data.password,user.passwordHash))return response({error:"Email atau kata sandi salah."},401);
  const raw=randomToken();
  await db.studioSession.create({data:{userId:user.id,tokenHash:hashToken(raw),expiresAt:new Date(Date.now()+7*86400000)}});
  const res=response({success:true,redirect:user.role==="REVIEWER"?"/reviewer":"/studio"});
  res.cookies.set("bcstudio_session",raw,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:7*86400});
  return res;
 }
 if(action==="request-activation"||action==="forgot-password"){
  if(!validEmail(email))return response(generic);
  const user=await db.studioUser.findUnique({where:{email}});
  const purpose=action==="request-activation"?"activate":"reset";
  if(user&&((purpose==="activate"&&!user.active&&activationEmailAllowed(user.email))||(purpose==="reset"&&user.active))){
   const last=await db.studioAuthToken.findFirst({where:{userId:user.id,purpose,createdAt:{gt:new Date(Date.now()-10*60*1000)}},orderBy:{createdAt:"desc"}});
   if(!last){
    const token=await createOneTimeToken(user.id,purpose);
    const link=origin()+"/"+(purpose==="activate"?"activate":"reset-password")+"?token="+encodeURIComponent(token);
    try{await sendAccountEmail(user.email,user.name,link,purpose);}catch(e){console.error("Account email delivery failed",e instanceof Error?e.message:"unknown");await db.studioAuthToken.deleteMany({where:{userId:user.id,purpose,usedAt:null}});return response({error:"Layanan email sementara tidak tersedia. Coba kembali nanti."},503);}
   }
  }
  return response(generic);
 }
 if(action==="activate"||action==="reset-password"){
  const token=typeof data.token==="string"?data.token:"";
  if(!/^[a-f0-9]{64}$/.test(token)||!validPass(data.password))return response({error:"Tautan tidak valid atau kata sandi kurang dari 12 karakter."},400);
  const now=new Date();
  const purpose=action==="activate"?"activate":"reset";
  const item=await db.studioAuthToken.findUnique({where:{tokenHash:hashToken(token)},include:{user:true}});
  if(!item||item.purpose!==purpose||item.usedAt||item.expiresAt<=now||(purpose==="activate"&&item.user.active)||(purpose==="reset"&&!item.user.active))return response({error:"Tautan tidak berlaku atau sudah digunakan."},400);
  const updated=await db.studioAuthToken.updateMany({where:{id:item.id,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}});
  if(updated.count!==1)return response({error:"Tautan sudah digunakan."},400);
  await db.$transaction([
   db.studioUser.update({where:{id:item.userId},data:{passwordHash:passwordHash(data.password as string),active:true}}),
   db.studioSession.deleteMany({where:{userId:item.userId}}),
   db.studioAuthToken.deleteMany({where:{userId:item.userId,id:{not:item.id}}})
  ]);
  return response({success:true,message:"Kata sandi berhasil disimpan. Silakan login."});
 }
 return response({error:"Not found"},404);
}
