"use client";
import {useEffect,useRef,useState} from "react";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";
type Item={id:string;title:string;payload:TransferRecord;updatedAt:string};
type Props={module:"Idea Lab"|"Studio Latihan"|"Kurikulum"|"Studio Visual"|"Pusat Agen"|"Pengaturan";fields:TransferField[];values:TransferRecord;onApply:(r:TransferRecord)=>void};
export default function FormDraftManager({module,fields,values,onApply}:Props){
 const [items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState(""),[name,setName]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [savedSnapshot,setSavedSnapshot]=useState("");
 const [autoSaving,setAutoSaving]=useState(false);
 const [saveTick,setSaveTick]=useState(0);
 const savingRef=useRef(false);
 const autoTitle=(name.trim()||String(values.bookTitle||"").trim()).slice(0,140);
 const snapshot=JSON.stringify({title:autoTitle,values});
 const canContinue=module==="Idea Lab"&&Boolean(selected)&&!busy&&!autoSaving&&savedSnapshot===snapshot;
 useEffect(()=>{
  if(!autoTitle||snapshot===savedSnapshot||busy||(!selected&&(module!=="Idea Lab"||!String(values.bookTitle||"").trim()||!String(values.idea||"").trim())))return;
  const timer=setTimeout(async()=>{
   if(savingRef.current){setSaveTick(x=>x+1);return;}
   savingRef.current=true;setAutoSaving(true);setError("");
   try{
    const res=await fetch("/api/form-drafts"+(selected?"/"+selected:""),{method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({module,title:autoTitle,payload:values})});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Autosave gagal.");
    if(!selected)setSelected(data.draft.id);
    await load();
    setName(autoTitle);setSavedSnapshot(snapshot);setMessage("Tersimpan otomatis. Proses berikutnya siap.");
   }catch(e){setError(e instanceof Error?e.message:"Autosave gagal.");}
   finally{savingRef.current=false;setAutoSaving(false);setSaveTick(x=>x+1);}
  },900);
  return ()=>clearTimeout(timer);
 },[module,autoTitle,snapshot,savedSnapshot,selected,busy,saveTick]);
 async function load(){
  const res=await fetch("/api/form-drafts?module="+encodeURIComponent(module),{cache:"no-store"});
  if(!res.ok)throw Error(res.status===401?"Silakan login kembali.":"Gagal memuat draf.");
  const data=await res.json();setItems(data.drafts||[]);
 }
 useEffect(()=>{setSelected("");setName("");setError("");load().catch(e=>setError(String(e.message)))},[module]);
 async function execute(fn:()=>Promise<void>){setBusy(true);setError("");setMessage("");try{await fn();await load();}catch(e){setError(e instanceof Error?e.message:"Operasi gagal.");}finally{setBusy(false);}}
 const current=items.find(x=>x.id===selected);
 function choose(id:string){setSavedSnapshot("");setSelected(id);const item=items.find(x=>x.id===id);if(item){setSavedSnapshot(JSON.stringify({title:item.title,values:item.payload}));setName(item.title);onApply(item.payload);setMessage("Draf dimuat ke form. Anda dapat mengubah lalu simpan.");}}
 async function save(){
  await execute(async()=>{
   const title=name.trim();if(title.length<2)throw Error("Nama draf minimal 2 karakter.");
   const url="/api/form-drafts"+(selected?"/"+selected:"");
   const res=await fetch(url,{method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({module,title,payload:values})});
   const data=await res.json();if(!res.ok)throw Error(data.error||"Gagal menyimpan.");
   if(!selected)setSelected(data.draft.id);setSavedSnapshot(JSON.stringify({title,values}));setMessage("Data draf tersimpan di server. Anda dapat melanjutkan ke proses berikutnya.");
  });
 }
 async function persistImported(records:TransferRecord){
  const next={...values,...records};
  const title=(name.trim()||String(next.bookTitle||"").trim()||module+" - Draf impor").slice(0,140);
  if(!Object.values(next).some(x=>typeof x==="string"&&x.trim().length>0))throw Error("Isi minimal satu field sebelum menyimpan.");
  setAutoSaving(true);setError("");
  try{
   const response=await fetch("/api/form-drafts"+(selected?"/"+selected:""),{method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({module,title,payload:next})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Impor tidak berhasil disimpan.");
   setSelected(result.draft.id);setName(title);setSavedSnapshot(JSON.stringify({title,values:next}));
   await load();setMessage("File berhasil diimpor dan draf tersimpan otomatis di database.");
  }catch(e){const message=e instanceof Error?e.message:"Autosave impor gagal";setError(message);throw e}
  finally{setAutoSaving(false)}
 }
 async function remove(){
  if(!selected||!window.confirm("Hapus draf ini secara permanen?"))return;
  await execute(async()=>{const res=await fetch("/api/form-drafts/"+selected,{method:"DELETE"});if(!res.ok)throw Error("Gagal menghapus draf.");setSelected("");setName("");setSavedSnapshot(snapshot);setMessage("Draf dihapus.");});
 }
 return <section className="panel form-draft-manager"><h3 className="panel-title">Impor, ekspor & CRUD draf — {module}</h3>
  <p className="panel-desc">Unduh XLSX atau Markdown, edit dan impor kembali. Draf yang sudah disimpan akan tersimpan otomatis saat diedit; Idea Lab juga membuat draf otomatis setelah judul dan ide diisi. Tombol Proses Berikutnya aktif hanya setelah penyimpanan berhasil.</p>
  <FormTransfer name={module} fields={fields} values={values} onApply={onApply} onPersist={persistImported} disabled={busy||autoSaving}/>
  {error&&<p role="alert" className="form-transfer-error">{error}</p>}{message&&<p role="status" className="form-transfer-success">{message}</p>}
  <div className="form-draft-controls">
   <label className="studio-field"><span>Pilih draf tersimpan</span><select value={selected} onChange={e=>choose(e.target.value)} disabled={busy}><option value="">Buat draf baru</option>{items.map(x=><option key={x.id} value={x.id}>{x.title} · {new Date(x.updatedAt).toLocaleDateString("id-ID")}</option>)}</select></label>
   <label className="studio-field"><span>Nama draf</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={140} placeholder="Contoh: Rancangan modul IPA kelas 7"/></label>
  </div>
  <div className="form-transfer-actions">
   <button type="button" className="primary-button" disabled={busy||name.trim().length<2} onClick={()=>void save()}>{selected?"Simpan perubahan":"Simpan draf baru"}</button>
   <button type="button" className="secondary-button" disabled={busy} onClick={()=>{setSelected("");setName("");setMessage("Buat draf baru, isian pada form tetap ada.");}}>Duplikasi sebagai baru</button>
   {selected&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void remove()}>Hapus draf</button>}
   {module==="Idea Lab"&&<button type="button" className="primary-button" disabled={busy||!canContinue} onClick={()=>{window.sessionStorage.setItem("bcstudio-idea-next",selected);window.dispatchEvent(new CustomEvent("bc-studio-navigate",{detail:"Buat Buku"}));}}>Proses Berikutnya → Buat Buku</button>}
  </div>
 </section>;
}
