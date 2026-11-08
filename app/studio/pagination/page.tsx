"use client";
import {Suspense,useCallback,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {DEFAULT_PAGINATION,type PaginationSettings} from "../../../lib/book-pagination";

type RecordState={settings:PaginationSettings;version:number;saved:boolean};
const choices={
 chapterStart:[["recto","Mulai bab pada halaman ganjil"],["nextPage","Mulai pada halaman berikutnya"]],
 chapterOpeningFolio:[["bottom","Bawah tengah"],["hidden","Disembunyikan (tetap dihitung)"],["outer","Posisi luar"]],
 normalFolioPosition:[["outer","Sisi luar (genap kiri, ganjil kanan)"],["center","Bawah tengah"],["top","Header sisi luar"]],
} as const;
export default function Page(){return <Suspense fallback={<main>Memuat pengaturan penomoran…</main>}><PaginationPage/></Suspense>}
function PaginationPage(){
 const bookId=useSearchParams().get("bookId")||"";
 const [saved,setSaved]=useState<RecordState|null>(null);
 const [value,setValue]=useState<PaginationSettings>(DEFAULT_PAGINATION);
 const [busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const url="/api/books/"+encodeURIComponent(bookId)+"/pagination";
 const load=useCallback(async()=>{
  if(!bookId)return;
  setBusy(true);setError("");
  try{
   const res=await fetch(url,{cache:"no-store"});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||"Gagal memuat pengaturan");
   setSaved(data);setValue(data.settings);
  }catch(e){setError(e instanceof Error?e.message:"Gagal memuat")}
  finally{setBusy(false)}
 },[bookId,url]);
 useEffect(()=>{void load()},[load]);
 async function act(method:"PATCH"|"DELETE"){
  setBusy(true);setNotice("");setError("");
  try{
   const res=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(method==="PATCH"?{body:JSON.stringify({expectedVersion:saved?.version??0,settings:value})}:{})});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||"Gagal menyimpan");
   setSaved(data);setValue(data.settings??DEFAULT_PAGINATION);setNotice(method==="PATCH"?"Pengaturan tersimpan.":"Preset default dipulihkan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan")}
  finally{setBusy(false)}
 }
 if(!bookId)return <main><h1>Pengaturan penomoran halaman</h1><p>Buka dengan parameter bookId dari buku yang sedang diedit.</p></main>;
 const set=<K extends keyof PaginationSettings>(key:K,next:PaginationSettings[K])=>setValue(p=>({...p,[key]:next}));
 const dirty=JSON.stringify(value)!==JSON.stringify(saved?.settings);
 return <main style={{maxWidth:860,margin:"auto",padding:"2rem 1rem"}}>
  <h1>Penomoran Halaman Buku</h1>
  <p>Pengaturan editorial per buku. Cover tanpa nomor, front matter Romawi kecil, main matter dimulai 1, dan back matter melanjutkan angka.</p>
  <div role="status" aria-live="polite">{notice}{busy?" Memproses…":""}</div>
  {error&&<p role="alert">{error}</p>}
  <fieldset disabled={busy||!saved} style={{display:"grid",gap:18,border:"1px solid var(--border, #aaa)",padding:22,borderRadius:12}}>
   <legend>Professional Publisher — Pagination</legend>
   {Object.entries(choices).map(([key,options])=><label key={key} style={{display:"grid",gap:6}}>
     <strong>{key==="chapterStart"?"Mulai bab baru":key==="chapterOpeningFolio"?"Nomor pada pembuka bab":"Posisi nomor normal"}</strong>
     <select value={value[key as keyof typeof choices]} onChange={e=>set(key as keyof typeof choices,e.target.value as never)}>
      {options.map(([v,label])=><option key={v} value={v}>{label}</option>)}
     </select>
   </label>)}
   {([["runningHeaders","Running header bergantian kiri/kanan"],["autoUpdateToc","Perbarui daftar isi otomatis"]] as const).map(([key,label])=>
    <label key={key}><input type="checkbox" checked={value[key]} onChange={e=>set(key,e.target.checked)}/> {label}</label>)}
   <p>Front matter: <strong>i, ii, iii…</strong> · Main matter: <strong>1, 2, 3…</strong> · Back matter: <strong>lanjut angka</strong> · Cover: <strong>tanpa folio</strong>.</p>
   <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
    <button type="button" disabled={!dirty||busy} onClick={()=>void act("PATCH")}>Simpan perubahan</button>
    <button type="button" disabled={busy} onClick={()=>void load()}>Muat ulang</button>
    <button type="button" disabled={busy||!saved?.saved} onClick={()=>{if(confirm("Kembalikan ke default?"))void act("DELETE")}}>Reset ke default</button>
   </div>
  </fieldset>
 </main>;
}
