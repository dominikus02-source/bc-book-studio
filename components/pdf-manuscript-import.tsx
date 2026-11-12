"use client";
import {useRef,useState} from "react";
export default function PdfManuscriptImport({bookId,onImported}:{bookId:string;onImported:()=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null);
 const [files,setFiles]=useState<File[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [result,setResult]=useState<{chapters:{id:string;title:string;pages:number;characters:number}[]}|null>(null);
 async function upload(){
  if(!files.length||busy)return;
  setBusy(true);setError("");setMessage("");setResult(null);
  try{
   const form=new FormData();files.forEach(file=>form.append("files",file));
   const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/import-pdf",{method:"POST",body:form,cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Impor PDF gagal.");
   setResult(data);setMessage(data.message||"Impor selesai.");setFiles([]);if(input.current)input.current.value="";
   await onImported();
  }catch(e){setError(e instanceof Error?e.message:"Impor PDF gagal.");}
  finally{setBusy(false);}
 }
 return <details className="panel pdf-manuscript-import">
  <summary id="pdf-import-title">Impor naskah dari PDF</summary>
  <p className="panel-desc">PDF mengisi bab dan menempatkan tahap pada Tulis, juga bila buku masih di Ide atau Rancang. Periksa setiap bab sesudahnya. Studio tidak menyimpan berkas PDF sumber.</p>
  <label className="studio-field"><span>Pilih PDF (maksimal 10 file, 25 MB per file)</span><input ref={input} type="file" accept="application/pdf,.pdf" multiple disabled={busy} onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label>
  {files.length>0&&<ul>{files.map((file,index)=><li key={file.name+"-"+index}>{file.name} · {(file.size/1024/1024).toFixed(2)} MB</li>)}</ul>}
  <div className="form-hint">File PDF diproses langsung di memori dan tidak disimpan sebagai file sumber. Hasil teks tersimpan di database sebagai konten bab Markdown dan dapat disunting di editor Stage 3.</div>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button type="button" className="primary-button" disabled={busy||!files.length} onClick={()=>void upload()}>{busy?"Mengonversi PDF…":"Konversi & isi Stage 1–3"}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setFiles([]);setError("");setMessage("");setResult(null);if(input.current)input.current.value=""}}>Bersihkan</button></div>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {result&&<div className="panel" aria-label="Hasil impor"><strong>{result.chapters.length} bab berhasil dibuat</strong><ul>{result.chapters.map(chapter=><li key={chapter.id}>{chapter.title} · {chapter.pages} halaman · {chapter.characters.toLocaleString("id-ID")} karakter</li>)}</ul><p className="form-hint">Tahap buku sekarang Tulis. Buka setiap bab di bawah dan periksa hasil konversi sebelum melanjutkan.</p></div>}
 </details>;
}
