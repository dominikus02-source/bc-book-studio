"use client";
import {useCallback,useEffect,useState} from "react";
const names={PDF_METADATA:"Metadata PDF",VENDOR_PREFLIGHT:"Preflight vendor",OFFICIAL_DOCUMENT:"Dokumen penerbitan",PHYSICAL_PROOF:"Proof fisik",EPUB_READER:"Aplikasi pembaca EPUB",MANUAL_ACCESSIBILITY:"Aksesibilitas manual",DISTRIBUTOR:"Penerimaan distributor",BAHASACERDAS:"Ekosistem BahasaCerdas"};
type Kind=keyof typeof names;
type Form={kind:Kind;result:"PENDING"|"SIMULATED_PASS"|"SIMULATED_FAIL";summary:string;target:string};
type Row=Form&{id:string;version:string;archived:boolean;snapshot:string|null;layoutVersion:number};
const empty:Form={kind:"PDF_METADATA",result:"PENDING",summary:"",target:""};
export default function ReleaseSimulations({bookId}:{bookId:string}){
 const [rows,setRows]=useState<Row[]>([]),[form,setForm]=useState<Form>(empty),[selected,setSelected]=useState<Row|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const path="/api/books/"+encodeURIComponent(bookId)+"/release-simulations";
 const load=useCallback(async(signal?:AbortSignal)=>{
  const r=await fetch(path,{cache:"no-store",signal});const data=await r.json();
  if(!r.ok)throw Error(data.error||"Gagal memuat simulasi");
  return data.records as Row[];
 },[path]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setRows([]);setSelected(null);setForm(empty);
  void load(controller.signal).then(setRows).catch(e=>{if(e.name!=="AbortError")setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[load]);
 function edit(row:Row){setSelected(row);setForm({kind:row.kind,result:row.result,summary:row.summary,target:row.target});setError("");setNotice("")}
 function reset(){setSelected(null);setForm(empty);setError("");setNotice("")}
 async function save(action:"create"|"update"|"archive"|"restore",row=selected){
  setBusy(true);setError("");setNotice("");
  try{
   const body=action==="create"?{action,data:form}:action==="update"?{action,recordId:row?.id,expectedVersion:row?.version,data:form}:{action,recordId:row?.id,expectedVersion:row?.version};
   const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await r.json();
   if(!r.ok)throw Error(data.error||"Gagal menyimpan simulasi");
   setRows(await load());setSelected(null);setForm(empty);setNotice("Catatan simulasi tersimpan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan")}finally{setBusy(false)}
 }
 return <section className="panel release-simulations" aria-label="Simulasi kesiapan rilis">
  <h3>Simulasi kesiapan rilis</h3>
  <p className="panel-desc">Latihan preflight, proof, dokumen, pembaca, dan distribusi. Status simulasi tidak memenuhi gerbang persetujuan rilis. Untuk uji fisik atau penerimaan pihak luar, catat hasil sebenarnya di bukti penerbitan.</p>
  {loading&&<p role="status">Memuat simulasi...</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form onSubmit={e=>{e.preventDefault();void save(selected?"update":"create")}}>
   <fieldset disabled={busy||loading} style={{border:0,padding:0,display:"grid",gap:12,minWidth:0}}>
    <legend>{selected?"Ubah catatan simulasi":"Tambah catatan simulasi"}</legend>
    <label className="studio-field">Jenis pengujian<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as Kind})}>{Object.entries(names).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="studio-field">Hasil simulasi<select value={form.result} onChange={e=>setForm({...form,result:e.target.value as Form["result"]})}><option value="PENDING">Menunggu simulasi</option><option value="SIMULATED_PASS">Simulasi lulus</option><option value="SIMULATED_FAIL">Simulasi gagal</option></select></label>
    <label className="studio-field">Target simulasi<input maxLength={500} value={form.target} onChange={e=>setForm({...form,target:e.target.value})}/></label>
    <label className="studio-field">Catatan simulasi<textarea required minLength={12} maxLength={4000} rows={4} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></label>
    <div className="review-actions"><button type="submit" className="primary-button" disabled={form.summary.trim().length<12}>{busy?"Menyimpan...":"Simpan simulasi"}</button><button type="button" className="secondary-button" onClick={reset}>Baru</button><button type="button" className="secondary-button" onClick={()=>{void load().then(setRows).catch(e=>setError(e.message))}}>Muat ulang</button></div>
   </fieldset>
  </form>
  {!loading&&!rows.length&&<p>Belum ada catatan simulasi untuk buku ini.</p>}
  <ul style={{padding:0,listStyle:"none"}}>{rows.filter(row=>!row.archived).map(row=><li key={row.id} className="panel">
   <strong>{names[row.kind]}</strong><p>{row.result==="SIMULATED_PASS"?"Simulasi lulus":row.result==="SIMULATED_FAIL"?"Simulasi gagal":"Menunggu simulasi"}</p><p>{row.summary}</p><p className="form-hint">{row.target} · Tata letak v{row.layoutVersion} · {row.snapshot?"Snapshot "+new Date(row.snapshot).toLocaleString("id-ID"):"Draf tanpa snapshot"}</p>
   <div className="review-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>edit(row)}>Ubah simulasi</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(confirm("Arsipkan catatan simulasi ini?"))void save("archive",row)}}>Arsipkan simulasi</button></div>
  </li>)}</ul>
  <details><summary>Arsip simulasi ({rows.filter(row=>row.archived).length})</summary>{rows.filter(row=>row.archived).map(row=><div key={row.id}><p>{names[row.kind]} · {row.summary}</p><button type="button" className="secondary-button" disabled={busy} onClick={()=>void save("restore",row)}>Pulihkan simulasi</button></div>)}</details>
 </section>;
}
