"use client";
import {useCallback,useEffect,useState} from "react";
import {DEFAULT_PAGINATION,type PaginationSettings} from "../lib/book-pagination";

type Snapshot={settings:PaginationSettings;version:number;saved:boolean;history?:{version:number;action:string;createdAt:string}[]};
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
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!bookId)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(url,{cache:"no-store",signal});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Gagal memuat pagination");
   if(!signal?.aborted){setSnapshot(data);setValue(data.settings);}
  }catch(e){if(!signal?.aborted){setError(e instanceof Error?e.message:"Gagal memuat pagination");setSnapshot(null)}}
  finally{if(!signal?.aborted)setBusy(false)}
 },[bookId,url]);
 useEffect(()=>{const controller=new AbortController();if(expanded){void load(controller.signal)}else{setSnapshot(null);setError("");setNotice("")}return()=>controller.abort()},[expanded,load]);
 const dirty=!!snapshot&&JSON.stringify(value)!==JSON.stringify(snapshot.settings);
 function set<K extends keyof PaginationSettings>(key:K,next:PaginationSettings[K]){
  setValue(prev=>({...prev,[key]:next}));setNotice("");
 }
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty]);
 function reload(){if(!dirty||confirm("Buang perubahan pagination lokal dan muat versi server?"))void load()}
 async function save(method:"PATCH"|"DELETE",restoreVersion?:number){
  if(!snapshot||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:snapshot.version,...(method==="PATCH"?(restoreVersion?{restoreVersion}:{settings:value}):{})})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Gagal menyimpan pengaturan");
   await load();setNotice(restoreVersion?"Pagination lama dipulihkan sebagai versi baru.":method==="PATCH"?"Perubahan pagination tersimpan di database.":"Pengaturan default dipulihkan tanpa menghapus riwayat.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan")}
  finally{setBusy(false)}
 }
 return <section className="panel" aria-label="Pengaturan pagination buku">
  <details open={expanded} onToggle={e=>{const open=e.currentTarget.open;if(!open&&dirty&&!confirm("Tutup pengaturan dan buang perubahan yang belum disimpan?")){e.currentTarget.open=true;return}if(open!==expanded)setExpanded(open)}}>
   <summary style={{cursor:"pointer",fontWeight:700,fontSize:"1.05rem"}}>Penomoran halaman buku — Pagination <span style={{fontWeight:400,fontSize:".85rem"}}>{expanded?"(tutup)":"(buka pengaturan)"}</span></summary>
   <div style={{display:"grid",gap:16,paddingBlock:16}}>
    <p className="panel-desc">Pengaturan editorial khusus buku aktif. Cover tanpa nomor, pendahuluan Romawi kecil, isi utama dimulai dari 1, dan bagian akhir meneruskan penomoran. Digunakan oleh tahap Tata Letak dan Penerbitan.</p>
    {!bookId?<p role="alert">Pilih buku aktif terlebih dahulu.</p>:<>
     <div role="status" aria-live="polite">{busy?"Memproses…":notice}</div>
     {error&&<p role="alert">{error}{error.includes("Konflik")&&<button type="button" className="secondary-button" onClick={reload}>Muat versi terbaru</button>}</p>}
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
       <button className="secondary-button" type="button" disabled={busy} onClick={reload}>Muat ulang</button>
       <button className="secondary-button" type="button" disabled={busy||!snapshot?.saved} onClick={()=>{if(window.confirm("Pulihkan pagination default untuk buku ini?"))void save("DELETE")}}>Reset default</button>
      </div>
      {dirty&&<p role="status">Ada perubahan yang belum disimpan. Pratinjau di bawah ini menampilkan rancangan, belum hasil simpan.</p>}
     </fieldset>
     <details><summary>Riwayat pagination</summary>{snapshot?.history?.length?snapshot.history.map(h=><p key={h.version}>Versi {h.version} · {h.action} <button type="button" className="secondary-button" aria-label={"Pulihkan pagination versi "+h.version} disabled={busy||dirty||h.version===snapshot.version} onClick={()=>{if(confirm("Pulihkan pagination versi "+h.version+" sebagai versi baru?"))void save("PATCH",h.version)}}>Pulihkan</button></p>):<p>Riwayat akan dicatat saat menyimpan.</p>}</details>
     <PaginationLivePreview value={value} dirty={dirty}/>
    </>}
   </div>
  </details>
 </section>;
}

