import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import { createOneTimeToken, sendAccountEmail } from "@/lib/account";
import { StudioRole } from "@prisma/client";
import {z} from "zod";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const roles: StudioRole[] = ["EDITOR", "REVIEWER", "ADMIN", "SUPERADMIN"];
const respond = (data: object, status = 200) => NextResponse.json(data, { status, headers });
async function guard(req: NextRequest) {
  const user = await sessionUser(req);
  return user?.role === "SUPERADMIN" ? user : null;
}
const validEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validRole = (value: unknown): value is StudioRole => roles.includes(value as StudioRole);
export async function GET(req: NextRequest) {
  if (!await guard(req)) return respond({error:"Forbidden"},403);
  const users = await db.studioUser.findMany({orderBy:{createdAt:"asc"},select:{id:true,email:true,name:true,role:true,active:true,createdAt:true,updatedAt:true}});
  return respond({users});
}
export async function POST(req: NextRequest) {
  const actor=await guard(req);if(!actor)return respond({error:"Forbidden"},403);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return respond({error:"Invalid JSON"},400)}
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const name=typeof body.name==="string"?body.name.trim():"";
  if(!validEmail(email)||name.length<2||name.length>120||!validRole(body.role)||body.role==="SUPERADMIN")return respond({error:"Invalid account details"},400);
  try {
    const user=await db.studioUser.create({data:{email,name,role:body.role,active:false},select:{id:true,email:true,name:true,role:true,active:true}});
    try {
      const token=await createOneTimeToken(user.id,"activate");
      const origin=new URL(process.env.APP_ORIGIN||"https://bcbookstudio.bahasacerdas.com");
      if(origin.protocol!=="https:"&&origin.hostname!=="localhost"&&origin.hostname!=="127.0.0.1")throw new Error("HTTPS required");
      await sendAccountEmail(email,name,origin.origin+"/activate?token="+encodeURIComponent(token),"activate");
    }catch(e){console.error("Activation email failed",e instanceof Error?e.message:"unknown");return respond({user,warning:"Account created but activation email could not be delivered"},201)}
    return respond({user},201);
  }catch(e){if(typeof e==="object"&&e&&"code" in e&&e.code==="P2002")return respond({error:"Email already exists"},409);throw e}
}
export async function PATCH(req:NextRequest){
  const actor=await guard(req);if(!actor)return respond({error:"Forbidden"},403);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return respond({error:"Invalid JSON"},400)}
  if(typeof body.id!=="string")return respond({error:"Missing user id"},400);
  const target=await db.studioUser.findUnique({where:{id:body.id}});if(!target)return respond({error:"Not found"},404);
  if(target.role==="SUPERADMIN"||target.id===actor.id)return respond({error:"Protected superadmin account"},403);
  const version=z.string().datetime({offset:true}).safeParse(body.expectedVersion);
  if(!version.success)return respond({error:"Muat ulang daftar pengguna sebelum menyimpan."},428);
  const data:{name?:string;email?:string;role?:StudioRole;active?:boolean}={};
  if(body.email!==undefined){if(typeof body.email!=="string"||!validEmail(body.email.trim().toLowerCase()))return respond({error:"Email tidak valid"},400);data.email=body.email.trim().toLowerCase();}
  if(body.name!==undefined){if(typeof body.name!=="string"||body.name.trim().length<2||body.name.trim().length>120)return respond({error:"Invalid name"},400);data.name=body.name.trim()}
  if(body.role!==undefined){if(!validRole(body.role)||body.role==="SUPERADMIN")return respond({error:"Invalid role"},400);data.role=body.role}
  if(body.active!==undefined){if(typeof body.active!=="boolean")return respond({error:"Invalid status"},400);data.active=body.active}
  if(!Object.keys(data).length)return respond({error:"No changes"},400);
  try {
   const user=await db.$transaction(async tx=>{
    const changed=await tx.studioUser.updateMany({where:{id:target.id,role:{not:"SUPERADMIN"},updatedAt:new Date(version.data)},data});
    if(changed.count!==1)return null;
    if(data.active===false||(data.role!==undefined&&data.role!==target.role)||(data.email!==undefined&&data.email!==target.email)){
     await tx.studioSession.deleteMany({where:{userId:target.id}});
     await tx.studioAuthToken.deleteMany({where:{userId:target.id}});
    }
    return tx.studioUser.findUnique({where:{id:target.id},select:{id:true,email:true,name:true,role:true,active:true,updatedAt:true}});
   });
   return user?respond({user}):respond({error:"Data telah berubah. Muat ulang halaman sebelum menyimpan."},409);
  }catch(e){if(typeof e==="object"&&e&&"code" in e&&e.code==="P2002")return respond({error:"Email sudah digunakan akun lain."},409);throw e}
}
export async function DELETE(req:NextRequest){
  const actor=await guard(req);if(!actor)return respond({error:"Forbidden"},403);
  const id=new URL(req.url).searchParams.get("id");if(!id)return respond({error:"Missing id"},400);
  const target=await db.studioUser.findUnique({where:{id}});
  if(!target)return respond({error:"Not found"},404);
  if(target.role==="SUPERADMIN"||target.id===actor.id)return respond({error:"Protected account"},403);
  // Soft delete preserves ownership and audit references.
  const [user]=await db.$transaction([db.studioUser.update({where:{id},data:{active:false},select:{id:true,email:true,name:true,role:true,active:true,updatedAt:true}}),db.studioSession.deleteMany({where:{userId:id}}),db.studioAuthToken.deleteMany({where:{userId:id}})]);
  return respond({success:true,user,message:"Account deactivated; data retained"});
}
