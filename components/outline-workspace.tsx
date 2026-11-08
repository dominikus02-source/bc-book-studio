"use client";
import {useEffect,useRef,useState} from "react";
import ChapterArchive from "./chapter-archive";
import OutlineSections from "./outline-sections";
import BulkOutlineManager from "./bulk-outline-manager";
import OutlineChapterHistory from "./outline-chapter-history";
import {genreGuide} from "../lib/genre-policy";
import {chapterCard} from "../lib/stage-card-status";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";

const OUTLINE_TRANSFER_FIELDS:TransferField[]=[
 {key:"title",label:"Judul kerangka bab",required:true,maxLength:180,example:"Bab 1: Mengenali konsep penting"},
 {key:"outlineObjective",label:"Tujuan bab",required:true,maxLength:1500,example:"Setelah membaca bab ini, pembaca dapat menjelaskan konsep dan memberikan contoh."},
];
type Chapter={id:string;title:string;outlineObjective:string;updatedAt:string};
type Readiness={ready:boolean;missing:string[]};

async function send(path:string,method="GET",body?:object){
 const response=await fetch(path,{method,cache:"no-store",...(body?{
  headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
 }:{})});
 const data=await response.json();
 if(!response.ok)throw Error([data.error,...(data.missing??[])].filter(Boolean).join(" · ")||"Permintaan gagal.");
 return data;
}

