"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
const providerChoices=[
 ["openai","OpenAI","gpt-4.1-mini"],["deepseek","DeepSeek","deepseek-flash"],
 ["qwen","Qwen (Alibaba Cloud)","qwen-plus"],["groq","Groq","openai/gpt-oss-120b"],
 ["gemini","Google Gemini","gemini-2.5-flash"],["anthropic","Anthropic Claude","claude-sonnet-4-5"],
 ["openrouter","OpenRouter","openai/gpt-4.1-mini"],["mistral","Mistral AI","mistral-small-latest"],
 ["xai","xAI Grok","grok-4"]
] as const;
type Provider={id:string;provider:string;label:string;model:string;lastFour:string;active:boolean;maxTokens:number;temperature:number};
type Usage={limit:number;used:number;remaining:number;inputTokens:number;outputTokens:number;requests:number;estimatedEvents:number;byProvider:Array<{credentialId:string;provider:string;model:string;tokens:number;requests:number}>};
const number=(n:number)=>new Intl.NumberFormat("id-ID").format(n);
export default function ProviderSettings(){
 const [items,setItems]=useState<Provider[]>([]),[loading,setLoading]=useState(true),[canManage,setCanManage]=useState(false),[ready,setReady]=useState(false);
 const [usage,setUsage]=useState<Usage|null>(null),[selected,setSelected]=useState("");
 const [bookType,setBookType]=useState<"FICTION"|"NONFICTION">("NONFICTION"),[testTitle,setTestTitle]=useState("Petualangan di Hutan Hujan"),[genre,setGenre]=useState("Petualangan"),[audience,setAudience]=useState("Pembaca remaja"),[topic,setTopic]=useState("Pertemuan tokoh utama dengan konflik pertama"),[goals,setGoals]=useState("Membuat bab pembuka yang menarik, runtut, dan sesuai pembaca."),[draft,setDraft]=useState(""),[testing,setTesting]=useState(false);
 const [editing,setEditing]=useState<string|null>(null),[provider,setProvider]=useState("openai"),[label,setLabel]=useState(""),[model,setModel]=useState(""),[secret,setSecret]=useState(""),[active,setActive]=useState(true),[maxTokens,setMaxTokens]=useState("1800"),[temperature,setTemperature]=useState("0.4");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const enabled=useMemo(()=>items.filter(x=>x.active),[items]);
 async function refresh(){
  const [response,usageResponse]=await Promise.all([
   fetch("/api/settings/providers",{cache:"no-store"}),
   fetch("/api/usage",{cache:"no-store"})
  ]);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Konfigurasi belum dapat dimuat.");
  setItems(data.providers||[]);setCanManage(Boolean(data.canManage));setReady(Boolean(data.encryptionReady));
  if(usageResponse.ok)setUsage(await usageResponse.json());
  const stored=window.localStorage.getItem("bc-selected-provider")||"";
  const available=(data.providers||[]).filter((x:Provider)=>x.active);
  const next=available.some((x:Provider)=>x.id===stored)?stored:(available[0]?.id||"");
  setSelected(next);
  if(next)window.localStorage.setItem("bc-selected-provider",next);
  else window.localStorage.removeItem("bc-selected-provider");
 }
 useEffect(()=>{let cancelled=false;refresh().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Konfigurasi belum dapat dimuat.")}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[]);
 function choose(id:string){
  setSelected(id);window.localStorage.setItem("bc-selected-provider",id);
  window.dispatchEvent(new CustomEvent("bc-ai-provider-selected",{detail:{credentialId:id}}));
 }
 function reset(){setEditing(null);setProvider("openai");setLabel("");setModel("");setSecret("");setActive(true);setMaxTokens("1800");setTemperature("0.4")}
 function edit(item:Provider){setEditing(item.id);setProvider(item.provider);setLabel(item.label);setModel(item.model);setActive(item.active);setSecret("");setMaxTokens(String(item.maxTokens));setTemperature(String(item.temperature));setMessage("");setError("")}
 async function save(event:FormEvent){
  event.preventDefault();setBusy(true);setMessage("");setError("");
  const data={label,model,active,maxTokens:Number(maxTokens),temperature:Number(temperature),...(!editing?{provider,apiKey:secret}:{}),...(editing&&secret?{apiKey:secret}:{})};
  try{
   const response=await fetch("/api/settings/providers"+(editing?"/"+editing:""),{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Konfigurasi belum tersimpan.");
   reset();await refresh();setMessage("Konfigurasi model tersimpan.");
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
   if(data.ok)setMessage("Koneksi "+item.label+" berhasil. Tes dapat menggunakan kuota API.");
   else setError(data.message||"Provider tidak dapat dihubungi.");
  }catch(e){setError(e instanceof Error?e.message:"Tes koneksi gagal")}
  finally{setBusy(false)}
 }
 async function toggle(item:Provider){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/settings/providers/"+item.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!item.active})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Status model gagal diubah.");
   await refresh();setMessage(item.active?"Model dinonaktifkan.":"Model tersedia untuk dipilih editor.");
   window.dispatchEvent(new Event("bc-provider-updated"));
  }catch(e){setError(e instanceof Error?e.message:"Status model gagal diubah.")}
  finally{setBusy(false)}
 }
 async function runDraft(event:FormEvent){
  event.preventDefault();
  if(!selected){setError("Pilih model yang aktif terlebih dahulu.");return}
  setTesting(true);setError("");setMessage("");setDraft("");
  try{
   const response=await fetch("/api/ai/draft",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({providerCredentialId:selected,bookType,title:testTitle,genre,targetAudience:audience,topic,learningGoals:goals})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Draf uji gagal dibuat.");
   setDraft(data.draft);
   setUsage(current=>current?{...current,used:current.limit-data.usage.remainingTokens,remaining:data.usage.remainingTokens,
    inputTokens:current.inputTokens+data.usage.inputTokens,outputTokens:current.outputTokens+data.usage.outputTokens,
    requests:current.requests+1,estimatedEvents:current.estimatedEvents+(data.usage.estimated?1:0)}:current);
   setMessage("Draf uji selesai menggunakan "+data.provider.name+" · "+data.provider.model+".");
  }catch(e){setError(e instanceof Error?e.message:"Draf uji gagal dibuat.")}
  finally{setTesting(false)}
 }
 async function remove(item:Provider){
  if(!window.confirm("Hapus konfigurasi "+item.label+" dan kunci ••••"+item.lastFour+"?"))return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/settings/providers/"+item.id,{method:"DELETE",headers:{"Content-Type":"application/json"}});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Penghapusan gagal.");
   await refresh();setMessage("Konfigurasi provider dihapus.");
   window.dispatchEvent(new Event("bc-provider-updated"));
  }catch(e){setError(e instanceof Error?e.message:"Penghapusan gagal.")}
  finally{setBusy(false)}
 }
 if(loading)return <section className="panel"><p>Memuat konfigurasi AI...</p></section>;
 const pct=usage?Math.min(100,Math.round(usage.used/Math.max(usage.limit,1)*100)):0;
 return <div className="workspace-stack">
  <section className="panel"><h3 className="panel-title">Model AI untuk penulisan</h3>
   <p className="panel-desc">Pilih model yang tersedia. Kunci tetap dikelola pengelola dan tidak pernah dikirim ke browser. Setiap pilihan menyimpan model dan batas outputnya sendiri.</p>
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   {enabled.length===0?<p>Belum ada model aktif. Minta pengelola studio menambahkan API key.</p>:<fieldset className="provider-choice-list" style={{border:0,padding:0,margin:0}}>
    <legend className="form-hint">Pilih satu model untuk permintaan penulisan berikutnya.</legend>
    {enabled.map(item=><label className="provider-row" key={item.id} style={{cursor:"pointer"}}>
      <input type="radio" name="selected-ai-provider" value={item.id} checked={selected===item.id} onChange={()=>choose(item.id)} aria-label={"Gunakan "+item.label+" "+item.model}/>
      <span style={{minWidth:0,flex:1,overflowWrap:"anywhere"}}><strong>{item.label}</strong><p>{item.provider} · {item.model} · maksimum {number(item.maxTokens)} token</p></span>
    </label>)}
   </fieldset>}
  </section>
  <section className="panel"><h3 className="panel-title">Template uji penulisan</h3><p className="panel-desc">Jalankan satu bab contoh dengan model pilihan. Respons menggunakan kuota provider dan dicatat di meter token.</p>
   <form onSubmit={runDraft}><div className="form-grid two">
    <label className="studio-field"><span>Jenis buku</span><select value={bookType} onChange={e=>setBookType(e.target.value as "FICTION"|"NONFICTION")}><option value="NONFICTION">Nonfiksi</option><option value="FICTION">Fiksi</option></select></label>
    <label className="studio-field"><span>Judul uji</span><input value={testTitle} maxLength={160} onChange={e=>setTestTitle(e.target.value)} required/></label>
    <label className="studio-field"><span>Genre atau bidang</span><input value={genre} maxLength={80} onChange={e=>setGenre(e.target.value)} placeholder="Fantasi / IPA SMP"/></label>
    <label className="studio-field"><span>Pembaca sasaran</span><input value={audience} maxLength={120} onChange={e=>setAudience(e.target.value)} required/></label>
    <label className="studio-field"><span>Topik bab</span><textarea rows={3} value={topic} maxLength={250} onChange={e=>setTopic(e.target.value)} required/></label>
    <label className="studio-field"><span>Tujuan bab</span><textarea rows={3} value={goals} maxLength={2000} onChange={e=>setGoals(e.target.value)} required/></label>
   </div><button className="primary-button" type="submit" disabled={testing||!selected}>{testing?"Membuat draf...":"Uji model pilihan"}</button></form>
   {draft&&<div className="draft-preview" aria-live="polite"><h4>Hasil draf uji</h4><pre style={{whiteSpace:"pre-wrap",font:"inherit"}}>{draft}</pre></div>}
  </section>
  <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">Token Studio hari ini</h3><p className="panel-desc">Pemakaian aktual dari respons provider; perkiraan diberi penanda bila provider tidak mengirim data token.</p></div><span className="status">{usage?number(usage.remaining)+" tersisa":"Memuat"}</span></div>
   {usage?<><div className="usage-meter-copy"><strong>{number(usage.used)} / {number(usage.limit)} token</strong><span>{pct}% terpakai · {number(usage.requests)} permintaan</span></div><progress aria-label="Pemakaian token hari ini" max={usage.limit} value={Math.min(usage.used,usage.limit)} style={{width:"100%",height:14}}/><div className="workspace-stats"><div><strong>{number(usage.inputTokens)}</strong><span>Token masukan</span></div><div><strong>{number(usage.outputTokens)}</strong><span>Token keluaran</span></div><div><strong>{number(usage.remaining)}</strong><span>Token tersisa</span></div><div><strong>{number(usage.estimatedEvents)}</strong><span>Perkiraan</span></div></div>
   {usage.byProvider.length>0&&<div className="usage-provider-list">{usage.byProvider.map(x=><div className="provider-row" key={x.credentialId}><span><strong>{x.provider}</strong><p>{x.model} · {number(x.requests)} permintaan</p></span><strong>{number(x.tokens)} token</strong></div>)}</div>}
   <small className="form-hint">Batas Studio berlaku per pengguna per hari UTC. Saldo dan batas tagihan diatur langsung pada akun masing-masing penyedia AI.</small></>:<p>Data pemakaian belum dapat dimuat.</p>}
  </section>
  <section className="panel"><h3 className="panel-title">Panduan singkat</h3><ol className="setup-steps"><li>Pengelola menambah provider, label, ID model, API key, temperatur, dan batas output.</li><li>Tekan <strong>Tes koneksi</strong>; hasilnya menyebut berhasil atau memberi langkah pemeriksaan tanpa membocorkan key.</li><li>Aktifkan model yang disetujui. Editor memilih model dengan radio di atas.</li><li>Jalankan uji draf fiksi atau nonfiksi memakai template pada <code>docs/AI_PROVIDER_SETUP_AND_BOOK_TEST.md</code>.</li></ol></section>
  {canManage&&<section className="panel"><h3 className="panel-title">API key dan CRUD provider</h3><p className="panel-desc">Hanya pengelola dapat menambah, mengubah, menguji, menonaktifkan, atau menghapus key. Key disimpan terenkripsi di server; tampilan hanya menunjukkan empat karakter terakhir.</p>
   {!ready&&<p role="alert">Penyimpanan rahasia belum siap. Hubungi pengelola server.</p>}
   <div>{items.length===0?<p>Belum ada konfigurasi provider.</p>:items.map(item=><div className="provider-row" key={item.id}><div style={{minWidth:0,overflowWrap:"anywhere"}}><strong>{item.label}</strong><p>{item.provider} · {item.model} · ••••{item.lastFour}</p><span className="status">{item.active?"Tersedia":"Nonaktif"} · {number(item.maxTokens)} token · suhu {item.temperature}</span></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary-button" disabled={busy} onClick={()=>edit(item)} aria-label={"Ubah "+item.label}>Ubah</button><button className="secondary-button" disabled={busy||!ready} onClick={()=>test(item)} aria-label={"Tes koneksi "+item.label}>Tes koneksi</button><button className="secondary-button" disabled={busy} onClick={()=>toggle(item)} aria-label={(item.active?"Nonaktifkan ":"Aktifkan ")+item.label}>{item.active?"Nonaktifkan":"Aktifkan"}</button><button className="secondary-button" disabled={busy} onClick={()=>remove(item)} aria-label={"Hapus "+item.label}>Hapus</button></div></div>)}</div>
   <form onSubmit={save} style={{marginTop:24}}><h4>{editing?"Ubah konfigurasi model":"Tambah API key/model"}</h4><div className="form-grid two">
    <label className="studio-field"><span>Provider AI</span><select value={provider} disabled={Boolean(editing)||busy} onChange={e=>{const next=e.target.value;setProvider(next);setModel(providerChoices.find(x=>x[0]===next)?.[2]||"")}}>{providerChoices.map(([id,name,example])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label className="studio-field"><span>Nama konfigurasi</span><input required minLength={2} maxLength={80} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Contoh: OpenAI untuk bab panjang"/></label>
    <label className="studio-field"><span>ID model</span><input required maxLength={120} value={model} onChange={e=>setModel(e.target.value)} placeholder="ID model dari dashboard provider"/></label>
    <label className="studio-field"><span>API key</span><input type="password" autoComplete="new-password" spellCheck={false} required={!editing} minLength={16} maxLength={4096} value={secret} onChange={e=>setSecret(e.target.value)} placeholder={editing?"Kosongkan agar key tersimpan tetap dipakai":"Tempel key di sesi privat ini"}/></label>
    <label className="studio-field"><span>Batas output per permintaan</span><input type="number" required min={16} max={3000} value={maxTokens} onChange={e=>setMaxTokens(e.target.value)}/><small>16–3.000 token; sesuaikan dengan batas model.</small></label>
    <label className="studio-field"><span>Temperatur</span><input type="number" required min={0} max={2} step={0.1} value={temperature} onChange={e=>setTemperature(e.target.value)}/><small>0 untuk konsisten; nilai lebih tinggi untuk variasi kreatif.</small></label>
   </div><label style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0"}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Tersedia bagi editor untuk dipilih</label>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="submit" className="primary-button" disabled={busy||!ready}>{busy?"Menyimpan...":editing?"Simpan perubahan":"Simpan API key"}</button>{editing&&<button type="button" className="secondary-button" disabled={busy} onClick={reset}>Batal</button>}</div>
   <p className="form-hint">Tes koneksi mengirim prompt singkat dan dapat memakai kuota provider. Nilai token pada meter Studio berasal dari data pemakaian respons; kuota provider tetap diperiksa pada dashboard provider.</p>
   </form>
  </section>}
 </div>;
}
