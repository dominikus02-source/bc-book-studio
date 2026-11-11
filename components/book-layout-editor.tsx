"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {layoutSettings,type LayoutSettings} from "../lib/book-layout";
import BookLayoutTransfer from "./book-layout-transfer";
type Block={index:number;kind:string;excerpt:string};
type Layout={snapshot:string;version:number;saved:boolean;locked:boolean;chapters:{position:number;title:string;excerpt:string;blocks:Block[]}[];settings:LayoutSettings;history:{version:number;archivedAt:string|null;createdAt:string}[]};
export default function BookLayoutEditor({id,onPublish}:{id:string;onPublish:()=>void}){
 const [layout,setLayout]=useState<Layout|null>(null),[settings,setSettings]=useState<LayoutSettings|null>(null);
 const [busy,setBusy]=useState(true),[baseVersion,setBaseVersion]=useState(0),[conflict,setConflict]=useState(false);
 const [drag,setDrag]=useState<number|null>(null),[blockDrag,setBlockDrag]=useState<{chapter:number;index:number}|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[view,setView]=useState<"print"|"read">("print");
 const inflight=useRef(false),url="/api/books/"+encodeURIComponent(id)+"/layout",key="bc-layout-draft:"+id;
 const load=useCallback(async(signal?:AbortSignal,discard=false)=>{
  setBusy(true);setError("");
  try{
   const response=await fetch(url,{cache:"no-store",signal}),data:Layout&{error?:string}=await response.json();
   if(!response.ok)throw Error(data.error||"Tata letak gagal dimuat.");
   if(signal?.aborted)return;
   let recovered:LayoutSettings|null=null,recoveredVersion=data.version;
   try{
    if(discard)localStorage.removeItem(key);
    else {const draft=JSON.parse(localStorage.getItem(key)||"null");const parsed=layoutSettings.safeParse(draft?.settings);
     if(draft?.snapshot===data.snapshot&&Number.isInteger(draft?.baseVersion)&&parsed.success){recovered=parsed.data;recoveredVersion=draft.baseVersion}}
   }catch{}
   const stale=!!recovered&&recoveredVersion!==data.version;
   setLayout(data);setSettings(recovered??data.settings);setBaseVersion(recoveredVersion);setConflict(stale);
   setNotice(recovered?"Perubahan lokal dipulihkan. Periksa sebelum menyimpan.":"");
   if(stale)setError("Konflik versi. Draf lokal tetap ada; unduh salinannya atau muat versi server.");
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:"Tata letak gagal dimuat.")}
  finally{if(!signal?.aborted)setBusy(false)}
 },[key,url]);
 useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort()},[load]);
 const dirty=!!layout&&!!settings&&JSON.stringify(settings)!==JSON.stringify(layout.settings);
 const editable=!!layout&&!layout.locked&&!busy;
 useEffect(()=>{
  if(!dirty||!layout||!settings)return;
  try{localStorage.setItem(key,JSON.stringify({snapshot:layout.snapshot,baseVersion,settings}))}catch{}
 },[baseVersion,dirty,key,layout,settings]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty]);
 const save=useCallback(async(value:LayoutSettings|null,restoreVersion?:number)=>{
  if(!layout||!editable||inflight.current||conflict)return;
  if(!value&&!restoreVersion&&!confirm("Arsipkan tata letak? Riwayat tetap tersimpan dan dapat dipulihkan."))return;
  inflight.current=true;setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({snapshot:layout.snapshot,expectedVersion:baseVersion,...(restoreVersion?{restoreVersion}:{settings:value})})});
   const data=await response.json();if(response.status===409)setConflict(true);
   if(!response.ok)throw Error(data.error||"Penyimpanan gagal. Draf lokal tetap tersimpan.");
   await load(undefined,true);setNotice(restoreVersion?"Versi lama dipulihkan sebagai versi baru.":value?"Tata letak tersimpan otomatis di database.":"Tata letak diarsipkan; riwayat tetap tersedia.");
  }catch(e){setError(e instanceof Error?e.message:"Tata letak gagal disimpan; perubahan lokal tetap ada.")}
  finally{inflight.current=false;setBusy(false)}
 },[baseVersion,conflict,editable,layout,load,url]);
 useEffect(()=>{if(!editable||!dirty||!settings||error||drag!==null||blockDrag)return;const t=setTimeout(()=>void save(settings),900);return()=>clearTimeout(t)},[blockDrag,dirty,drag,editable,error,save,settings]);
 function move(position:number,target:number){if(!editable||position===target)return;setSettings(current=>{if(!current)return current;const order=[...current.order],from=order.indexOf(position),to=order.indexOf(target);if(from<0||to<0)return current;order.splice(from,1);order.splice(to,0,position);return {...current,order}});setNotice("")}
 function moveBlock(chapter:number,index:number,target:number){if(!editable||index===target)return;setSettings(current=>{if(!current||!layout)return current;const order=[...(current.blocks?.[chapter]??layout.chapters.find(c=>c.position===chapter)!.blocks.map(b=>b.index))];const from=order.indexOf(index),to=order.indexOf(target);if(from<0||to<0)return current;order.splice(from,1);order.splice(to,0,index);return {...current,blocks:{...current.blocks,[chapter]:order}}});setNotice("")}
 function reload(){if(!dirty||confirm("Muat versi server? Unduh draf lokal terlebih dahulu jika ingin menyimpannya."))void load(undefined,true)}
 function download(){const blob=new Blob([JSON.stringify({bookId:id,snapshot:layout?.snapshot,baseVersion,settings},null,2)],{type:"application/json"}),href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download="layout-local-"+id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)}
 return <section className="panel layout-output" aria-labelledby="book-layout-title">
  <h2 id="book-layout-title">Tata letak buku</h2>
  <p className="form-hint">Atur urutan bab dan blok dari snapshot yang disetujui. Isi blok tidak disunting melalui layout. Perubahan disimpan otomatis; riwayat dapat dipulihkan.</p>
  <a href={"/studio?bookId="+encodeURIComponent(id)+"&module=Tata+Letak"}>Atur penomoran halaman (di Tata Letak)</a>
  <p role="status" aria-live="polite">{busy?"Memproses tata letak...":error&&dirty?"Perubahan belum tersimpan; draf lokal tetap ada.":dirty?"Menunggu penyimpanan...":notice|| (layout?.saved?"Tata letak tersimpan.":"")}</p>
  {error&&<div role="alert"><p>{error}</p><button type="button" className="secondary-button" disabled={busy} onClick={reload}>Muat versi server</button>{dirty&&<button type="button" className="secondary-button" onClick={download}>Unduh draf layout lokal</button>}{!conflict&&dirty&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void save(settings)}>Coba simpan lagi</button>}</div>}
  {layout&&settings&&<>
   <p className="form-hint">Snapshot: {layout.snapshot}. Versi layout: {layout.version}.</p>
   {layout.locked&&<p>Publikasi aktif. Tarik publikasi sebelum mengubah layout.</p>}
   <label className="studio-field"><span>Ukuran halaman</span><select value={settings.pageSize} disabled={!editable} onChange={e=>setSettings({...settings,pageSize:e.target.value as LayoutSettings["pageSize"]})}><option>A4</option><option>A5</option><option>B5</option></select></label>
   <div className="layout-format-tabs" aria-label="Mode kanvas">{(["print","read"] as const).map(v=><button type="button" className="secondary-button" key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v==="print"?"Cetak":"Baca ulang"}</button>)}</div>
   <ol aria-label="Urutan tata letak" className="book-layout-canvas" data-view={view} data-size={settings.pageSize}>
   {settings.order.map((position,index)=>{const c=layout.chapters.find(ch=>ch.position===position)!;const order=settings.blocks?.[position]??c.blocks.map(b=>b.index);return <li key={position} onDragOver={e=>{if(editable&&drag!==null)e.preventDefault()}} onDrop={e=>{if(drag!==null){e.preventDefault();move(drag,position);setDrag(null)}}} style={{paddingBlock:8,overflowWrap:"anywhere"}}>
    <div className="chapter-sort-heading"><strong>{c.title}</strong><button type="button" className="secondary-button" aria-label={"Seret bab "+c.title} draggable={editable} disabled={!editable} onDragStart={e=>{setDrag(position);e.dataTransfer.setData("text/plain",String(position))}} onDragEnd={()=>setDrag(null)}>Seret</button></div>
    <div className="layout-format-tabs"><button type="button" className="secondary-button" aria-label={"Naikkan "+c.title} disabled={!editable||index===0} onClick={()=>move(position,settings.order[index-1])}>Naikkan</button><button type="button" className="secondary-button" aria-label={"Turunkan "+c.title} disabled={!editable||index===settings.order.length-1} onClick={()=>move(position,settings.order[index+1])}>Turunkan</button></div>
    <details><summary>Atur blok {c.title} ({c.blocks.length})</summary><ol aria-label={"Blok layout "+c.title}>{order.map((bi,i)=>{const b=c.blocks.find(x=>x.index===bi)!;return <li key={bi} data-layout-block={bi} onDragOver={e=>{if(editable&&blockDrag?.chapter===position){e.preventDefault();e.stopPropagation()}}} onDrop={e=>{e.stopPropagation();if(blockDrag?.chapter===position){e.preventDefault();moveBlock(position,blockDrag.index,bi);setBlockDrag(null)}}}>
     <p><strong>{b.kind} · Blok {bi}</strong></p><p style={{whiteSpace:"pre-wrap"}}>{b.excerpt}</p>
     <div className="layout-format-tabs"><button type="button" className="secondary-button" disabled={!editable} draggable={editable} aria-label={"Seret blok "+bi+" bab "+position} onDragStart={e=>{e.stopPropagation();setBlockDrag({chapter:position,index:bi});e.dataTransfer.setData("text/plain",String(bi))}} onDragEnd={()=>setBlockDrag(null)}>Seret blok</button>
     <button type="button" className="secondary-button" aria-label={"Naikkan blok "+bi+" bab "+position} disabled={!editable||i===0} onClick={()=>moveBlock(position,bi,order[i-1])}>Naikkan blok</button>
     <button type="button" className="secondary-button" aria-label={"Turunkan blok "+bi+" bab "+position} disabled={!editable||i===order.length-1} onClick={()=>moveBlock(position,bi,order[i+1])}>Turunkan blok</button></div>
    </li>})}</ol></details>
   </li>})}</ol>
   <BookLayoutTransfer key={layout.snapshot+":"+layout.version} id={id} layout={layout} settings={settings} disabled={!editable} onApply={next=>setSettings({...settings,...next})}/>
   <div className="layout-format-tabs">
    {!layout.saved&&!dirty&&<button type="button" className="primary-button" disabled={!editable} onClick={()=>void save(settings)}>Gunakan tata letak bawaan</button>}
    <button type="button" className="secondary-button" disabled={!editable||!layout.saved||dirty||conflict} onClick={()=>void save(null)}>Arsipkan tata letak</button>
    {!dirty&&layout.saved&&<a className="secondary-button" href={"/api/books/"+id+"/export?format=html&preview=1&layout=1&view=1"} target="_blank" rel="noreferrer">Pratinjau layout tersimpan</a>}
    <button type="button" className="secondary-button" disabled={!layout.saved||dirty||busy||conflict} onClick={onPublish}>Lanjut ke Penerbitan</button>
   </div>
   <details><summary>Riwayat tata letak</summary>{layout.history.length?layout.history.map(h=><p key={h.version}>Versi {h.version}{h.archivedAt?" (arsip)":""} · {new Date(h.createdAt).toLocaleString("id-ID")} <button type="button" className="secondary-button" aria-label={"Pulihkan layout versi "+h.version} disabled={!editable||dirty||conflict||h.version===layout.version} onClick={()=>{if(confirm("Pulihkan versi "+h.version+" sebagai versi baru? Riwayat tetap tersimpan."))void save(settings,h.version)}}>Pulihkan</button></p>):<p>Riwayat dimulai saat layout pertama disimpan.</p>}</details>
  </>}
 </section>;
}
