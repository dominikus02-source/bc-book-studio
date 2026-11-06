"use client";
import { FormEvent,useEffect,useState } from "react";
import FormTransfer,{type TransferField} from "./form-transfer";
const providerMetadataFields:TransferField[]=[{key:"provider",label:"Provider AI",maxLength:50},{key:"label",label:"Nama konfigurasi",maxLength:80},{key:"model",label:"ID model",maxLength:120},{key:"active",label:"Provider aktif",type:"boolean"}];
const providerChoices=[
 ["openai","OpenAI","gpt-4.1-mini"],
 ["deepseek","DeepSeek","deepseek-flash"],
 ["qwen","Qwen (Alibaba Cloud)","qwen-plus"],
 ["groq","Groq","openai/gpt-oss-120b"],
 ["gemini","Google Gemini","gemini-2.5-flash"],
 ["anthropic","Anthropic Claude","claude-sonnet-4-5"],
 ["openrouter","OpenRouter","openai/gpt-4.1-mini"],
 ["mistral","Mistral AI","mistral-small-latest"],
 ["xai","xAI Grok","grok-4"]
] as const;
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
 async function test(item:Provider){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/settings/providers/"+item.id+"/test",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Gagal menguji provider.");
   if(data.ok)setMessage("Koneksi "+item.label+" berhasil. Tes singkat dapat memakai kuota API.");
   else setError(data.message||"Provider tidak dapat dihubungi.");
  }catch(e){setError(e instanceof Error?e.message:"Tes koneksi gagal")}
  finally{setBusy(false)}
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
 return <section className="panel"><h3 className="panel-title">API key dan provider AI</h3><p className="panel-desc">Key disimpan terenkripsi dalam database. Hanya empat karakter terakhir yang ditampilkan. Pilih satu provider aktif sebagai otak penulisan buku. Gunakan Tes koneksi untuk memastikan model dan key tersedia.</p>
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 {!ready&&<p role="alert">Penyimpanan rahasia belum siap. Hubungi pengelola server.</p>}
 <div>{items.length===0?<p>Belum ada API key. Studio tetap bisa digunakan untuk menulis dan menyimpan buku secara manual.</p>:items.map(item=><div className="provider-row" key={item.id}><div style={{minWidth:0,overflowWrap:"anywhere"}}><strong>{item.label}</strong><p>{item.provider} · {item.model} · ••••{item.lastFour}</p><span className="status">{item.active?"Aktif":"Nonaktif"}</span></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary-button" disabled={busy} onClick={()=>edit(item)} aria-label={"Ubah "+item.label}>Ubah</button><button className="secondary-button" disabled={busy||!ready} onClick={()=>test(item)} aria-label={"Tes koneksi "+item.label}>Tes koneksi</button><button className="secondary-button" disabled={busy} onClick={()=>remove(item)} aria-label={"Hapus "+item.label}>Hapus</button></div></div>)}</div>
 <form onSubmit={save} style={{marginTop:24}}><h4>{editing?"Ubah konfigurasi provider":"Tambah provider"}</h4><FormTransfer name="Metadata provider AI (tanpa API key)" fields={providerMetadataFields} values={{provider,label,model,active}} onApply={r=>{if(!editing&&typeof r.provider==="string"&&providerChoices.some(x=>x[0]===r.provider))setProvider(r.provider);if(typeof r.label==="string")setLabel(r.label);if(typeof r.model==="string")setModel(r.model);if(typeof r.active==="boolean")setActive(r.active)}} disabled={busy} hint="File hanya memuat nama, model, dan status provider. API key wajib dimasukkan manual secara rahasia; tidak pernah disalin ke XLSX atau Markdown."/><div className="form-grid two">
 <label className="studio-field"><span>Provider AI</span><select value={provider} disabled={Boolean(editing)||busy} onChange={e=>{const next=e.target.value;setProvider(next);setModel(providerChoices.find(x=>x[0]===next)?.[2]||"")}}>{providerChoices.map(([id,name,example])=><option key={id} value={id}>{name} · {example}</option>)}</select></label>
 <label className="studio-field"><span>Nama konfigurasi</span><input required minLength={2} maxLength={80} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Contoh: Penulis utama"/></label>
 <label className="studio-field"><span>ID model</span><input required maxLength={120} value={model} onChange={e=>setModel(e.target.value)} placeholder="ID model dari dashboard provider"/></label>
 <label className="studio-field"><span>API key provider</span><input type="password" autoComplete="new-password" spellCheck={false} required={!editing} minLength={16} maxLength={4096} value={secret} onChange={e=>setSecret(e.target.value)} placeholder={editing?"Kosongkan untuk mempertahankan key":"Masukkan key secara privat"}/></label>
 </div><label style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0"}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Gunakan sebagai provider aktif</label>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="submit" className="primary-button" disabled={busy||!ready}>{busy?"Menyimpan...":"Simpan provider"}</button>{editing&&<button type="button" className="secondary-button" disabled={busy} onClick={reset}>Batal</button>}</div>
 <p className="form-hint">Model dan saldo mengikuti akun provider. Nama model harus sesuai izin akun. Tes koneksi mengirim prompt singkat yang dapat menggunakan kuota; batas harian studio tetap berlaku.</p></form></section>;
}
