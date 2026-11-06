"use client";
import {useEffect} from "react";

// Revalidate pages restored from browser history without treating navigation as logout.
export default function SessionHistoryGuard({authenticatedPage=false}:{authenticatedPage?:boolean}){
 useEffect(()=>{
  let disposed=false;
  const controller=new AbortController();
  const check=async()=>{
   try{
    const response=await fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store",signal:controller.signal});
    if(!response.ok)return;
    const session=await response.json();
    if(disposed)return;
    if(authenticatedPage&&session.authenticated===false)window.location.replace("/login");
    if(!authenticatedPage&&session.authenticated===true)window.location.replace("/studio");
   }catch{/* A temporary connection error must not log the user out. */}
  };
  const restore=(event:PageTransitionEvent)=>{if(event.persisted)void check();};
  void check();
  window.addEventListener("pageshow",restore);
  return()=>{disposed=true;controller.abort();window.removeEventListener("pageshow",restore);};
 },[authenticatedPage]);
 return null;
}
