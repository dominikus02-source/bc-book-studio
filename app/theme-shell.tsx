"use client";
import {useEffect,useState,type ReactNode} from "react";
type Theme="light"|"dark";
export default function ThemeShell({children}:{children:ReactNode}){
 const [theme,setTheme]=useState<Theme>("light");
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const stored=window.localStorage.getItem("bc-theme");
  const current=stored==="dark"||stored!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  document.documentElement.dataset.theme=current;
  setTheme(current);
  setReady(true);
 },[]);
 function change(){const next=theme==="light"?"dark":"light";setTheme(next);document.documentElement.dataset.theme=next;document.documentElement.style.colorScheme=next;window.localStorage.setItem("bc-theme",next);}
 return <><button type="button" className="global-theme-toggle" onClick={change} aria-label={theme==="dark"?"Light: aktifkan tema terang":"Dark: aktifkan tema gelap"} aria-pressed={theme==="dark"} title={theme==="dark"?"Mode terang":"Mode gelap"} suppressHydrationWarning>{ready&&theme==="dark"?"☀":"☾"} <span>{ready&&theme==="dark"?"Light":"Dark"}</span></button>{children}</>;
}
