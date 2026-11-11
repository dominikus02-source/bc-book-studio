import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import { createOneTimeToken, sendAccountEmail } from "@/lib/account";
import { StudioRole } from "@prisma/client";
import {
  AccountPolicyError,
  accountDeactivateError,
  accountMutationError,
  isAssignableRole,
} from "@/lib/account-admin";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const respond = (data: object, status = 200) => NextResponse.json(data, { status, headers });
async function guard(req: NextRequest) {
  const user = await sessionUser(req);
  return user?.role === "SUPERADMIN" ? user : null;
}
const validEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function activationOrigin() {
  const url = new URL(process.env.APP_ORIGIN || "https://bcbookstudio.bahasacerdas.com");
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("APP_ORIGIN must use HTTPS");
  return url.origin;
}

async function sendActivation(user: { id: string; email: string; name: string }) {
  const token = await createOneTimeToken(user.id, "activate");
  await sendAccountEmail(user.email, user.name, activationOrigin() + "/activate?token=" + encodeURIComponent(token), "activate");
}
export async function GET(req: NextRequest) {
  const actor = await guard(req);
  if (!actor) return respond({error:"Forbidden"},403);
  const users = await db.studioUser.findMany({orderBy:{createdAt:"asc"},select:{id:true,email:true,name:true,role:true,active:true,createdAt:true,updatedAt:true}});
  return respond({users, me:{id:actor.id,role:actor.role}});
}

export async function POST(req: NextRequest) {
  const actor=await guard(req);if(!actor)return respond({error:"Forbidden"},403);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return respond({error:"Invalid JSON"},400)}

  if(body.resendActivation===true){
    if(typeof body.id!=="string")return respond({error:"Missing user id"},400);
    const target=await db.studioUser.findUnique({where:{id:body.id},select:{id:true,email:true,name:true,active:true}});
    if(!target)return respond({error:"Not found"},404);
    if(target.active)return respond({error:"Account is already active"},400);
    try{
      await sendActivation(target);
      return respond({success:true,message:"Activation email sent"});
    }catch(e){
      console.error("Activation email failed",e instanceof Error?e.message:"unknown");
      await db.studioAuthToken.deleteMany({where:{userId:target.id,purpose:"activate",usedAt:null}});
      return respond({error:"Activation email could not be delivered"},503);
    }
  }

  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const name=typeof body.name==="string"?body.name.trim():"";
  if(!validEmail(email)||name.length<2||name.length>120||!isAssignableRole(body.role))return respond({error:"Invalid account details"},400);
  if(body.role==="SUPERADMIN" && actor.role!=="SUPERADMIN")return respond({error:"Only a superadmin can assign or remove the superadmin role"},403);
  try {
    const user=await db.studioUser.create({data:{email,name,role:body.role,active:false},select:{id:true,email:true,name:true,role:true,active:true}});
    try {
      await sendActivation(user);
    }catch(e){console.error("Activation email failed",e instanceof Error?e.message:"unknown");await db.studioAuthToken.deleteMany({where:{userId:user.id,purpose:"activate",usedAt:null}});return respond({user,warning:"Account created but activation email could not be delivered"},201)}
    return respond({user},201);
  }catch(e){if(typeof e==="object"&&e&&"code" in e&&e.code==="P2002")return respond({error:"Email already exists"},409);throw e}
}

export async function PATCH(req:NextRequest){
  const actor=await guard(req);if(!actor)return respond({error:"Forbidden"},403);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return respond({error:"Invalid JSON"},400)}
  if(typeof body.id!=="string")return respond({error:"Missing user id"},400);
  const data:{name?:string;role?:StudioRole;active?:boolean}={};
  if(body.name!==undefined){if(typeof body.name!=="string"||body.name.trim().length<2||body.name.trim().length>120)return respond({error:"Invalid name"},400);data.name=body.name.trim()}
  if(body.role!==undefined){if(!isAssignableRole(body.role))return respond({error:"Invalid role"},400);data.role=body.role}
  if(body.active!==undefined){if(typeof body.active!=="boolean")return respond({error:"Invalid status"},400);data.active=body.active}
  if(!Object.keys(data).length)return respond({error:"No changes"},400);
  try {
    const user=await db.$transaction(async tx=>{
      const target=await tx.studioUser.findUnique({where:{id:body.id as string}});
      if(!target) throw new AccountPolicyError("Not found",404);
      const count=await tx.studioUser.count({where:{role:"SUPERADMIN",active:true}});
      const denied=accountMutationError(actor,target,data,count);
      if(denied) throw new AccountPolicyError(denied,403);
      const updated=await tx.studioUser.update({where:{id:target.id},data,select:{id:true,email:true,name:true,role:true,active:true,updatedAt:true}});
      if(data.active===false)await tx.studioSession.deleteMany({where:{userId:target.id}});
      return updated;
    });
    return respond({user});
  } catch(e){
    if(e instanceof AccountPolicyError) return respond({error:e.message},e.status);
    throw e;
  }
}

export async function DELETE(req:NextRequest){
  const actor=await guard(req);if(!actor)return respond({error:"Forbidden"},403);
  const id=new URL(req.url).searchParams.get("id");if(!id)return respond({error:"Missing id"},400);
  try {
    await db.$transaction(async tx=>{
      const target=await tx.studioUser.findUnique({where:{id}});
      if(!target) throw new AccountPolicyError("Not found",404);
      if(!target.active) throw new AccountPolicyError("Account is already inactive",400);
      const count=await tx.studioUser.count({where:{role:"SUPERADMIN",active:true}});
      const denied=accountDeactivateError(actor,target,count);
      if(denied) throw new AccountPolicyError(denied,403);
      // Soft delete preserves ownership and audit references.
      await tx.studioUser.update({where:{id},data:{active:false}});
      await tx.studioSession.deleteMany({where:{userId:id}});
    });
    return respond({success:true,message:"Account deactivated; data retained"});
  } catch(e){
    if(e instanceof AccountPolicyError) return respond({error:e.message},e.status);
    throw e;
  }
}
