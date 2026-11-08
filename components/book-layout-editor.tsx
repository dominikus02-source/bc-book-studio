"use client";

import {useCallback,useEffect,useState} from "react";
import BookLayoutTransfer from "./book-layout-transfer";
type Settings={pageSize:"A4"|"A5"|"B5";order:number[]};
type Layout={snapshot:string;version:number;saved:boolean;locked:boolean;chapters:{position:number;title:string;excerpt:string}[];settings:Settings};

export default function BookLayoutEditor({id,onPublish}:{id:string;onPublish:()=>void}){
 const [layout,setLayout]=useState<Layout|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [busy,setBusy]=useState(true);
 const [drag,setDrag]=useState<number|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [view,setView]=useState<"print"|"read">("print");
 const url="/api/books/"+encodeURIComponent(id)+"/layout";
 const load=useCallback(async(signal?:AbortSignal)=>{
  setBusy(true);setError("");
  try{
   const response=await fetch(url,{cache:"no-store",signal});
   const data=await response.json();
   if(!response.ok)throw Error(data.error);
   if(!signal?.aborted){setLayout(data);setSettings(data.settings)}
  }catch(cause){if(!signal?.aborted)setError(cause instanceof Error?cause.message:"Tata letak gagal dimuat.")}
  finally{if(!signal?.aborted)setBusy(false)}
 },[url]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort()},[load]);
 const dirty=JSON.stringify(settings)!==JSON.stringify(layout?.settings??null);
 const editable=!!layout&&!layout.locked&&!busy;
 function move(position:number,target:number){
  if(!editable||position===target)return;
  setSettings(current=>{
   if(!current)return current;
   const order=current.order.slice();
   const from=order.indexOf(position),to=order.indexOf(target);
   if(from<0||to<0)return current;
   order.splice(from,1);order.splice(to,0,position);
   return {...current,order};
  });
  setNotice("");
 }
 const save=useCallback(async(value:Settings|null)=>{
  if(!layout||!editable)return;
  if(!value&&!confirm("Arsipkan tata letak ini dan kembali ke urutan snapshot?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({snapshot:layout.snapshot,expectedVersion:layout.version,settings:value})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error);
   if(value){
    setLayout({...layout,settings:value,version:data.version,saved:true});
   }else{
    await load();
   }
   setNotice(value?"Tata letak tersimpan otomatis di buku ini.":"Tata letak diarsipkan.");
  }catch(cause){setError(cause instanceof Error?cause.message:"Tata letak gagal disimpan.")}
  finally{setBusy(false)}
 },[editable,layout,load,url]);
 useEffect(()=>{
  if(!editable||!dirty||!settings||error||drag!==null)return;
  const timer=window.setTimeout(()=>void save(settings),900);
  return()=>window.clearTimeout(timer);
 },[dirty,drag,editable,error,save,settings]);
 useEffect(()=>{
  if(!dirty)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};
  window.addEventListener("beforeunload",warn);
  return()=>window.removeEventListener("beforeunload",warn);
 },[dirty]);
 return <section className="panel layout-output" aria-labelledby="book-layout-title">
  <h2 id="book-layout-title">Tata letak buku</h2>
  <p><a className="secondary-button" href={"/studio?module=Pengaturan&bookId="+encodeURIComponent(id)}>Atur penomoran halaman buku →</a></p>
  <p className="form-hint">Seret bab di kanvas atau ubah ukuran halaman. Perubahan disimpan otomatis. Isi naskah tetap terikat pada snapshot Review.</p>
  {busy&&<p role="status">Memproses tata letak…</p>}
  {error&&<p role="alert">{error}</p>}
  <p role="status" aria-live="polite">{busy&&dirty?"Menyimpan tata letak…":error&&dirty?"Perubahan belum tersimpan.":dirty?"Perubahan menunggu simpan otomatis…":notice|| (layout?.saved?"Tata letak tersimpan.":"")}</p>
  {error&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(!dirty||confirm("Buang perubahan yang belum disimpan?"))void load()}}>Muat ulang tata letak</button>}
  {layout&&settings&&<>
   {layout.locked&&<p>Publikasi aktif. Tarik publikasi untuk mengubah tata letak.</p>}
   <label className="studio-field"><span>Ukuran halaman</span><select value={settings.pageSize} disabled={!editable} onChange={event=>setSettings({...settings,pageSize:event.target.value as Settings["pageSize"]})}><option>A4</option><option>A5</option><option>B5</option></select></label>
   <div className="layout-format-tabs" aria-label="Mode kanvas">
    <button type="button" className="secondary-button" aria-pressed={view==="print"} onClick={()=>setView("print")}>Cetak</button>
    <button type="button" className="secondary-button" aria-pressed={view==="read"} onClick={()=>setView("read")}>Baca ulang</button>
   </div>
   <ol aria-label="Urutan tata letak" className="book-layout-canvas" data-view={view} data-size={settings.pageSize}>
    {settings.order.map((position,index)=>{
     const chapter=layout.chapters.find(item=>item.position===position);
     const title=chapter?.title;
     return <li key={position} onDragOver={event=>{if(editable&&drag!==null){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDrop={event=>{if(drag===null)return;event.preventDefault();move(drag,position);setDrag(null)}} style={{paddingBlock:8,overflowWrap:"anywhere"}}>
      <div className="chapter-sort-heading"><strong>{title}</strong>
       {settings.order.length>1&&<span className="chapter-sort-handle" aria-disabled={!editable} draggable={editable} onDragStart={event=>{setDrag(position);event.dataTransfer.setData("text/plain",String(position));event.dataTransfer.effectAllowed="move"}} onDragEnd={()=>setDrag(null)}>Seret</span>}
      </div>
      {chapter?.excerpt&&<p className="book-layout-excerpt">{chapter.excerpt}{chapter.excerpt.length===420?"…":""}</p>}
      {settings.order.length>1&&<div className="layout-format-tabs">
       <button type="button" className="secondary-button" aria-label={"Naikkan "+title} disabled={!editable||index===0} onClick={()=>move(position,settings.order[index-1])}>Naik</button>
       <button type="button" className="secondary-button" aria-label={"Turunkan "+title} disabled={!editable||index===settings.order.length-1} onClick={()=>move(position,settings.order[index+1])}>Turun</button>
      </div>}
     </li>;
    })}
   </ol>
   <BookLayoutTransfer key={layout.snapshot+":"+layout.version} id={id} layout={layout} settings={settings} disabled={!editable}
    onApply={next=>{setSettings(next);setNotice("")}}/>
   <p className="form-hint">Hasil simpan tersedia di Pratinjau format buku. Lanjut ke Penerbitan memakai versi tata letak yang tersimpan.</p>
   <div className="layout-format-tabs">
    {!layout.saved&&!dirty&&<button type="button" className="primary-button" disabled={!editable} onClick={()=>void save(settings)}>Gunakan tata letak bawaan</button>}
    <button type="button" className="secondary-button" disabled={!editable||!layout.saved||dirty} onClick={()=>void save(null)}>Arsipkan tata letak</button>
    <button type="button" className="secondary-button" disabled={!layout.saved||dirty||busy} onClick={onPublish}>Lanjut ke Penerbitan</button>
   </div>
  </>}
 </section>;
}
