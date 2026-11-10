"use client";
import {useEffect,useState} from "react";
import {paperSizes,paperSpec} from "../lib/paper-sizes";
type Format="pdf"|"epub"|"docx"|"html"|"flipbook";
type Job={id:string;status:string;progress:number;currentStep:string;resultSha256?:string|null;resultBytes?:number|null;error?:string|null;cancellationRequested?:boolean};
const formats:Format[]=["pdf","epub","docx","html","flipbook"];
const extension:Record<Format,string>={pdf:"pdf",epub:"epub",docx:"docx",html:"html",flipbook:"html"};
const expectedType:Record<Format,string>={pdf:"application/pdf",epub:"application/epub+zip",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",html:"text/html",flipbook:"text/html"};
export default function BookExportActions({bookId,status,disabled=false,bookPageSize}:{bookId:string;status:string;disabled?:boolean;bookPageSize?:string|null}){
 const [paperSize,setPaperSize]=useState(paperSpec(bookPageSize)?.id||"a4");
 const [running,setRunning]=useState<Format|null>(null);
 const [creating,setCreating]=useState(false);
 const [job,setJob]=useState<Job|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const approved=status==="APPROVED";
 const active=Boolean(job&&["QUEUED","RUNNING"].includes(job.status));
 const jobsBase="/api/books/"+encodeURIComponent(bookId)+"/export-jobs";
 useEffect(()=>setPaperSize(paperSpec(bookPageSize)?.id||"a4"),[bookId,bookPageSize]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(jobsBase,{cache:"no-store",credentials:"same-origin",signal:controller.signal}).then(r=>r.ok?r.json():null).then(d=>{
   if(controller.signal.aborted||!d?.jobs)return;
   const recent=d.jobs.find((j:Job)=>["QUEUED","RUNNING"].includes(j.status))||d.jobs[0];
   if(recent)setJob(recent);
  }).catch(()=>{});
  return()=>controller.abort();
 },[jobsBase]);
 useEffect(()=>{
  if(!active||!job)return;
  let mounted=true;
  async function refresh(){
   try{
    const r=await fetch(jobsBase+"/"+encodeURIComponent(job!.id),{cache:"no-store",credentials:"same-origin"});
    if(!r.ok)throw Error("Tidak dapat memeriksa progres ekspor");
    const payload=await r.json();
    if(mounted)setJob(payload.job);
   }catch(e){if(mounted)setError(e instanceof Error?e.message:"Gagal memeriksa progres")}
  }
  const timer=window.setInterval(()=>void refresh(),1500);
  void refresh();
  return()=>{mounted=false;window.clearInterval(timer)};
 },[active,job?.id,jobsBase]);
 async function createZip(allSizes:boolean){
  if(creating||active||running||disabled)return;
  setCreating(true);setError("");setMessage("");
  try{
   const r=await fetch(jobsBase,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({scope:allSizes?"all":"single",size:paperSize,preview:!approved})});
   const payload=await r.json();
   if(!r.ok)throw Error(payload.error||"Tidak dapat membuat pekerjaan ekspor");
   setJob(payload.job);setMessage("Ekspor dimasukkan ke antrean. Progres dapat dipantau di halaman ini.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal membuat pekerjaan")}
  finally{setCreating(false)}
 }
 async function cancelZip(){
  if(!job||!active)return;
  try{
   const r=await fetch(jobsBase+"/"+encodeURIComponent(job.id),{method:"DELETE",credentials:"same-origin"});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||"Pembatalan gagal");
   setJob(x=>x?{...x,cancellationRequested:true}:x);
   setMessage("Permintaan pembatalan diterima. Render yang sedang berlangsung akan diselesaikan dahulu.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal membatalkan")}
 }
 async function exportBook(format:Format){
  if(running||disabled)return;
  const isPreview=!approved;
  const endpoint="/api/books/"+encodeURIComponent(bookId)+"/export?format="+format+(isPreview?"&preview=1":"")+"&view=1&size="+encodeURIComponent(paperSize);
  const tab=(format==="html"||format==="flipbook")?window.open("about:blank","_blank"):null;
  setRunning(format);setError("");setMessage("");
  try{
   const response=await fetch(endpoint,{cache:"no-store",credentials:"same-origin"});
   if(!response.ok){const detail=await response.json().catch(()=>null);throw Error(typeof detail?.error==="string"?detail.error:"Ekspor gagal (HTTP "+response.status+").")}
   if(!(response.headers.get("content-type")||"").toLowerCase().includes(expectedType[format]))throw Error("Server mengirim MIME yang tidak sesuai.");
   const bytes=await response.blob();if(!bytes.size)throw Error("Berkas kosong");
   const url=URL.createObjectURL(bytes);
   if(tab){tab.location.replace(url)}else{
    const anchor=document.createElement("a");anchor.href=url;anchor.download="buku-"+bookId+(isPreview?"-DRAFT":"")+"-"+paperSize+"."+extension[format];
    document.body.appendChild(anchor);anchor.click();anchor.remove();
   }
   window.setTimeout(()=>URL.revokeObjectURL(url),60000);
   setMessage("Pratinjau "+format.toUpperCase()+" berhasil.");
  }catch(e){if(tab&&!tab.closed)tab.close();setError(e instanceof Error?e.message:"Ekspor gagal")}
  finally{setRunning(null)}
 }
 return <section aria-label="Ekspor naskah">
  <p className="form-hint">{approved?"Ekspor final memakai snapshot persetujuan.":"Semua berkas buku ini adalah pratinjau DRAFT dan belum menjadi terbitan resmi."}</p>
  <div className="publishing-exports" style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:12}}>
   <label htmlFor="export-paper-size">Ukuran dokumen cetak</label>
   <select id="export-paper-size" value={paperSize} disabled={disabled||running!==null||creating} onChange={e=>setPaperSize(e.target.value)}>{paperSizes.map(x=><option key={x.id} value={x.id}>{x.label} - {x.widthMm} x {x.heightMm} mm</option>)}</select>
  </div>
  <p className="form-hint">PDF dan DOCX memakai ukuran fisik. EPUB tetap reflowable. Paket ZIP dilengkapi manifest SHA-256 dan status validator yang belum dijalankan.</p>
  <div className="publishing-exports" aria-label="Format ekspor">{formats.map(format=><button key={format} type="button" className="secondary-button" disabled={disabled||running!==null} aria-busy={running===format} onClick={()=>void exportBook(format)}>{running===format?"Memproses "+format+"...":format==="flipbook"?"Buka Flipbook":format==="html"?"Buka HTML":(approved?"Unduh ":"Pratinjau ")+format.toUpperCase()}</button>)}</div>
  <div className="publishing-exports" style={{marginTop:12}} aria-label="Unduh ZIP menggunakan antrean">
   <button className="secondary-button" type="button" disabled={disabled||running!==null||creating||active} onClick={()=>void createZip(false)}>Buat ZIP ukuran {paperSize.toUpperCase()}</button>
   <button className="secondary-button" type="button" disabled={disabled||running!==null||creating||active} onClick={()=>void createZip(true)}>Buat ZIP semua 13 ukuran</button>
  </div>
  {job&&<div className="panel" aria-label="Progres pekerjaan ekspor" style={{marginTop:12,display:"grid",gap:8}}>
   <strong>Status ekspor: {job.status}</strong>
   <progress value={Math.max(0,Math.min(100,job.progress))} max={100} aria-label="Progres ekspor">{job.progress}%</progress>
   <p role="status">{job.progress}% - {job.currentStep}{job.cancellationRequested?" (pembatalan diminta)":""}</p>
   {job.status==="COMPLETE"&&<a href={jobsBase+"/"+encodeURIComponent(job.id)+"/download"} className="secondary-button" download>Unduh ZIP selesai (WinZip)</a>}
   {active&&<button className="secondary-button" type="button" disabled={job.cancellationRequested} onClick={()=>void cancelZip()}>Batalkan ekspor</button>}
   {job.status==="FAILED"&&<p role="alert">{job.error||"Ekspor gagal"}</p>}
   {job.resultSha256&&<small>SHA-256 ZIP: <code>{job.resultSha256}</code></small>}
  </div>}
  {error&&<p role="alert">{error}</p>}
  {message&&<div role="status" className="publishing-export-toast">{message}<button type="button" onClick={()=>setMessage("")} aria-label="Tutup notifikasi">Tutup</button></div>}
 </section>;
}
