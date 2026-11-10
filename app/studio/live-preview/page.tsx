"use client";
import {useEffect,useRef,useState,type DragEvent} from "react";
import "./live-preview.css";
import {bookSidebarCss} from "../../../lib/book-sidebar";
import {paperSpec} from "../../../lib/paper-sizes";
import "../../../components/editing-preview.css";

type Snapshot={type:"snapshot";bookId:string;chapterId:string;title:string;html:string;dirty:boolean;scope:"chapter"|"all";font:"serif"|"sans";size:"small"|"medium"|"large";updatedAt:number;paper?:string;activeBlockId?:string|null;activeLabel?:string};
export default function LivePreviewPage(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [ids,setIds]=useState<{book:string;chapter:string}|null>(null);
 const [now,setNow]=useState(()=>Date.now());
 const [refreshCount,setRefreshCount]=useState(0);
 const [lastReceivedAt,setLastReceivedAt]=useState<number|null>(null);
 const [isFullscreen,setIsFullscreen]=useState(false);
 const [isDragOver,setIsDragOver]=useState(false);
 const [dropStatus,setDropStatus]=useState("");
 const previewShellRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const book=params.get("bookId")||"",chapter=params.get("chapterId")||"";
  setIds({book,chapter});
  if(!book||!chapter||typeof BroadcastChannel==="undefined")return;
  const channel=new BroadcastChannel("bcstudio:live-preview:"+book+":"+chapter);
  channel.onmessage=event=>{
   const data=event.data as {type?:string;bookId?:string;chapterId?:string;html?:string;title?:string;font?:string;size?:string;requestId?:string;ok?:boolean;label?:string;reason?:string};
   if(data?.type==="snapshot"&&data.bookId===book&&data.chapterId===chapter&&typeof data.html==="string"&&typeof data.title==="string"&&["serif","sans"].includes(data.font||"")&&["small","medium","large"].includes(data.size||"")){
    setSnapshot(data as Snapshot);
    setLastReceivedAt(Date.now());
   }else if(data?.type==="insert-result"&&typeof data.requestId==="string"){
    setDropStatus(data.ok?`Komponen ${typeof data.label==="string"?data.label:"baru"} ditambahkan ke naskah.`:typeof data.reason==="string"?data.reason:"Komponen gagal ditambahkan.");
   }
  };
  const request=()=>channel.postMessage({type:"request"});
  request();
  const onVisibility=()=>{if(document.visibilityState==="visible")request()};
  document.addEventListener("visibilitychange",onVisibility);
  const heartbeat=window.setInterval(()=>{setNow(Date.now());request()},4000);
  return ()=>{window.clearInterval(heartbeat);document.removeEventListener("visibilitychange",onVisibility);channel.close()};
 },[refreshCount]);
 useEffect(()=>{
  const syncFullscreen=()=>setIsFullscreen(Boolean(document.fullscreenElement));
  document.addEventListener("fullscreenchange",syncFullscreen);
  return ()=>document.removeEventListener("fullscreenchange",syncFullscreen);
 },[]);
 useEffect(()=>{
  if(!snapshot?.activeBlockId)return;
  previewShellRef.current?.querySelector(".book-editing-target")?.scrollIntoView({block:"nearest",behavior:"auto"});
 },[snapshot?.activeBlockId]);
 const disconnected=lastReceivedAt!==null&&now-lastReceivedAt>12000;
 function selectEditorBlock(event:React.MouseEvent<HTMLDivElement>){
  const target=event.target as HTMLElement;
  if(target.closest("a,input,select,textarea")||window.getSelection()?.toString()||!ids||disconnected)return;
  const blockId=target.closest<HTMLElement>("[data-preview-block-id]")?.dataset.previewBlockId;
  if(!blockId||typeof BroadcastChannel==="undefined")return;
  const channel=new BroadcastChannel("bcstudio:live-preview:"+ids.book+":"+ids.chapter);
  channel.postMessage({type:"select-block",bookId:ids.book,chapterId:ids.chapter,blockId});channel.close();
 }
 function receiveDroppedComponent(event:DragEvent<HTMLElement>){
  event.preventDefault();setIsDragOver(false);
  const custom=event.dataTransfer.getData("application/x-bcstudio-component");
  const value=event.dataTransfer.getData("text/plain");
  const presetId=custom|| (value.startsWith("preset:")?value.slice(7):"");
  if(!presetId){setDropStatus("Tarik komponen dari panel Komponen Buku di editor.");return}
  if(!/^[a-z0-9-]{2,80}$/.test(presetId)||!ids?.book||!ids?.chapter){setDropStatus("Komponen tidak valid.");return}
  if(typeof BroadcastChannel==="undefined"){setDropStatus("Browser ini belum mendukung sinkronisasi antartab.");return}
  const channel=new BroadcastChannel("bcstudio:live-preview:"+ids.book+":"+ids.chapter);
  channel.postMessage({type:"insert-preset",presetId,requestId:crypto.randomUUID()});
  channel.close();setDropStatus("Komponen dikirim ke editor. Menunggu pembaruan pratinjau...");
 }
 return <main ref={previewShellRef} className={"live-book-preview-shell"+(isDragOver?" is-component-drop-target":"")} onDragOver={event=>{if(event.dataTransfer.types.includes("application/x-bcstudio-component")||event.dataTransfer.types.includes("text/plain")){event.preventDefault();event.dataTransfer.dropEffect="copy";setIsDragOver(true)}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setIsDragOver(false)}} onDrop={receiveDroppedComponent}>
  <style>{bookSidebarCss}</style>
  <header className="live-book-preview-header">
   <div><strong>Pratinjau langsung · Studio Penulisan</strong><p>Perubahan blok, judul, dan gaya mengikuti editor secara langsung.</p></div>
   <div className="live-book-preview-actions"><span role="status" aria-live="polite">{disconnected?"Koneksi editor terputus":!snapshot?"Menunggu editor":snapshot.dirty?"Belum tersimpan":"Tersinkronisasi"}</span><button type="button" className="secondary-button" onClick={()=>{setNow(Date.now());setRefreshCount(value=>value+1)}}>Sambungkan ulang</button><button type="button" className="secondary-button live-preview-fullscreen-button" aria-pressed={isFullscreen} onClick={async()=>{try{if(document.fullscreenElement){await document.exitFullscreen()}else{await previewShellRef.current?.requestFullscreen()}}catch{setIsFullscreen(Boolean(document.fullscreenElement))}}}>{isFullscreen?"Keluar layar penuh":"Layar penuh"}</button><button type="button" className="secondary-button" onClick={()=>window.close()}>Tutup tab</button></div>
  </header>
  {!ids?.book||!ids?.chapter?<p role="alert">Buka pratinjau dari tab Studio Penulisan.</p>:snapshot?
   <article tabIndex={0} style={{boxSizing:"border-box",width:"min(100%, "+(paperSpec(snapshot.paper)?.widthMm??210)+"mm)",marginInline:"auto"}} className={"writing-preview-paper font-"+snapshot.font+" size-"+snapshot.size} aria-label={"Pratinjau "+snapshot.title}><p className="book-editing-status" role="status">{!disconnected&&snapshot.activeLabel?"Sedang diedit: "+snapshot.activeLabel:"Pilih blok pada editor untuk melihat penandanya."}</p><div className="live-preview-drop-hint" aria-live="polite">{isDragOver?"Lepaskan untuk menambahkan komponen ke naskah":"Tarik komponen dari panel Komponen Buku di editor ke area ini"}</div><div onClick={selectEditorBlock} dangerouslySetInnerHTML={{__html:snapshot.html}}/></article>:
   <section className="panel" role="status"><h2>Menunggu editor aktif</h2><p>Biarkan Studio Penulisan terbuka di tab lain. Untuk menyambungkan ulang, kembali ke editor dan klik Buka tab pratinjau live.</p></section>}
  {dropStatus&&<p className="live-preview-drop-status" role="status" aria-live="polite">{dropStatus}</p>}
  <footer className="live-book-preview-footer">Pratinjau interaktif: tarik komponen dari editor ke halaman ini. Perubahan disinkronkan ke editor dan disimpan otomatis.</footer>
 </main>;
}
