"use client";
import {useCallback,useEffect,useState} from "react";

const viewKey=(label:string)=>label.toLowerCase().replace(/\s+/g,"-");
export function useStudioNavigation(views:readonly string[]){
 const [active,setActive]=useState(views[0]);
 useEffect(()=>{
  const restore=()=>{
   const requested=new URL(window.location.href).searchParams.get("view");
   setActive(views.find(view=>viewKey(view)===requested)||views[0]);
  };
  restore();
  window.addEventListener("popstate",restore);
  window.addEventListener("pageshow",restore);
  return()=>{window.removeEventListener("popstate",restore);window.removeEventListener("pageshow",restore);};
 },[views]);
 const navigate=useCallback((view:string)=>{
  if(!views.includes(view))return;
  const url=new URL(window.location.href);
  if(view===views[0])url.searchParams.delete("view");
  else url.searchParams.set("view",viewKey(view));
  if(url.href!==window.location.href)window.history.pushState(null,"",url);
  setActive(view);
 },[views]);
 return [active,navigate] as const;
}
