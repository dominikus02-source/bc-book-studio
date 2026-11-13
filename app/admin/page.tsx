import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {createHash} from "node:crypto";
import {db} from "@/lib/db";
export const dynamic="force-dynamic";
export default async function AdminPage(){
 const token=(await cookies()).get("bcstudio_session")?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))redirect("/login?module=Manajemen%20Akun");
 const session=await db.studioSession.findUnique({where:{tokenHash:createHash("sha256").update(token).digest("hex")},include:{user:true}});
 if(!session||session.expiresAt<=new Date()||!session.user.active)redirect("/login?module=Manajemen%20Akun");
 if(session.user.role!=="SUPERADMIN")redirect("/studio");
 redirect("/studio?module=Manajemen%20Akun");
}
