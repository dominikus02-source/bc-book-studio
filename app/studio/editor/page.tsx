import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {createHash} from "node:crypto";
import {db} from "../../../lib/db";
import FullscreenWritingEditor from "./fullscreen-writing-editor";
export const dynamic="force-dynamic";
export default async function EditorPage({searchParams}:{searchParams:Promise<{bookId?:string;chapterId?:string}>}){
 const {bookId="",chapterId=""}=await searchParams;
 const token=(await cookies()).get("bcstudio_session")?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))redirect("/login");
 const session=await db.studioSession.findUnique({where:{tokenHash:createHash("sha256").update(token).digest("hex")},include:{user:true}});
 if(!session||session.expiresAt<=new Date()||!session.user.active)redirect("/login");
 if(!bookId||!chapterId)redirect("/studio?module=Studio+Penulisan");
 return <FullscreenWritingEditor bookId={bookId} chapterId={chapterId}/>;
}
