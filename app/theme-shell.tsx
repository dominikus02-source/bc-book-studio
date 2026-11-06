"use client";
import {useEffect,useState,type ReactNode} from "react";
import {usePathname} from "next/navigation";
export default function ThemeShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 const [dark,setDark]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem("bcstudio-theme");const mode=saved==="dark"||(!saved&&matchMedia("(prefers-color-scheme:dark)").matches);setDark(mode);document.documentElement.dataset.theme=mode?"dark":"light";},[]);
 function toggle(){const next=!dark;setDark(next);document.documentElement.dataset.theme=next?"dark":"light";localStorage.setItem("bcstudio-theme",next?"dark":"light");}
 return <><button type="button" className={pathname==="/studio"?"dashboard-global-theme-switch":"public-theme-switch"} onClick={toggle} aria-label={dark?"Light: aktifkan tema terang":"Dark: aktifkan tema gelap"} aria-pressed={dark}><span aria-hidden="true">{dark?"☀":"☾"}</span><span>{dark?"Light":"Dark"}</span></button>{children}</>;
}
