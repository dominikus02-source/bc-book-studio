import { Suspense } from "react";
import AuthPanel from "../auth-panel";
export default function Page(){return <Suspense fallback={<main className="auth-screen">Memuat...</main>}><AuthPanel mode="reset-password"/></Suspense>}
