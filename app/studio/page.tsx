import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { db } from "../../lib/db";
import Dashboard from "./dashboard";
export const dynamic="force-dynamic";
export default async function StudioPage() {
 const token=(await cookies()).get("bcstudio_session")?.value;
 if(!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/login");
 const tokenHash=createHash("sha256").update(token).digest("hex");
 const session=await db.studioSession.findUnique({where:{tokenHash},include:{user:true}});
 if(!session || session.expiresAt<=new Date() || !session.user.active) redirect("/login");
 return <Dashboard/>;
}