export default function OutlineWorkspace({id,stage,genre,bookContext="",chapters,onChanged,onWrite}:{
 id:string;stage:string;genre:string;bookContext?:string;chapters:Chapter[];onChanged:()=>Promise<void>;onWrite:()=>void;
}){
 const [title,setTitle]=useState("");
 const [objective,setObjective]=useState("");
 const [selected,setSelected]=useState<Chapter|null>(null);
 const [readiness,setReadiness]=useState<Readiness|null>(null);
 const [busy,setBusy]=useState(false);
 const draggedRef=useRef<string|null>(null);
 const [openSections,setOpenSections]=useState<string[]>([]);
 const [openHistory,setOpenHistory]=useState<string[]>([]);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const path="/api/books/"+id;
 useEffect(()=>{
  let active=true;
  setReadiness(null);
  send(path+"/workflow").then(data=>{if(active)setReadiness(data)})
   .catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[path,chapters]);
 async function run(action:()=>Promise<void>){
  setBusy(true);setError("");setNotice("");
  try{await action()}catch(e){setError(e instanceof Error?e.message:"Permintaan gagal.")}
  finally{setBusy(false)}
 }
 function move(index:number,direction:number){
  const ids=chapters.map(chapter=>chapter.id);
  const to=index+direction;
  if(index<0||to<0||to>=ids.length||index===to||busy||pending)return;
  const [moved]=ids.splice(index,1);
  ids.splice(to,0,moved);
  void run(async()=>{
   await send(path+"/chapters/reorder","PATCH",{ids,expectedOrder:chapters.map(item=>item.id)});
   await onChanged();setNotice("Urutan bab tersimpan.");
  });
 }
 const pending=selected!==null||title.trim()!==""||objective.trim()!=="";
 return <>
  <p className="form-hint" role="note"><strong>Acuan {genreGuide(genre)?.name||"genre"}:</strong> {genreGuide(genre)?.outline||"Susun bab sesuai tujuan buku."}</p>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {chapters.length>1&&<p className="form-hint">{pending?"Simpan atau batalkan perubahan untuk mengurutkan bab.":"Pegang Seret pada bab untuk memindahkannya, atau gunakan Naik dan Turun."}</p>}
  {!chapters.length&&<p>Belum ada bab dalam kerangka.</p>}
  <ol aria-label="Urutan bab" onPointerUp={event=>{
   const source=draggedRef.current;
   draggedRef.current=null;
   if(!source||busy||pending)return;
   const hit=document.elementFromPoint(event.clientX,event.clientY) as HTMLElement|null;
   const target=hit?.closest("[data-outline-chapter-id]") as HTMLElement|null;
   if(!target)return;
   const from=chapters.findIndex(item=>item.id===source);
   const to=chapters.findIndex(item=>item.id===target.dataset.outlineChapterId);
   if(from>=0&&to>=0&&from!==to)move(from,to-from);
  }} onPointerCancel={()=>{draggedRef.current=null}}>
  {chapters.map((chapter,index)=><li key={chapter.id} className={"chapter-status-card status-"+chapterCard({...chapter,content:""},"outline").color} data-outline-chapter-id={chapter.id}
   style={{overflowWrap:"anywhere",marginBlockEnd:16}}>
   <div className="chapter-sort-heading">
    {chapters.length>1&&<span className="chapter-sort-handle" style={{touchAction:"none"}} role="note"
     aria-label={"Seret untuk memindahkan "+chapter.title}
     aria-disabled={busy||pending}
     onPointerDown={event=>{if(!busy&&!pending&&event.button===0){draggedRef.current=chapter.id;event.preventDefault()}}}>Seret</span>}
    <strong>{chapter.title}</strong><button type="button" className={"card-status-label status-action status-"+chapterCard({...chapter,content:""},"outline").color} aria-label={"Buka isian kerangka untuk "+chapter.title} onClick={()=>{setSelected(chapter);setTitle(chapter.title);setObjective(chapter.outlineObjective);setTimeout(()=>document.querySelector<HTMLInputElement>('[aria-label="Tahap Rancang"] input[placeholder]')?.focus(),50)}}>{chapterCard({...chapter,content:""},"outline").label}</button>
   </div>
   <p>{chapter.outlineObjective||"Tujuan bab belum diisi."}</p>
   <details className="outline-chapter-history" onToggle={event=>{const open=event.currentTarget.open;setOpenHistory(current=>open?[...new Set([...current,chapter.id])]:current.filter(item=>item!==chapter.id))}}><summary>Riwayat judul & tujuan bab</summary>{openHistory.includes(chapter.id)&&<OutlineChapterHistory bookId={id} chapterId={chapter.id} onChanged={onChanged}/>}</details>
   <details className="outline-section-details" onToggle={event=>{const open=event.currentTarget.open;setOpenSections(current=>open?[...new Set([...current,chapter.id])]:current.filter(item=>item!==chapter.id))}}><summary>Kelola subbagian & riwayat</summary>{openSections.includes(chapter.id)&&<OutlineSections bookId={id} chapterId={chapter.id} bookContext={bookContext+"; Bab: "+chapter.title+"; Tujuan bab: "+chapter.outlineObjective}/>}</details>
   <div style={{display:"flex",flexWrap:"wrap",gap:8}}> 
   <button type="button" className="secondary-button" style={{minHeight:44}} disabled={busy||pending} onClick={()=>{setSelected(chapter);setTitle(chapter.title);setObjective(chapter.outlineObjective)}}>Ubah kerangka</button>
   <button type="button" className="secondary-button" style={{minHeight:44}} aria-label={"Naikkan "+chapter.title} disabled={busy||pending||index===0} onClick={()=>move(index,-1)}>Naik</button>
   <button type="button" className="secondary-button" style={{minHeight:44}} aria-label={"Turunkan "+chapter.title} disabled={busy||pending||index===chapters.length-1} onClick={()=>move(index,1)}>Turun</button>
   <button type="button" className="secondary-button" style={{minHeight:44}} disabled={busy||pending}
    aria-label={"Arsipkan bab "+chapter.title} onClick={()=>{if(confirm("Arsipkan bab ini? Bab dapat dipulihkan."))void run(async()=>{
     await send(path+"/chapters/"+chapter.id,"DELETE",{expectedVersion:chapter.updatedAt});await onChanged();setNotice("Bab diarsipkan.");
    })}}>Arsipkan</button>
   </div>
  </li>)}</ol>
  <ChapterArchive key={id} id={id} activeChapters={chapters} onChanged={onChanged}/>
  <details className="stage-transfer-panel"><summary>Impor massal hingga 200 subbagian pada satu buku</summary><BulkOutlineManager bookId={id} bookContext={bookContext} onChanged={onChanged}/></details>
  <details className="stage-transfer-panel" open>
   <summary>Template Stage 2 — Rancang bab dan prompt AI</summary>
   <p className="form-hint">Pilih Ubah kerangka pada bab untuk mengisi template dari bab tersebut. Jika tidak memilih bab, isian membentuk kerangka bab baru.</p>
   <FormTransfer name="Stage 2 Kerangka Bab" bookId={id} fields={OUTLINE_TRANSFER_FIELDS} onPersist={async(r:TransferRecord)=>{const nextTitle=typeof r.title==="string"?r.title:title,nextObjective=typeof r.outlineObjective==="string"?r.outlineObjective:objective;if(nextTitle.trim().length<2||!nextObjective.trim())throw Error("Judul dan tujuan bab wajib diisi sebelum autosave.");if(!selected&&chapters.some(item=>item.title.trim().toLowerCase()===nextTitle.trim().toLowerCase()))throw Error("Bab dengan judul tersebut sudah ada. Pilih Ubah kerangka sebelum mengimpor revisi.");await send(path+"/chapters"+(selected?"/"+selected.id:""),selected?"PATCH":"POST",{title:nextTitle,outlineObjective:nextObjective,...(selected?{expectedVersion:selected.updatedAt}:{})});setSelected(null);await onChanged();setNotice("Kerangka Stage 2 tersimpan otomatis ke database.");}}
    values={{title,outlineObjective:objective}} disabled={busy}
    aiContext={`STAGE=RANCANG; BRIEF STAGE 1: ${bookContext}; GENRE=${genre}; PROFIL GENRE: ${genreGuide(genre)?.outline||"Tujuan dan urutan bab harus koheren."}; Judul bab yang ada: ${chapters.map((c,i)=>`${i+1}. ${c.title} — ${c.outlineObjective}`).join("; ")}. Tulis satu judul dan satu tujuan bab yang terukur, tidak mengulang bab lain, dan konsisten dengan brief Stage 1. Pertahankan field_id title dan outlineObjective; jangan tambahkan sumber tidak terverifikasi.`}
    onApply={(record:TransferRecord)=>{if(typeof record.title==="string")setTitle(record.title);if(typeof record.outlineObjective==="string")setObjective(record.outlineObjective)}}/>
   <p className="form-hint">Unggahan XLSX/Markdown yang valid langsung mengisi form dan menyimpan kerangka ke database. Judul duplikat ditolak; untuk revisi pilih Ubah kerangka terlebih dahulu.</p>
  </details>
  <form onSubmit={event=>{
   event.preventDefault();
   void run(async()=>{
    await send(path+"/chapters"+(selected?"/"+selected.id:""),selected?"PATCH":"POST",{
     title,outlineObjective:objective,...(selected?{expectedVersion:selected.updatedAt}:{}),
    });
    setSelected(null);setTitle("");setObjective("");await onChanged();
   });
  }}>
   <label className="studio-field">Judul kerangka bab
    <input placeholder="Contoh: Mengenal siklus air" value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} disabled={busy}/>
   </label>
   <label className="studio-field">Tujuan bab
    <textarea placeholder="Setelah bab ini, pembaca dapat menjelaskan…" value={objective} onChange={e=>setObjective(e.target.value)} maxLength={1500} disabled={busy}/>
   </label>
   <button className="secondary-button" disabled={busy||title.trim().length<2||!objective.trim()}>{selected?"Simpan kerangka":"Tambah bab kerangka"}</button>
   {pending&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{setSelected(null);setTitle("");setObjective("")}}>Batal</button>}
  </form>
  {!!readiness?.missing.length&&<ul>{readiness.missing.map((field,index)=><li key={index}>{field}</li>)}</ul>}
  <button type="button" className="primary-button" disabled={busy||pending||(stage==="OUTLINE"&&!readiness?.ready)} onClick={()=>void run(async()=>{
   if(stage==="OUTLINE")await send(path+"/workflow","POST",{to:"WRITING"});await onChanged();onWrite();
  })}>Lanjut ke Tulis</button>
 </>;
}
