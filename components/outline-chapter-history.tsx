"use client";
import {useEffect,useState} from "react";
type Record={revision:number;title:string;outlineObjective:string;createdAt:string};
export default function OutlineChapterHistory({bookId,chapterId,onChanged}:{bookId:string;chapterId:string;onChanged:()=>Promise<void>}){
 const [versions,setVersions]=useState<Record[]>([]),[version,setVersion]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const path="/api/books/"+encodeURIComponent(bookId)+"/chapters/"+encodeURIComponent(chapterId);
 async function load(){
  const r=await fetch(path,{cache:"no-store"});const data=await r.json();
  if(!r.ok)throw Error(data.error||"Tidak dapat membaca riwayat kerangka");
  setVersion(data.chapter.updatedAt);setVersions((data.chapter.revisions||[]).filter((v:Record)=>v.outlineObjective?.trim()));
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[path]);
 async function restore(revision:number){
  if(!version||!confirm("Pulihkan judul dan tujuan bab ini? Perubahan terbaru tetap dicatat."))return;
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch(path,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({restoreOutlineRevision:revision,expectedVersion:version})});const data=await r.json();if(!r.ok)throw Error(data.error||"Pemulihan gagal");await onChanged();await load();setNotice("Kerangka bab berhasil dipulihkan.");}
  catch(e){setError(e instanceof Error?e.message:"Pemulihan gagal");}finally{setBusy(false)}
 }
 return <section className="outline-history" aria-label="Riwayat judul dan tujuan bab">
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <p className="form-hint">Riwayat hanya merekam perubahan yang sudah tersimpan. Isi naskah Stage 3 tidak ditimpa saat memulihkan tujuan bab.</p>
  <button type="button" className="secondary-button" disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>Perbarui riwayat</button>
  {!versions.length&&<p>Belum ada revisi kerangka untuk bab ini.</p>}
  <ul>{versions.map(row=><li key={row.revision}><div><strong>{row.title}</strong><p>{row.outlineObjective}</p><small>Versi {row.revision} · {new Date(row.createdAt).toLocaleString("id-ID")}</small></div><button type="button" className="secondary-button" disabled={busy} onClick={()=>void restore(row.revision)}>Pulihkan versi {row.revision}</button></li>)}</ul>
 </section>;
}
