import { Suspense } from "react";
import AuthPanel from "../auth-panel";
import PublicHeader from "@/components/public-header";

export default function Page() {
  return (
    <div className="lp">
      <PublicHeader />
      <Suspense fallback={<main className="lp-auth"><p>Memuat...</p></main>}>
        <AuthPanel mode="login" />
      </Suspense>
    </div>
  );
}
