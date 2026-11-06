import {cookies} from "next/headers";
import {createHash} from "node:crypto";
import {db} from "./db";

export async function currentSessionUser(){
 const raw=(await cookies()).get("bcstudio_session")?.value;
 if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;
 const session=await db.studioSession.findUnique({where:{tokenHash:createHash("sha256").update(raw).digest("hex")},include:{user:true}});
 if(!session||session.expiresAt<=new Date()||!session.user.active)return null;
 return {id:session.user.id,email:session.user.email,name:session.user.name,role:session.user.role};
}
