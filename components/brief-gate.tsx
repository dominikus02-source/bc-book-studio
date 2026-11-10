"use client";
import {useEffect,useState} from "react";
import {genreGuide} from "../lib/genre-policy";
type Book={id:string;updatedAt:string;targetAudience:string;writingGoal:string;genre?:string;bookType?:string};
type Readiness={stage:string;ready:boolean;missing:string[]};
type History={id:string;createdAt:string;snapshot:{title:string;subject:string;description:string;targetAudience:string;writingGoal:string}};
async function request(path:string,method="GET",payload?:object){
 const response=await fetch(path,{method,cache:"no-store",...(payload?{headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}:{})});
 const data=await response.json();
 if(!response.ok)throw Error([data.error,...(data.missing??[])].filter(Boolean).join("; ")||"Permintaan gagal");
 return data;
}
export default function BriefGate({book,onChanged,onOutline}:{book:Book;onChanged:()=>Promise<void>;onOutline:()=>void}){
 const [readiness,setReadiness]=useState<Readiness|null>(null),[history,setHistory]=useState<History[]|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const path="/api/books/"+book.id,guide=genreGuide(book.genre||"REFERENCE");
 useEffect(()=>{let active=true;setReadiness(null);request(path+"/workflow").then(data=>{if(active){setReadiness(data);setError("")}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[path,book.updatedAt]);
 async function run(action:()=>Promise<void>){setBusy(true);setError("");try{await action()}catch(e){setError(e instanceof Error?e.message:"Permintaan gagal")}finally{setBusy(false)}}
 return <section aria-label="Tahap Ide" className="panel stage-readiness-panel">
  <h3>Kesiapan Ide</h3>
  <p className="form-hint">Edit judul, sinopsis, pembaca dan tujuan pada formulir proyek buku di atas. Unggah XLSX/Markdown pada form yang sama; tidak ada input brief kedua yang dapat menimpa perubahan.</p>
  {error&&<p role="alert">{error}</p>}
  {readiness?.stage==="BRIEF"&&readiness.missing.length>0&&<><p role="status">Masih perlu dilengkapi:</p><ul>{readiness.missing.map(field=><li key={field}>{field}</li>)}</ul></>}
  <div className="stage-primary-actions">
   {readiness&&readiness.stage!=="BRIEF"
    ?<button type="button" className="primary-button" disabled={busy} onClick={onOutline}>Buka Rancang</button>
    :<button type="button" className="primary-button" disabled={busy||!readiness?.ready} onClick={()=>void run(async()=>{await request(path+"/workflow","POST",{to:"OUTLINE"});await onChanged();onOutline()})}>Lanjut ke Rancang</button>}
  </div>
  <details className="stage-advanced-tools"><summary>Riwayat brief dan panduan editorial (opsional)</summary>
   <p className="form-hint">{guide?.name||"Genre"}: {guide?.proof||"Sesuaikan standar isi dengan genre."} ISBN hanya diterbitkan oleh lembaga berwenang melalui prosedur resmi.</p>
   <button type="button" className="secondary-button" disabled={busy} onClick={()=>void run(async()=>{const result=await request(path+"?briefHistory=1");setHistory(result.history)})}>Muat riwayat brief</button>
   {history&&<section aria-label="Riwayat brief">
    {!history.length&&<p>Belum ada revisi brief.</p>}
    {history.map(entry=><details key={entry.id}><summary>{new Date(entry.createdAt).toLocaleString("id-ID")} — {entry.snapshot.title}</summary><dl><dt>Bidang</dt><dd>{entry.snapshot.subject}</dd><dt>Pembaca</dt><dd>{entry.snapshot.targetAudience||"Belum diisi"}</dd><dt>Tujuan</dt><dd>{entry.snapshot.writingGoal||"Belum diisi"}</dd><dt>Sinopsis</dt><dd>{entry.snapshot.description||"Belum diisi"}</dd></dl></details>)}
   </section>}
  </details>
 </section>;
}
