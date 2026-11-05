"use client";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";

type ProviderName = "deepseek"|"openai"|"groq"|"gemini"|"anthropic"|"openrouter"|"mistral"|"xai";
type Preset = { label: string; exampleModel: string; endpoint: string; protocol: string };
type Credential = { id: string; provider: ProviderName; label: string; model: string; enabled: boolean; isDefault: boolean; hasKey: boolean };
type Form = { id: string; provider: ProviderName; label: string; model: string; apiKey: string; enabled: boolean; isDefault: boolean };
const names: ProviderName[] = ["deepseek","openai","groq","gemini","anthropic","openrouter","mistral","xai"];
const empty: Form = { id: "", provider: "deepseek", label: "DeepSeek Buku", model: "deepseek-flash", apiKey: "", enabled: false, isDefault: false };
const input = { display:"block",width:"100%",padding:12,border:"1px solid #cbd5e1",borderRadius:10,boxSizing:"border-box" as const,marginTop:5,background:"#fff" };
const primary = { border:0,borderRadius:10,background:"#2544b9",color:"white",padding:"12px 18px",cursor:"pointer" };
export default function AiSettings() {
  const [token,setToken] = useState("");
  const [rows,setRows] = useState<Credential[]>([]);
  const [catalog,setCatalog] = useState<Record<string, Preset>>({});
  const [vaultReady,setVaultReady] = useState(false);
  const [form,setForm] = useState<Form>(empty);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const auth = useCallback(() => token.trim() ? {Authorization:"Bearer "+token.trim()} : {},[token]);
  const load = useCallback(async() => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai-providers",{headers:auth(),cache:"no-store"});
      const data = await response.json().catch(()=>({}));
      if(!response.ok) throw new Error("Akses pengaturan memerlukan token peninjau atau akun admin Cloudflare yang diizinkan.");
      setRows(data.providers||[]);setCatalog(data.catalog||{});setVaultReady(Boolean(data.vaultReady));
      setError("");
    } catch(e){setError(e instanceof Error?e.message:"Gagal memuat pengaturan")}
    finally {setLoading(false);}
  },[auth]);
  useEffect(()=>{void load()},[load]);
  function choose(value: ProviderName){
    const p=catalog[value];setForm({...form,provider:value,label:p?.label||value,model:p?.exampleModel||"",apiKey:""});
  }
  async function send(method:"POST"|"PATCH"|"DELETE",payload:object){
    const response=await fetch("/api/ai-providers",{method,headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify(payload),cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||"Permintaan gagal (HTTP "+response.status+")");
    return data;
  }
  async function save(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      if(!form.id && !form.apiKey.trim()) throw new Error("Masukkan API key provider.");
      const {id,apiKey,...values}=form;
      await send(id?"PATCH":"POST",{...values,...(id?{id}:{}),...(apiKey.trim()?{apiKey:apiKey.trim()}: {})});
      setForm(empty);await load();setNotice("Konfigurasi tersimpan aman dalam database. Kunci tidak ditampilkan kembali.");
    } catch(e){setError(e instanceof Error?e.message:"Penyimpanan gagal")}
    finally {setBusy(false);}
  }
  async function test(id:string) {
    setBusy(true);setError("");setNotice("");
    try {
      const response=await send("POST",{action:"test",id});
      if(response.ok)setNotice("Provider berhasil menghasilkan respons. Tes ini dapat menggunakan kuota API.");
      else setError(response.message||"Provider gagal menjawab.");
    } catch(e){setError(e instanceof Error?e.message:"Tes gagal")}
    finally {setBusy(false);}
  }
  async function remove(id:string) {
    if(!confirm("Hapus provider dan API key terenkripsi ini?"))return;
    setBusy(true);setError("");setNotice("");
    try {await send("DELETE",{id});if(form.id===id)setForm(empty);await load();setNotice("Provider berhasil dihapus.");}
    catch(e){setError(e instanceof Error?e.message:"Gagal menghapus")}
    finally {setBusy(false);}
  }
  function edit(row:Credential){
    setForm({id:row.id,provider:row.provider,label:row.label,model:row.model,apiKey:"",enabled:row.enabled,isDefault:row.isDefault});
    setError("");setNotice("");
  }
  return <main style={{maxWidth:1050,margin:"auto",padding:"26px 18px",color:"#1c2b45",fontFamily:"system-ui,sans-serif"}}>
    <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:15,flexWrap:"wrap"}}>
      <Link href="/" style={{color:"#2544b9"}}>← Kembali ke perpustakaan</Link>
      <span style={{fontSize:12,color:"#64748b"}}>BC Book Studio · Pengaturan aman</span>
    </nav>
    <h1>Pengaturan AI & API Key</h1>
    <p>Tambahkan beberapa provider sebagai otak penulisan buku. Pilih model sesuai akun provider. Kunci disimpan terenkripsi dan tidak pernah dikirim kembali ke browser.</p>
    <section style={{background:"white",borderRadius:14,padding:20,marginBottom:18}}>
      <label style={{display:"block",fontWeight:600}}>Token pengelola / peninjau
        <input type="password" autoComplete="off" spellCheck={false} aria-label="Token pengelola" value={token} onChange={e=>setToken(e.target.value)} placeholder="Hanya diperlukan jika akun admin Cloudflare belum diizinkan" style={input}/>
      </label>
      <p style={{fontSize:12,color:"#64748b"}}>Token hanya berada di memori halaman ini. Jangan kirim API key atau token lewat chat. Jika Anda telah login sebagai admin Cloudflare, token dapat dikosongkan.</p>
      <button style={primary} type="button" disabled={loading} onClick={()=>void load()}>{loading?"Memeriksa...":"Buka konfigurasi"}</button>
    </section>
    {!vaultReady && rows.length===0 && <p style={{background:"#fff7ed",padding:12,borderRadius:10,color:"#92400e"}}>Vault terenkripsi memerlukan AI_PROVIDER_ENCRYPTION_KEY pada server. Jangan memasukkan kunci sampai konfigurasi ini aktif.</p>}
    {error&&<p role="alert" style={{color:"#b91c1c",background:"#fef2f2",padding:12,borderRadius:10}}>{error}</p>}
    {notice&&<p role="status" style={{color:"#166534",background:"#ecfdf5",padding:12,borderRadius:10}}>{notice}</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,360px),1fr))",gap:18}}>
      <section style={{background:"white",padding:23,borderRadius:14}}>
        <h2>{form.id?"Ubah provider":"Tambah provider"}</h2>
        <form onSubmit={save}>
          <label>Provider
            <select style={input} value={form.provider} onChange={e=>choose(e.target.value as ProviderName)}>
              {names.map(name=><option key={name} value={name}>{catalog[name]?.label||name}</option>)}
            </select>
          </label>
          <p><label>Nama konfigurasi<input style={input} maxLength={90} required value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label></p>
          <p><label>Model ID<input style={input} maxLength={150} required value={form.model} placeholder={catalog[form.provider]?.exampleModel||"Model dari provider"} onChange={e=>setForm({...form,model:e.target.value})}/></label></p>
          <p style={{fontSize:12,color:"#64748b",overflowWrap:"anywhere"}}>Endpoint resmi: {catalog[form.provider]?.endpoint||"Menunggu katalog"}</p>
          <p><label>API key {form.id?"(biarkan kosong jika tidak diubah)":""}
            <input style={input} type="password" autoComplete="new-password" spellCheck={false} value={form.apiKey} onChange={e=>setForm({...form,apiKey:e.target.value})}/>
          </label></p>
          <p><label><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/> Aktif untuk membuat buku</label></p>
          <p><label><input type="checkbox" checked={form.isDefault} onChange={e=>setForm({...form,isDefault:e.target.checked,enabled:e.target.checked?true:form.enabled})}/> Jadikan model utama</label></p>
          <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            <button disabled={busy||!vaultReady} style={{...primary,opacity:busy||!vaultReady?0.5:1}} type="submit">{form.id?"Simpan perubahan":"Simpan API key"}</button>
            {form.id&&<button type="button" onClick={()=>setForm(empty)} style={{...primary,background:"#64748b"}}>Batal</button>}
          </div>
        </form>
      </section>
      <section style={{background:"white",padding:23,borderRadius:14}}>
        <h2>Provider tersimpan ({rows.length})</h2>
        {rows.length===0?<p style={{color:"#64748b"}}>Belum ada konfigurasi. Gunakan formulir di samping.</p>:rows.map(row=>
          <article key={row.id} style={{padding:14,border:"1px solid #dbe4f0",borderRadius:12,marginBottom:12}}>
            <strong>{row.label}</strong> {row.isDefault?"★ Utama":""}
            <p style={{fontSize:13,margin:"5px 0",overflowWrap:"anywhere"}}>{catalog[row.provider]?.label||row.provider} · {row.model}</p>
            <p style={{fontSize:12,color:row.enabled?"#166534":"#64748b"}}>{row.enabled?"Aktif":"Nonaktif"} · {row.hasKey?"Secret terenkripsi tersimpan":"Belum ada secret"}</p>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button type="button" style={{...primary,padding:9,background:"#475569"}} onClick={()=>edit(row)}>Edit</button>
              <button type="button" style={{...primary,padding:9}} disabled={busy||!vaultReady} onClick={()=>void test(row.id)}>Tes koneksi</button>
              <button type="button" style={{...primary,padding:9,background:"#b91c1c"}} disabled={busy} onClick={()=>void remove(row.id)}>Hapus</button>
            </div>
          </article>)}
      </section>
    </div>
    <p style={{marginTop:20,fontSize:12,color:"#64748b"}}>Tes koneksi mengirim prompt singkat ke provider dan dapat dikenakan biaya. Buku AI tetap berupa draf yang wajib melalui pemeriksaan editorial.</p>
  </main>;
}
