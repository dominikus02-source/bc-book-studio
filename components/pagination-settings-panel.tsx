"use client";
import {useCallback,useEffect,useState} from "react";
import {DEFAULT_PAGINATION,type PaginationSettings} from "../lib/book-pagination";

type Snapshot={settings:PaginationSettings;version:number;saved:boolean};
const options={
 chapterStart:[["recto","Mulai pada halaman ganjil"],["nextPage","Halaman berikutnya"]],
 chapterOpeningFolio:[["bottom","Bawah tengah"],["hidden","Sembunyikan nomor pembuka bab"],["outer","Sisi luar"]],
 normalFolioPosition:[["outer","Sisi luar (genap kiri, ganjil kanan)"],["center","Bawah tengah"],["top","Header sisi luar"]]
} as const;

export default function PaginationSettingsPanel({bookId}:{bookId:string}){
 const [expanded,setExpanded]=useState(false);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [value,setValue]=useState<PaginationSettings>(DEFAULT_PAGINATION);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const url="/api/books/"+encodeURIComponent(bookId)+"/pagination";
 const load=useCallback(async()=>{
  if(!bookId)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(url,{cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Gagal memuat pagination");
   setSnapshot(data);setValue(data.settings);
  }catch(e){setError(e instanceof Error?e.message:"Gagal memuat pagination");setSnapshot(null)}
  finally{setBusy(false)}
 },[bookId,url]);
 useEffect(()=>{if(expanded){void load()}else{setSnapshot(null);setError("");setNotice("")}},[expanded,load]);
 const dirty=!!snapshot&&JSON.stringify(value)!==JSON.stringify(snapshot.settings);
 function set<K extends keyof PaginationSettings>(key:K,next:PaginationSettings[K]){
  setValue(prev=>({...prev,[key]:next}));setNotice("");
 }
 async function save(method:"PATCH"|"DELETE"){
  if(!snapshot||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(method==="PATCH"?{body:JSON.stringify({expectedVersion:snapshot.version,settings:value})}:{})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Gagal menyimpan pengaturan");
   setSnapshot(data);setValue(data.settings);setNotice(method==="PATCH"?"Perubahan pagination tersimpan di database.":"Pengaturan default dipulihkan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan")}
  finally{setBusy(false)}
 }
 return <section className="panel" aria-label="Pengaturan pagination buku">
  <details open={expanded} onToggle={e=>{const open=e.currentTarget.open;if(open!==expanded)setExpanded(open)}}>
   <summary style={{cursor:"pointer",fontWeight:700,fontSize:"1.05rem"}}>Penomoran halaman buku — Pagination <span style={{fontWeight:400,fontSize:".85rem"}}>{expanded?"(tutup)":"(buka pengaturan)"}</span></summary>
   <div style={{display:"grid",gap:16,paddingBlock:16}}>
    <p className="panel-desc">Pengaturan editorial khusus buku aktif. Cover tanpa nomor, pendahuluan Romawi kecil, isi utama dimulai dari 1, dan bagian akhir meneruskan penomoran. Digunakan oleh tahap Tata Letak dan Penerbitan.</p>
    {!bookId?<p role="alert">Pilih buku aktif terlebih dahulu.</p>:<>
     <div role="status" aria-live="polite">{busy?"Memproses…":notice}</div>
     {error&&<p role="alert">{error}{error.includes("Konflik")&&<button type="button" className="secondary-button" onClick={()=>void load()}>Muat versi terbaru</button>}</p>}
     <fieldset disabled={busy||!snapshot} style={{display:"grid",gap:16,minWidth:0,border:"1px solid var(--border, #aaa)",borderRadius:12,padding:"clamp(12px, 3vw, 22px)"}}>
      <legend>Pengaturan buku aktif</legend>
      {Object.entries(options).map(([key,choices])=><label className="studio-field" key={key}>
       <span>{key==="chapterStart"?"Awal bab":key==="chapterOpeningFolio"?"Nomor pada pembuka bab":"Posisi nomor halaman"}</span>
       <select value={value[key as keyof typeof options]} onChange={e=>set(key as keyof typeof options,e.target.value as never)}>
        {choices.map(([v,label])=><option key={v} value={v}>{label}</option>)}
       </select>
      </label>)}
      {([["runningHeaders","Header berjalan berselang-seling"],["autoUpdateToc","Perbarui daftar isi otomatis"]] as const).map(([key,label])=><label key={key} style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={value[key]} onChange={e=>set(key,e.target.checked)}/><span>{label}</span></label>)}
      <p className="panel-desc">Cover: tanpa folio · Pendahuluan: i, ii, iii · Bab utama: 1, 2, 3 · Bagian akhir: melanjutkan angka.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
       <button className="primary-button" type="button" disabled={!dirty||busy} onClick={()=>void save("PATCH")}>Simpan perubahan</button>
       <button className="secondary-button" type="button" disabled={busy} onClick={()=>void load()}>Muat ulang</button>
       <button className="secondary-button" type="button" disabled={busy||!snapshot?.saved} onClick={()=>{if(window.confirm("Pulihkan pagination default untuk buku ini?"))void save("DELETE")}}>Reset default</button>
      </div>
      {dirty&&<p role="status">Ada perubahan yang belum disimpan.</p>}
     </fieldset>
    </>}
   </div>
  </details>
 </section>;
}
