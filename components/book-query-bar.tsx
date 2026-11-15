"use client";

export default function BookQueryBar({q,status,stage,onChange}:{
 q:string;status:string;stage:string;
 onChange:(next:{q:string;status:string;stage:string})=>void;
}){
 return <form className="book-query-bar" role="search" aria-label="Cari buku" onSubmit={event=>event.preventDefault()}>
  <label className="studio-field">Cari judul
   <input value={q} onChange={event=>onChange({q:event.target.value,status,stage})} placeholder="Ketik judul buku" />
  </label>
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
