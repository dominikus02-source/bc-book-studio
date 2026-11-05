"use client";
import { FormEvent,useEffect,useState } from "react";
type Provider={id:string;provider:string;label:string;model:string;lastFour:string;active:boolean};
export default function ProviderSettings(){
 const [items,setItems]=useState<Provider[]>([]),[loading,setLoading]=useState(true),[allowed,setAllowed]=useState(true),[ready,setReady]=useState(false);
 const [editing,setEditing]=useState<string|null>(null),[provider,setProvider]=useState("openai"),[label,setLabel]=useState(""),[model,setModel]=useState(""),[secret,setSecret]=useState(""),[active,setActive]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function refresh(){
  const response=await fetch("/api/settings/providers",{cache:"no-store"});
  if(response.status===403){setAllowed(false);return}
  const data=await response.json();if(!response.ok)throw Error(data.error||"Konfigurasi belum dapat dimuat.");
  setItems(data.providers);setReady(data.encryptionReady);
 }
 useEffect(()=>{let cancelled=false;refresh().catch(()=>{if(!cancelled)setError("Konfigurasi belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.")}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[]);
 function reset(){setEditing(null);setProvider("openai");setLabel("");setModel("");setSecret("");setActive(false)}
 function edit(item:Provider){setEditing(item.id);setProvider(item.provider);setLabel(item.label);setModel(item.model);setActive(item.active);setSecret("");setMessage("");setError("")}
 async function save(event:FormEvent){
  event.preventDefault();setBusy(true);setMessage("");setError("");
  const data={label,model,active,...(!editing?{provider}:{}),...(secret?{apiKey:secret}:{})};
  try{
   const response=await fetch("/api/settings/providers"+(editing?"/"+editing:""),{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Konfigurasi belum tersimpan.");
   reset();await refresh();setMessage("Konfigurasi provider tersimpan.");
   window.dispatchEvent(new Event("bc-provider-updated"));
  }catch(e){setError(e instanceof Error?e.message:"Konfigurasi belum tersimpan.")}
  finally{setSecret("");setBusy(false)}
 }
 async function remove(item:Provider){
  if(!window.confirm("Hapus API key "+item.label+"?"+(item.active?" Layanan AI akan dinonaktifkan.":"")))return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/settings/providers/"+item.id,{method:"DELETE",headers:{"Content-Type":"application/json"}});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Penghapusan gagal.");
   if(editing===item.id)reset();await refresh();setMessage("API key dihapus.");window.dispatchEvent(new Event("bc-provider-updated"));
  }catch(e){setError(e instanceof Error?e.message:"Penghapusan gagal.")}
  finally{setBusy(false)}
 }
 if(loading)return <section className="panel"><p>Memuat konfigurasi AI...</p></section>;
 if(!allowed)return <section className="panel"><h3 className="panel-title">Layanan AI</h3><p>Konfigurasi provider dikelola oleh pengelola studio.</p></section>;
 return <section className="panel"><h3 className="panel-title">API key dan provider AI</h3><p className="panel-desc">Key disimpan terenkripsi. Hanya empat karakter terakhir yang ditampilkan. Aktifkan satu provider untuk penulisan AI.</p>
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 {!ready&&<p role="alert">Penyimpanan rahasia belum siap. Hubungi pengelola server.</p>}
 <div>{items.length===0?<p>Belum ada API key. Studio tetap bisa digunakan untuk menulis dan menyimpan buku secara manual.</p>:items.map(item=><div className="provider-row" key={item.id}><div style={{minWidth:0,overflowWrap:"anywhere"}}><strong>{item.label}</strong><p>{item.provider} · {item.model} · ••••{item.lastFour}</p><span className="status">{item.active?"Aktif":"Nonaktif"}</span></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary-button" disabled={busy} onClick={()=>edit(item)} aria-label={"Ubah "+item.label}>Ubah</button><button className="secondary-button" disabled={busy} onClick={()=>remove(item)} aria-label={"Hapus "+item.label}>Hapus</button></div></div>)}</div>
 <form onSubmit={save} style={{marginTop:24}}><h4>{editing?"Ubah konfigurasi provider":"Tambah provider"}</h4><div className="form-grid two">
 <label className="studio-field"><span>Provider AI</span><select value={provider} disabled={Boolean(editing)||busy} onChange={e=>setProvider(e.target.value)}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="qwen">Qwen (Singapura)</option></select></label>
 <label className="studio-field"><span>Nama konfigurasi</span><input required minLength={2} maxLength={80} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Contoh: Penulis utama"/></label>
 <label className="studio-field"><span>ID model</span><input required maxLength={120} value={model} onChange={e=>setModel(e.target.value)} placeholder="ID model dari dashboard provider"/></label>
 <label className="studio-field"><span>API key provider</span><input type="password" autoComplete="new-password" spellCheck={false} required={!editing} minLength={16} maxLength={4096} value={secret} onChange={e=>setSecret(e.target.value)} placeholder={editing?"Kosongkan untuk mempertahankan key":"Masukkan key secara privat"}/></label>
 </div><label style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0"}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Gunakan sebagai provider aktif</label>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="submit" className="primary-button" disabled={busy||!ready}>{busy?"Menyimpan...":"Simpan provider"}</button>{editing&&<button type="button" className="secondary-button" disabled={busy} onClick={reset}>Batal</button>}</div>
 <p className="form-hint">Model dan saldo diatur pada akun provider. Menyimpan key tidak menjalankan permintaan AI. Batas harian studio tetap berlaku.</p></form></section>;
}
