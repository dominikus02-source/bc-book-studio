"use client";
import {useEffect,useState} from "react";

type ArchivedChapter={id:string;title:string;updatedAt:string};

export default function ChapterArchive({id,activeChapters,onChanged}:{
 id:string;activeChapters:readonly unknown[];onChanged:()=>Promise<void>;
}){
 const [entries,setEntries]=useState<ArchivedChapter[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const path="/api/books/"+id+"/chapters";
 useEffect(()=>{
  const controller=new AbortController();
  fetch(path,{cache:"no-store",signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error("Arsip bab gagal dimuat.");
   const data=await response.json();
   if(!controller.signal.aborted)setEntries(data.archived);
  }).catch(error=>{if(!controller.signal.aborted)setError(error.message)});
  return()=>controller.abort();
 },[path,activeChapters]);
 async function restore(chapter:ArchivedChapter){
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(path+"/"+chapter.id,{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({restoreArchived:true,expectedVersion:chapter.updatedAt}),
   });
   if(!response.ok)throw Error((await response.json()).error||"Bab gagal dipulihkan.");
   setEntries(current=>current.filter(entry=>entry.id!==chapter.id));
   await onChanged();
   setNotice("Bab dipulihkan di akhir daftar.");
  }catch(error){setError(error instanceof Error?error.message:"Bab gagal dipulihkan.")}
  finally{setBusy(false)}
 }
 return <details>
  <summary>Arsip bab ({entries.length})</summary>
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert">{error}</p>}
  {!entries.length&&<p>Belum ada bab di arsip.</p>}
  <ul>{entries.map(chapter=><li key={chapter.id} style={{overflowWrap:"anywhere"}}>
   {chapter.title} <button type="button" className="secondary-button" style={{minHeight:44}} disabled={busy}
    aria-label={"Pulihkan bab "+chapter.title} onClick={()=>void restore(chapter)}>Pulihkan bab</button>
  </li>)}</ul>
 </details>;
}
