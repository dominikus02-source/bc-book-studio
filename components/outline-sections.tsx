"use client";
import {useCallback,useEffect,useState} from "react";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";
import {sectionCard} from "../lib/stage-card-status";
const SECTION_TRANSFER_FIELDS:TransferField[]=[
 {key:"title",label:"Nama subbagian",required:true,maxLength:180},
 {key:"objective",label:"Tujuan subbagian",required:true,maxLength:1500},
 {key:"content",label:"Isi artikel / dua paragraf",maxLength:12000},
 {key:"genreTarget",label:"Genre target",options:["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"]},
 {key:"accessTier",label:"Status akses konten",options:["PUBLIC","PREMIUM","DRAFT"]},
];
type Section={id:string;title:string;objective:string;content:string;genreTarget:string;accessTier:string;position:number;parentId:string|null;archivedAt:string|null;updatedAt:string;revisions:{id:string;action:string;snapshot:unknown;createdAt:string}[]};
export default function OutlineSections({bookId,chapterId,bookContext=""}:{bookId:string;chapterId:string;bookContext?:string}){
 const endpoint="/api/books/"+encodeURIComponent(bookId)+"/chapters/"+encodeURIComponent(chapterId)+"/sections";
 const [items,setItems]=useState<Section[]>([]),[title,setTitle]=useState(""),[objective,setObjective]=useState(""),[parentId,setParentId]=useState("");
 const [content,setContent]=useState(""),[genreTarget,setGenreTarget]=useState("NONFICTION"),[accessTier,setAccessTier]=useState("DRAFT");
 const [selected,setSelected]=useState<Section|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [loaded,setLoaded]=useState(false);
 const refresh=useCallback(async()=>{const r=await fetch(endpoint,{cache:"no-store"});const body=await r.json();if(!r.ok)throw Error(body.error||"Gagal memuat subbagian");setItems(body.sections);setLoaded(true)},[endpoint]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message))},[refresh]);
 async function action(path:string,method:string,body:object){
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error||"Perubahan gagal");await refresh();setNotice("Perubahan kerangka tersimpan dan tercatat dalam riwayat.");return true}
  catch(e){setError(e instanceof Error?e.message:"Perubahan gagal");return false}finally{setBusy(false)}
 }
 const active=items.filter(s=>!s.archivedAt),top=active.filter(s=>!s.parentId),children=(id:string)=>active.filter(s=>s.parentId===id).sort((a,b)=>a.position-b.position);
 function moveSection(section:Section,direction:number){
  const siblings=items.filter(s=>!s.archivedAt&&s.parentId===section.parentId).sort((a,b)=>a.position-b.position);
  const from=siblings.findIndex(s=>s.id===section.id),to=from+direction;
  if(from<0||to<0||to>=siblings.length)return;
  const expectedOrder=siblings.map(s=>s.id),ids=expectedOrder.slice();
  [ids[from],ids[to]]=[ids[to],ids[from]];
  void action(endpoint+"/reorder","PATCH",{parentId:section.parentId,ids,expectedOrder});
 }
 function restoreRevision(section:Section,revisionId:string){
  if(!confirm("Pulihkan metadata dari revisi ini? Perubahan sekarang akan dicatat dalam riwayat."))return;
  void action(endpoint+"/"+section.id,"PATCH",{expectedVersion:section.updatedAt,restoreRevision:revisionId});
 }

 const reset=()=>{setTitle("");setObjective("");setParentId("");setContent("");setGenreTarget("NONFICTION");setAccessTier("DRAFT");setSelected(null)};
 const select=(s:Section)=>{setSelected(s);setTitle(s.title);setObjective(s.objective);setParentId(s.parentId??"");setContent(s.content||"");setGenreTarget(s.genreTarget||"NONFICTION");setAccessTier(s.accessTier||"DRAFT")};
 const changed=Boolean(title.trim()&&objective.trim());
 return <section className="outline-sections" aria-label="Subbagian hierarkis">
  <h4>Subbagian dan hierarki bab</h4>
  <p className="form-hint">Susun subbagian sesuai urutan pembahasan. Pilih Ubah untuk menyunting, atau gunakan Arsip jika tidak lagi diperlukan. Semua perubahan tercatat.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loaded&&!active.length&&<p>Belum ada subbagian. Tambahkan subbagian pertama.</p>}
  <ol className="outline-sublist">{top.sort((a,b)=>a.position-b.position).map(s=><li key={s.id} className={"chapter-status-card status-"+sectionCard(s).color}><strong>{s.title}</strong><button type="button" className={"card-status-label status-action status-"+sectionCard(s).color} aria-label={sectionCard(s).label+" ? Buka isian subbagian "+s.title} onClick={()=>{select(s);setTimeout(()=>document.querySelector<HTMLInputElement>('[aria-label="Subbagian hierarkis"] input')?.focus(),50)}}>{sectionCard(s).label}</button><p>{s.objective}</p><p className="form-hint">{s.genreTarget} · {s.accessTier}</p><p>{s.content?.slice(0,280)}</p>
   <div className="outline-actions">
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>select(s)}>Ubah</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>moveSection(s,-1)}>Naik</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>moveSection(s,1)}>Turun</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(confirm("Arsipkan subbagian ini? Anak subbagian harus diarsipkan terlebih dahulu."))void action(endpoint+"/"+s.id,"DELETE",{expectedVersion:s.updatedAt})}}>Arsip</button>
   </div><ul>{children(s.id).map(ch=><li key={ch.id} className={"chapter-status-card status-"+sectionCard(ch).color}><strong>{ch.title}</strong><button type="button" className={"card-status-label status-action status-"+sectionCard(ch).color} aria-label={sectionCard(ch).label+" ? Buka isian subbagian "+ch.title} onClick={()=>{select(ch);setTimeout(()=>document.querySelector<HTMLInputElement>('[aria-label="Subbagian hierarkis"] input')?.focus(),50)}}>{sectionCard(ch).label}</button><p>{ch.objective}</p><p className="form-hint">{ch.genreTarget} · {ch.accessTier}</p><p>{ch.content?.slice(0,280)}</p>
    <div className="outline-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>select(ch)}>Ubah</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>moveSection(ch,-1)}>Naik</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>moveSection(ch,1)}>Turun</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(confirm("Arsipkan anak subbagian?"))void action(endpoint+"/"+ch.id,"DELETE",{expectedVersion:ch.updatedAt})}}>Arsip</button></div></li>)}</ul>
   <details><summary>Riwayat subbagian ({s.revisions.length})</summary><ol>{s.revisions.map(rev=><li key={rev.id}>{rev.action} — {new Date(rev.createdAt).toLocaleString("id-ID")}<pre>{JSON.stringify(rev.snapshot,null,2)}</pre><button type="button" className="secondary-button" disabled={busy} onClick={()=>restoreRevision(s,rev.id)}>Pulihkan isi revisi ini</button></li>)}</ol></details>
  </li>)}</ol>
  <details className="stage-transfer-panel" open>
   <summary>Template Stage 2 — Subbagian dan prompt AI</summary>
   <FormTransfer name="Stage 2 Subbagian" bookId={bookId} fields={SECTION_TRANSFER_FIELDS} onPersist={async(r:TransferRecord)=>{const next={title:typeof r.title==="string"?r.title:title,objective:typeof r.objective==="string"?r.objective:objective,content:typeof r.content==="string"?r.content:content,genreTarget:typeof r.genreTarget==="string"?r.genreTarget:genreTarget,accessTier:typeof r.accessTier==="string"?r.accessTier:accessTier};if(next.title.trim().length<2||!next.objective.trim())throw Error("Judul dan tujuan subbagian wajib diisi sebelum autosave.");if(!selected&&active.some(item=>item.title.trim().toLowerCase()===next.title.trim().toLowerCase()))throw Error("Subbagian ini sudah ada. Pilih Ubah untuk mengimpor revisi.");const ok=await action(endpoint+(selected?"/"+selected.id:""),selected?"PATCH":"POST",selected?{...next,expectedVersion:selected.updatedAt}:{...next,parentId:parentId||null});if(!ok)throw Error("Subbagian belum tersimpan, periksa pesan error di atas.");}}
    values={{title,objective,content,genreTarget,accessTier}} disabled={busy}
    aiContext={`STAGE=RANCANG; BRIEF DAN KERANGKA SEBELUMNYA: ${bookContext}; BAB=${chapterId}; SUBBAGIAN YANG SUDAH ADA: ${active.map(item=>item.title+" — "+item.objective).join("; ")}. Kembangkan satu subbagian, tujuan yang spesifik, dan hubungan yang koheren dengan subbagian lain. Pertahankan field_id title/objective. Template dipakai untuk satu subbagian; penulis memilih induk di form setelah upload.`}
    onApply={(record:TransferRecord)=>{if(typeof record.title==="string")setTitle(record.title);if(typeof record.objective==="string")setObjective(record.objective);if(typeof record.content==="string")setContent(record.content);if(typeof record.genreTarget==="string")setGenreTarget(record.genreTarget);if(typeof record.accessTier==="string")setAccessTier(record.accessTier)}}/>
   <p className="form-hint">Unggahan valid langsung mengisi dan menyimpan subbagian. Pilih induk sebelum mengunggah jika diperlukan; untuk revisi pilih Ubah agar tidak membuat duplikat.</p>
  </details>
  <form className="outline-section-form" onSubmit={e=>{e.preventDefault();if(!changed)return;void (async()=>{const ok=await action(endpoint+(selected?"/"+selected.id:""),selected?"PATCH":"POST",selected?{title,objective,content,genreTarget,accessTier,expectedVersion:selected.updatedAt}:{title,objective,content,genreTarget,accessTier,parentId:parentId||null});if(ok)reset()})()}}>
   <label className="studio-field"><span>Nama subbagian</span><input maxLength={180} required minLength={2} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="studio-field"><span>Tujuan pembahasan</span><textarea maxLength={1500} required minLength={2} value={objective} onChange={e=>setObjective(e.target.value)}/></label>
   <label className="studio-field"><span>Konten artikel / cerita (dua paragraf dianjurkan)</span><textarea rows={8} maxLength={12000} value={content} onChange={e=>setContent(e.target.value)}/></label>
   <label className="studio-field"><span>Genre target</span><select value={genreTarget} onChange={e=>setGenreTarget(e.target.value)}>{["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"].map(g=><option key={g} value={g}>{g}</option>)}</select></label>
   <label className="studio-field"><span>Status akses konten</span><select value={accessTier} onChange={e=>setAccessTier(e.target.value)}>{["PUBLIC","PREMIUM","DRAFT"].map(g=><option key={g} value={g}>{g}</option>)}</select></label>
   {!selected&&<label className="studio-field"><span>Induk subbagian</span><select value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Subbagian tingkat utama</option>{top.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
   <div className="outline-actions"><button type="submit" className="primary-button" disabled={busy||!changed}>{selected?"Simpan revisi":"Tambah subbagian"}</button><button type="button" className="secondary-button" disabled={busy} onClick={reset}>Batal</button></div>
  </form>
  <details><summary>Arsip subbagian ({items.filter(s=>s.archivedAt).length})</summary>
   {items.filter(s=>s.archivedAt).map(s=><div key={s.id} className="outline-archived"><span>{s.title}</span><button type="button" className="secondary-button" disabled={busy} onClick={()=>void action(endpoint+"/"+s.id,"PATCH",{restore:true,expectedVersion:s.updatedAt})}>Pulihkan</button></div>)}
  </details>
 </section>;
}
