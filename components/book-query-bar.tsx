"use client";

export default function BookQueryBar({q,status,stage,scope,onChange,onScope}:{
 q:string;status:string;stage:string;scope?:string;
 onChange:(next:{q:string;status:string;stage:string})=>void;
 onScope?:(scope:string)=>void;
}){
 return <form className="book-query-bar" role="search" aria-label="Cari buku" onSubmit={event=>event.preventDefault()}>
  <label className="studio-field">Cari judul
   <input value={q} onChange={event=>onChange({q:event.target.value,status,stage})} placeholder="Ketik judul buku" />
  </label>
  {onScope&&<label className="studio-field">Lingkup
   <select value={scope||""} aria-label="Lingkup buku" onChange={event=>onScope(event.target.value)}>
    <option value="">Semua buku</option>
    <option value="mine">Buku saya</option>
   </select>
  </label>}
  <label className="studio-field">Status
   <select value={status} onChange={event=>onChange({q,status:event.target.value,stage})}>
    <option value="">Semua status</option>
    <option value="DRAFT">Draf</option>
    <option value="REVIEW">Sedang ditinjau</option>
    <option value="APPROVED">Disetujui</option>
   </select>
  </label>
  <label className="studio-field">Tahap
   <select value={stage} onChange={event=>onChange({q,status,stage:event.target.value})}>
    <option value="">Semua tahap</option>
    <option value="BRIEF">Ide</option>
    <option value="OUTLINE">Rancang</option>
    <option value="WRITING">Tulis</option>
    <option value="EDITING">Penyuntingan</option>
    <option value="REVIEW">Review</option>
    <option value="LAYOUT">Terbit</option>
   </select>
  </label>
  <p className="form-hint">Kosongkan pencarian untuk melihat daftar lengkap, lalu muat lebih banyak bila masih ada.</p>
 </form>;
}
