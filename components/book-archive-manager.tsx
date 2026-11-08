"use client";
import {useState} from "react";
type ArchivedBook={id:string;title:string;updatedAt:string;archivedAt:string;genre:string;chapters:{id:string}[]};
export default function BookArchiveManager({onChanged}:{onChanged:()=>Promise<void>}){
 const [books,setBooks]=useState<ArchivedBook[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function load(){
  const r=await fetch("/api/books?archived=1",{cache:"no-store"});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(body.error||"Daftar arsip gagal dimuat");
  setBooks(body.books||[]);setLoaded(true);
 }
 async function doLoad(){setError("");setBusy(true);try{await load()}catch(e){setError(e instanceof Error?e.message:"Gagal memuat arsip")}finally{setBusy(false)}}
 async function restore(book:ArchivedBook){
  if(!window.confirm("Pulihkan draf "+book.title+" ke perpustakaan?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/books/"+encodeURIComponent(book.id)+"/restore",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:book.updatedAt})});
   const body=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(body.error||"Gagal memulihkan");
   await load();await onChanged();setNotice("Draf dipulihkan. Buku kembali tersedia di perpustakaan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal memulihkan")}finally{setBusy(false)}
 }
 return <details className="optional-tools" aria-label="Arsip buku"><summary>Arsip buku dan pemulihan</summary>
  <p className="form-hint">Arsip tidak menghapus bab atau riwayat. Hanya pemilik yang dapat memulihkan draf.</p>
  <button className="secondary-button" type="button" disabled={busy} onClick={()=>void doLoad()}>Muat daftar arsip</button>
  {busy&&<p role="status">Memproses…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loaded&&!books.length&&<p>Belum ada buku di arsip.</p>}
  {books.map(book=><div className="agent-card" key={book.id} style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:10}}>
    <span><strong>{book.title}</strong><small style={{display:"block"}}>{book.genre} · {book.chapters.length} bab · {new Date(book.archivedAt).toLocaleDateString("id-ID")}</small></span>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>void restore(book)}>Pulihkan buku</button>
   </div>)}
 </details>
}
