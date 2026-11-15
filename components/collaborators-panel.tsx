"use client";
import {useEffect,useState} from "react";

type Person={userId?:string;id?:string;name:string;email:string;role:string;active?:boolean};
export default function CollaboratorsPanel({bookId}:{bookId:string}){
 const [q,setQ]=useState("");
 const [rows,setRows]=useState<Person[]>([]);
 const [matches,setMatches]=useState<Person[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function load(query=q){
  const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/collaborators?q="+encodeURIComponent(query),{cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Kolaborator gagal dimuat.");
  setRows(data.collaborators||[]);
  setMatches(data.matches||[]);
 }
 useEffect(()=>{const timer=window.setTimeout(()=>{void load(q).catch(e=>setError(e.message));},250);return()=>window.clearTimeout(timer);},[bookId,q]);
 async function run(task:()=>Promise<void>){
  setBusy(true);setError("");setNotice("");
  try{await task()}catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan")}
  finally{setBusy(false)}
 }
 return <section className="panel collaborator-panel" aria-label="Kolaborator">
  <h3>Kolaborator</h3>
  <p className="form-hint">Penulis utama dapat mengajak editor atau admin yang aktif. Kolaborator membantu menulis. Mereka tidak dapat menghapus buku, menugaskan peninjau, mengajukan review, atau menerbitkan.</p>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <label className="studio-field">Cari nama atau email
   <input value={q} onChange={event=>setQ(event.target.value)} placeholder="Ketik sedikitnya 2 huruf" />
  </label>
  <ul className="collaborator-results">{matches.map(person=><li key={person.id}><span><strong>{person.name}</strong><small>{person.email}</small></span>
   <button type="button" className="primary-button" disabled={busy} onClick={()=>void run(async()=>{
    const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/collaborators",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:person.id})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Gagal menambahkan");
    setNotice(person.name+" ditambahkan.");
    await load();
   })}>Tambahkan</button>
  </li>)}</ul>
  {!matches.length&&q.trim().length>=2&&<p>Tidak ada akun aktif yang cocok.</p>}
  <h4>Yang sudah diajak</h4>
  {!rows.length&&<p>Belum ada kolaborator.</p>}
  <ul className="collaborator-results">{rows.map(person=><li key={person.userId}><span><strong>{person.name}</strong><small>{person.email} · {person.active===false?"Nonaktif":"Aktif"}</small></span>
   <button type="button" className="secondary-button" disabled={busy} onClick={()=>{
    if(!confirm("Hapus "+person.name+" dari kolaborator? Tulisan yang sudah disimpan tetap ada."))return;
    void run(async()=>{
     const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/collaborators",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:person.userId})});
     const data=await response.json();
     if(!response.ok)throw Error(data.error||"Gagal menghapus");
     setNotice(person.name+" dihapus dari kolaborator.");
     await load();
    });
   }}>Hapus</button>
  </li>)}</ul>
 </section>;
}
