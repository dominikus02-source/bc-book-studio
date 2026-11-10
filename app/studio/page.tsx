import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { db } from "../../lib/db";
import Dashboard from "./dashboard";
export const dynamic="force-dynamic";
const accessibleModules=["Dasbor","Proyek Buku","Buat Buku","Idea Lab","Rancang","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Review Naskah","Tinjauan Pedagogis","Tata Letak","Penerbitan","Pusat Agen","Pengaturan","ISBN & Legalitas","Percetakan","Petunjuk Penggunaan","Manajemen Akun"];
export default async function StudioPage({searchParams}:{searchParams:Promise<{module?:string}>}) {
 const {module}=await searchParams;
 const loginHref=typeof module==="string"&&accessibleModules.includes(module)?"/login?module="+encodeURIComponent(module):"/login";
 const token=(await cookies()).get("bcstudio_session")?.value;
 if(!token || !/^[a-f0-9]{64}$/.test(token)) redirect(loginHref);
 const tokenHash=createHash("sha256").update(token).digest("hex");
 const session=await db.studioSession.findUnique({where:{tokenHash},include:{user:true}});
 if(!session || session.expiresAt<=new Date() || !session.user.active) redirect(loginHref);
 return <Dashboard role={session.user.role}/>;
}
