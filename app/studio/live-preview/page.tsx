"use client";
import {useEffect,useState} from "react";

type Snapshot={type:"snapshot";bookId:string;chapterId:string;title:string;html:string;dirty:boolean;scope:"chapter"|"all";font:"serif"|"sans";size:"small"|"medium"|"large";updatedAt:number};
export default function LivePreviewPage(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [ids,setIds]=useState<{book:string;chapter:string}|null>(null);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const book=params.get("bookId")||"",chapter=params.get("chapterId")||"";
  setIds({book,chapter});
  if(!book||!chapter||typeof BroadcastChannel==="undefined")return;
  const channel=new BroadcastChannel("bcstudio:live-preview:"+book+":"+chapter);
  channel.onmessage=event=>{
   const data=event.data as Partial<Snapshot>;
   if(data?.type==="snapshot"&&data.bookId===book&&data.chapterId===chapter&&typeof data.html==="string"&&typeof data.title==="string")setSnapshot(data as Snapshot);
  };
  const request=()=>channel.postMessage({type:"request"});
  request();
  const onVisibility=()=>{if(document.visibilityState==="visible")request()};
  document.addEventListener("visibilitychange",onVisibility);
  return ()=>{document.removeEventListener("visibilitychange",onVisibility);channel.close()};
 },[]);
 return <main className="live-book-preview-shell">
  <header className="live-book-preview-header">
   <div><strong>Pratinjau langsung · Studio Penulisan</strong><p>Perubahan blok, judul, dan gaya mengikuti editor secara langsung.</p></div>
   <div className="live-book-preview-actions"><span role="status" aria-live="polite">{!snapshot?"Menunggu editor":snapshot.dirty?"Belum tersimpan":"Tersinkronisasi"}</span><button type="button" className="secondary-button" onClick={()=>window.close()}>Tutup tab</button></div>
  </header>
  {!ids?.book||!ids?.chapter?<p role="alert">Buka pratinjau dari tab Studio Penulisan.</p>:snapshot?
   <article className={"writing-preview-paper font-"+snapshot.font+" size-"+snapshot.size} aria-label={"Pratinjau "+snapshot.title}><div dangerouslySetInnerHTML={{__html:snapshot.html}}/></article>:
   <section className="panel" role="status"><h2>Menunggu editor aktif</h2><p>Biarkan Studio Penulisan terbuka di tab lain. Untuk menyambungkan ulang, kembali ke editor dan klik Buka tab pratinjau live.</p></section>}
  <footer className="live-book-preview-footer">Pratinjau bacaan, bukan layout penerbitan. Penyimpanan naskah tetap berlangsung di editor.</footer>
 </main>;
}
