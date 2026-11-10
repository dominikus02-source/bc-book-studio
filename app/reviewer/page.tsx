import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {createHash} from "node:crypto";
import {db} from "../../lib/db";
import ReviewerWorkspace from "./reviewer-workspace";
export const dynamic="force-dynamic";
export default async function ReviewerPage(){
 const token=(await cookies()).get("bcstudio_session")?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))redirect("/login");
 const s=await db.studioSession.findUnique({where:{tokenHash:createHash("sha256").update(token).digest("hex")},include:{user:true}});
 if(!s||s.expiresAt<=new Date()||!s.user.active)redirect("/login");
 if(!["REVIEWER","ADMIN"].includes(s.user.role))redirect("/studio");
 return <ReviewerWorkspace/>;
}
