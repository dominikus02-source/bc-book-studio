"use client";
import {useEffect,useState,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {isEditorialPublicPath} from "@/lib/public-theme-paths";
export default function ThemeShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 const [dark,setDark]=useState(false);
 useEffect(()=>{
   const stored=localStorage.getItem("bcstudio-theme");
   const mode=stored==="dark"||(!stored&&window.matchMedia("(prefers-color-scheme: dark)").matches);
   setDark(mode);document.documentElement.dataset.theme=mode?"dark":"light";
 },[]);
 useEffect(()=>{
   const sync=()=>setDark(document.documentElement.dataset.theme==="dark");
   window.addEventListener("storage",sync);window.addEventListener("bc-theme-change",sync);
   return()=>{window.removeEventListener("storage",sync);window.removeEventListener("bc-theme-change",sync)};
 },[]);
 function toggle(){const mode=!dark;setDark(mode);document.documentElement.dataset.theme=mode?"dark":"light";localStorage.setItem("bcstudio-theme",mode?"dark":"light");}
 const showPublicSwitch=pathname!=="/studio"&&!isEditorialPublicPath(pathname);
 return <>{showPublicSwitch&&<button className="public-theme-switch" type="button" aria-label={dark?"Light: aktifkan tema terang":"Dark: aktifkan tema gelap"} aria-pressed={dark} onClick={toggle}><span aria-hidden="true">{dark?"☀":"☾"}</span><span>{dark?"Light":"Dark"}</span></button>}{children}</>;
}
