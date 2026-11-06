import {Suspense} from "react";
import {redirect} from "next/navigation";
import {currentSessionUser} from "../../lib/server-session";
import AuthPanel from "../auth-panel";
import SessionHistoryGuard from "../../components/session-history-guard";
export const dynamic="force-dynamic";
export default async function Page(){
 if(await currentSessionUser())redirect("/studio");
 return <><SessionHistoryGuard/><Suspense fallback={<main className="auth-screen">Memuat...</main>}><AuthPanel mode="login"/></Suspense></>;
}
