import {redirect} from "next/navigation";
import {currentSessionUser} from "../../lib/server-session";
import Dashboard from "./dashboard";
export const dynamic="force-dynamic";
export default async function StudioPage(){
 if(!await currentSessionUser())redirect("/login");
 return <Dashboard/>;
}
