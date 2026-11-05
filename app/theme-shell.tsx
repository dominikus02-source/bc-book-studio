"use client";
import {useEffect,useState,type ReactNode} from "react";
type Theme="light"|"dark";
export default function ThemeShell({children}:{children:ReactNode}){
 const [theme,setTheme]=useState<Theme>("light");
 useEffect(()=>{const stored=localStorage.getItem("bc-theme");const system=window.matchMedia("(prefers-color-scheme: dark)").matches;setTheme(stored==="dark"||stored!=="light"&&system?"dark":"light")},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;localStorage.setItem("bc-theme",theme)},[theme]);
 return <><button type="button" className="theme-toggle" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} aria-label={theme==="dark"?"Aktifkan mode terang":"Aktifkan mode gelap"} title={theme==="dark"?"Mode terang":"Mode gelap"} aria-pressed={theme==="dark"}>{theme==="dark"?"☀":"☾"}<span>{theme==="dark"?"Light":"Dark"}</span></button>{children}</>;
}
