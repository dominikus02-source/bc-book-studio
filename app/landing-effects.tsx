"use client";
import {useEffect} from "react";
export default function LandingEffects(){
 useEffect(()=>{
  const mq=window.matchMedia("(prefers-reduced-motion: reduce)");
  const cards=[...document.querySelectorAll<HTMLElement>(".feature-card")];
  const hero=document.querySelector<HTMLElement>(".hero-art");
  const onMove=(event:MouseEvent)=>{
   if(mq.matches)return;
   const node=event.currentTarget as HTMLElement;
   const rect=node.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width-.5,y=(event.clientY-rect.top)/rect.height-.5;
   node.style.setProperty("--rx",(-y*7).toFixed(2)+"deg");
   node.style.setProperty("--ry",(x*7).toFixed(2)+"deg");
  };
  const onLeave=(event:MouseEvent)=>{const node=event.currentTarget as HTMLElement;node.style.setProperty("--rx","0deg");node.style.setProperty("--ry","0deg");};
  const nodes=[...cards,...(hero?[hero]:[])];
  nodes.forEach(node=>{node.addEventListener("mousemove",onMove);node.addEventListener("mouseleave",onLeave)});
  return ()=>nodes.forEach(node=>{node.removeEventListener("mousemove",onMove);node.removeEventListener("mouseleave",onLeave)});
 },[]);
 return null;
}