function PaginationLivePreview({value,dirty}:{value:PaginationSettings;dirty:boolean}){
 const paper={background:"#fff",color:"#253044",border:"1px solid #cbd5e1",borderRadius:8,minHeight:218,aspectRatio:"3 / 4",padding:15,display:"flex",flexDirection:"column" as const,justifyContent:"space-between" as const,boxShadow:"0 3px 10px #00000014",minWidth:0};
 const folio=(number:string,mode:"center"|"outer"|"top",odd:boolean)=>(
  <div style={{width:"100%",display:"flex",justifyContent:mode==="center"?"center":odd?"flex-end":"flex-start",fontSize:11}}>{number}</div>
 );
 const header=(odd:boolean)=><div style={{minHeight:18,fontSize:10,textAlign:odd?"right":"left" as const,borderBottom:"1px solid #e2e8f0"}}>{value.runningHeaders?(odd?"JUDUL BUKU":"BAB 1 • PENDAHULUAN"):""}</div>;
 return <section aria-label="Pratinjau langsung pagination" style={{display:"grid",gap:12}}>
  <div><h3 style={{margin:0}}>Pratinjau langsung</h3><p className="panel-desc" aria-live="polite">Setiap pilihan langsung mengubah simulasi halaman. {dirty?"Belum disimpan; klik Simpan perubahan untuk menerapkan ke buku.":"Sesuai konfigurasi yang dimuat."}</p></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,155px),1fr))",gap:12}}>
   <div><small>Sampul</small><div style={paper}><div/><div style={{textAlign:"center"}}><strong>JUDUL BUKU</strong><p>Nama Penulis</p></div><div style={{textAlign:"center",fontSize:10}}>Penerbit</div></div><small>Tanpa nomor halaman</small></div>
   <div><small>Daftar isi</small><div style={paper}><div style={{fontSize:11}}><strong>DAFTAR ISI</strong><hr/><p>Prakata ........ i</p><p>Bab 1 ........ 1</p><p>Bab 2 ........ 13</p><small>{value.autoUpdateToc?"Daftar isi otomatis aktif":"Pembaruan daftar isi otomatis nonaktif"}</small></div>{folio("ii","center",false)}</div><small>Romawi kecil</small></div>
   {value.chapterStart==="recto"&&<div><small>Sisipan halaman genap</small><div style={paper}><div/><small style={{textAlign:"center",color:"#475569"}}>Halaman kosong agar bab dimulai di kanan</small><div/></div><small>Aturan mulai bab: ganjil</small></div>}
   <div><small>Halaman pembuka bab</small><div style={paper}><div>{header(true)}<div style={{marginTop:33,textAlign:"center"}}><strong>BAB 1</strong><h4>Pendahuluan</h4><div style={{height:4,background:"#e2e8f0",margin:"20px 8px"}}/></div></div>{value.chapterOpeningFolio==="hidden"?<div style={{minHeight:14}}/>:folio("1",value.chapterOpeningFolio==="outer"?"outer":"center",true)}</div><small>{value.chapterOpeningFolio==="hidden"?"Folio disembunyikan, tetap dihitung":value.chapterOpeningFolio==="outer"?"Nomor di sisi luar":"Nomor bawah tengah"}</small></div>
   <div><small>Isi bab — halaman genap</small><div style={paper}><div>{header(false)}{value.normalFolioPosition==="top"&&folio("2","top",false)}<p style={{fontSize:11,lineHeight:1.65,marginTop:17}}>Materi bab dimulai di sini. Paragraf berikutnya mengikuti tata letak dan ukuran halaman buku.</p></div>{value.normalFolioPosition==="top"?<div/>:folio("2",value.normalFolioPosition==="outer"?"outer":"center",false)}</div><small>{value.normalFolioPosition==="center"?"Nomor tengah":value.normalFolioPosition==="outer"?"Genap kiri":"Nomor di header"}</small></div>
   <div><small>Isi bab — halaman ganjil</small><div style={paper}><div>{header(true)}{value.normalFolioPosition==="top"&&folio("3","top",true)}<p style={{fontSize:11,lineHeight:1.65,marginTop:17}}>Materi berlanjut. Posisi nomor mengikuti sisi luar pada halaman ganjil.</p></div>{value.normalFolioPosition==="top"?<div/>:folio("3",value.normalFolioPosition==="outer"?"outer":"center",true)}</div><small>{value.normalFolioPosition==="center"?"Nomor tengah":value.normalFolioPosition==="outer"?"Ganjil kanan":"Nomor di header"}</small></div>
  </div>
  <p className="panel-desc">Simulasi editorial, bukan render PDF final. Ekspor Stage 2 memakai pengaturan tersimpan melalui database; berkas yang sudah dibuat perlu digenerasi ulang setelah penyimpanan.</p>
 </section>;
}
