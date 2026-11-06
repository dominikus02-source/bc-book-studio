"use client";
import {useEffect,useState} from "react";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";
type Item={id:string;title:string;payload:TransferRecord;updatedAt:string};
type Props={module:"Idea Lab"|"Studio Latihan"|"Kurikulum"|"Studio Visual"|"Pusat Agen"|"Pengaturan";fields:TransferField[];values:TransferRecord;onApply:(r:TransferRecord)=>void};
export default function FormDraftManager({module,fields,values,onApply}:Props){
 const [items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState(""),[name,setName]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function load(){
  const res=await fetch("/api/form-drafts?module="+encodeURIComponent(module),{cache:"no-store"});
  if(!res.ok)throw Error(res.status===401?"Silakan login kembali.":"Gagal memuat draf.");
  const data=await res.json();setItems(data.drafts||[]);
 }
 useEffect(()=>{setSelected("");setName("");setError("");load().catch(e=>setError(String(e.message)))},[module]);
 async function execute(fn:()=>Promise<void>){setBusy(true);setError("");setMessage("");try{await fn();await load();}catch(e){setError(e instanceof Error?e.message:"Operasi gagal.");}finally{setBusy(false);}}
 const current=items.find(x=>x.id===selected);
 function choose(id:string){setSelected(id);const item=items.find(x=>x.id===id);if(item){setName(item.title);onApply(item.payload);setMessage("Draf dimuat ke form. Anda dapat mengubah lalu simpan.");}}
 async function save(){
  await execute(async()=>{
   const title=name.trim();if(title.length<2)throw Error("Nama draf minimal 2 karakter.");
   const url="/api/form-drafts"+(selected?"/"+selected:"");
   const res=await fetch(url,{method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({module,title,payload:values})});
   const data=await res.json();if(!res.ok)throw Error(data.error||"Gagal menyimpan.");
   if(!selected)setSelected(data.draft.id);setMessage("Data draf tersimpan di server.");
  });
 }
 async function remove(){
  if(!selected||!window.confirm("Hapus draf ini secara permanen?"))return;
  await execute(async()=>{const res=await fetch("/api/form-drafts/"+selected,{method:"DELETE"});if(!res.ok)throw Error("Gagal menghapus draf.");setSelected("");setName("");setMessage("Draf dihapus.");});
 }
 return <section className="panel form-draft-manager"><h3 className="panel-title">Impor, ekspor & CRUD draf — {module}</h3>
  <p className="panel-desc">Unduh format XLSX atau Markdown, edit di luar, unggah kembali untuk memetakan isian. Setelah diterapkan, gunakan Simpan Draf agar data tersimpan di server sesuai akun.</p>
  <FormTransfer name={module} fields={fields} values={values} onApply={onApply} disabled={busy}/>
  {error&&<p role="alert" className="form-transfer-error">{error}</p>}{message&&<p role="status" className="form-transfer-success">{message}</p>}
  <div className="form-draft-controls">
   <label className="studio-field"><span>Pilih draf tersimpan</span><select value={selected} onChange={e=>choose(e.target.value)} disabled={busy}><option value="">Buat draf baru</option>{items.map(x=><option key={x.id} value={x.id}>{x.title} · {new Date(x.updatedAt).toLocaleDateString("id-ID")}</option>)}</select></label>
   <label className="studio-field"><span>Nama draf</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={140} placeholder="Contoh: Rancangan modul IPA kelas 7"/></label>
  </div>
  <div className="form-transfer-actions">
   <button type="button" className="primary-button" disabled={busy||name.trim().length<2} onClick={()=>void save()}>{selected?"Simpan perubahan":"Simpan draf baru"}</button>
   <button type="button" className="secondary-button" disabled={busy} onClick={()=>{setSelected("");setName("");setMessage("Buat draf baru, isian pada form tetap ada.");}}>Duplikasi sebagai baru</button>
   {selected&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void remove()}>Hapus draf</button>}
  </div>
 </section>;
}
