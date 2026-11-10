"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {PublishingPackage} from "../lib/publishing-package";
import {publishingFields} from "../lib/publishing-package";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";
const labels:Record<keyof PublishingPackage,string>={
 frontCover:"Sampul depan",titlePage:"Halaman judul",copyrightPage:"Halaman identitas dan hak cipta",
 preface:"Kata pengantar",contentsIntro:"Daftar isi",readerGuide:"Petunjuk pembaca",
 afterword:"Penutup",glossary:"Glosarium",references:"Referensi dan sumber",
 bibliography:"Daftar pustaka dan bibliografi",backCover:"Sampul belakang"
};
const hints:Partial<Record<keyof PublishingPackage,string>>={
 frontCover:"Gunakan judul, subjek dan penulis Stage 1. Jangan mencantumkan ISBN yang belum terbit.",
 copyrightPage:"Identitas penerbit, ISBN, hak cipta dan lisensi wajib berasal dari bukti resmi.",
 preface:"Ringkas tujuan penulisan dan sasaran pembaca yang berasal dari Stage 1.",
 contentsIntro:"Judul bab Stage 2/3; nomor halaman sesungguhnya ditentukan oleh renderer.",
 glossary:"Gunakan hanya istilah dan definisi yang benar-benar muncul pada buku dan telah diperiksa.",
 references:"Isi sumber yang benar-benar dipakai, dengan data bibliografis yang dapat dilacak.",
 bibliography:"Gunakan daftar pustaka konsisten berdasarkan sitasi nyata; jangan membuat sumber fiktif.",
 backCover:"Ringkasan isi tanpa mengulang prompt internal atau mengarang klaim penjualan."
};
const transferFields:TransferField[]=publishingFields.map(key=>({key,label:labels[key],hint:hints[key]||"Dapat disunting manual atau diimpor sesuai field_id.",maxLength:12000}));
type SourceResult={snapshotComplete?:boolean;snapshotId?:string|null;data:PublishingPackage;defaults:PublishingPackage;saved:boolean;missingFields:string[];updatedAt:string|null;sourceUpdatedAt:string;sourceChapters:{title:string;outlineObjective:string}[];status:string};
const pathFor=(id:string)=>"/api/books/"+encodeURIComponent(id)+"/publishing-package";
export default function PublishingPackageEditor({bookId,canEdit}:{bookId:string;canEdit:boolean}){
 const [value,setValue]=useState<PublishingPackage|null>(null),[source,setSource]=useState<SourceResult|null>(null);
 const [loaded,setLoaded]=useState(false),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[aiBusy,setAiBusy]=useState(false);
 const [aiField,setAiField]=useState<keyof PublishingPackage>("preface");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const revision=useRef(0),savedVersion=useRef<string|null>(null),inflight=useRef(false),current=useRef<PublishingPackage|null>(null);
 const path=pathFor(bookId);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setLoaded(false);setValue(null);setSource(null);setError("");setDirty(false);
  revision.current=0;savedVersion.current=null;current.current=null;
  void fetch(path,{cache:"no-store",signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||"Gagal membuka paket penerbitan.");return body as SourceResult}).then(body=>{
   if(!active)return;
   current.current=body.data;setValue(body.data);setSource(body);savedVersion.current=body.updatedAt;setLoaded(true);
   if(body.saved&&body.missingFields?.length&&canEdit){revision.current++;setDirty(true);setNotice("Isian baru dari Stage 1–3 telah ditambahkan tanpa menimpa isian lama. Menyimpan otomatis…");}
   else if(body.saved){setNotice("Paket penerbitan dimuat dari database. Perubahan berikutnya akan tersimpan otomatis.");}
   else if(canEdit){revision.current++;setDirty(true);setNotice("Isi dari Stage 1–3 dibuat otomatis. Menyimpan draf awal ke database…");}
   else setNotice("Pratinjau otomatis dari Stage 1–3; Anda hanya memiliki akses baca.");
  }).catch(e=>{if(active&&e.name!=="AbortError"){setLoaded(false);setError(e.message)}});
  return()=>{active=false;controller.abort()};
 },[bookId,path,canEdit]);
 const apply=useCallback((changes:Partial<PublishingPackage>,message?:string)=>{
  if(!canEdit)return;
  const previous=current.current;if(!previous)return;
  const next={...previous,...changes};
  current.current=next;revision.current++;setValue(next);setDirty(true);setError("");
  setNotice(message||"Perubahan diterapkan. Autosave akan menyimpan seluruh isian.");
 },[canEdit]);
 const save=useCallback(async()=>{
  if(!canEdit||!current.current||!loaded||inflight.current)return;
  inflight.current=true;setSaving(true);setError("");
  const valueAtSave=current.current,revisionAtSave=revision.current;
  try{
   const response=await fetch(path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:valueAtSave,expectedVersion:savedVersion.current,sourceUpdatedAt:source?.sourceUpdatedAt})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||"Gagal menyimpan paket penerbitan.");
   if(typeof body.updatedAt!=="string")throw Error("Server tidak mengembalikan versi penyimpanan.");
   savedVersion.current=body.updatedAt;
   if(revision.current===revisionAtSave){setDirty(false);setNotice("Semua isian tersimpan otomatis ke database.");}
   else setNotice("Perubahan terbaru masih dalam antrean penyimpanan.");
  }catch(e){setError((e instanceof Error?e.message:"Gagal menyimpan")+" Isian tetap ada; jangan meninggalkan halaman sebelum berhasil.");}
  finally{inflight.current=false;setSaving(false)}
 },[canEdit,loaded,path,source?.sourceUpdatedAt]);
 useEffect(()=>{
  if(!loaded||!dirty||!value||!canEdit||saving||error)return;
  const timer=setTimeout(()=>void save(),700);
  return()=>clearTimeout(timer);
 },[value,loaded,dirty,canEdit,saving,save,error]);
 useEffect(()=>{
  if(!dirty)return;
  const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};
  window.addEventListener("beforeunload",handler);
  return()=>window.removeEventListener("beforeunload",handler);
 },[dirty]);
 function regenerate(mode:"missing"|"all"){
  if(!source||!value||!canEdit)return;
  if(mode==="all"&&!window.confirm("Ganti seluruh isian penerbitan dengan konten otomatis terbaru dari Stage 1–3? Isian manual yang ada akan ditimpa."))return;
  const changes=Object.fromEntries(publishingFields.filter(key=>mode==="all"||!value[key].trim()).map(key=>[key,source.defaults[key]])) as Partial<PublishingPackage>;
  if(Object.keys(changes).length)apply(changes,"Isian diselaraskan dengan Stage 1–3. Penyimpanan otomatis aktif.");
  else setNotice("Semua isian sudah terisi. Pilih Ganti dari Stage 1–3 jika ingin menggantinya.");
 }
 const aiFields:(keyof PublishingPackage)[]=["preface","readerGuide","afterword","glossary","backCover","frontCover","titlePage","contentsIntro"];
 async function generateAI(){
  if(!canEdit||!value||aiBusy)return;
  if(value[aiField].trim()&&!window.confirm("Isi "+labels[aiField]+" sudah ada. Ganti bagian ini dengan draf AI berdasarkan Stage 1–3?"))return;
  setAiBusy(true);setError("");setNotice("Meminta draf "+labels[aiField]+" kepada penyedia AI yang sudah aktif…");
  try{
   const r=await fetch(path+"/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({field:aiField,current:value[aiField]})});
   const body=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(body.error||"Tidak berhasil menghasilkan isian AI.");
   if(body.field!==aiField||typeof body.draft!=="string"||body.draft.length<15||body.draft.length>12000)throw Error("Format respons model tidak cocok dengan isian.");
   apply({[aiField]:body.draft},"Draf AI dari "+String(body.provider?.name||"model aktif")+" dimasukkan. Autosave aktif; hasil tetap perlu ditinjau.");
  }catch(e){setError(e instanceof Error?e.message:"Pembuatan draf AI gagal.")}
  finally{setAiBusy(false)}
 }
 function importRecords(result:TransferRecord){
  const updates=Object.fromEntries(publishingFields.filter(k=>typeof result[k]==="string").map(k=>[k,result[k]])) as Partial<PublishingPackage>;
  apply(updates,Object.keys(updates).length+" isian dari XLSX/Markdown sudah dipetakan. Penyimpanan otomatis berjalan.");
 }
 const context=source&&value?[
  "TAHAP: Penerbitan / susunan buku; gunakan EYD dan struktur penerbitan Republik Indonesia.",
  "Judul: "+source.defaults.titlePage.slice(0,300),
  "Metadata dan pembaca: "+source.defaults.readerGuide.slice(0,900),
  "Daftar bab dari Stage 2/3: "+source.sourceChapters.map((c,i)=>`${i+1}. ${c.title} — ${c.outlineObjective||"tujuan belum diisi"}`).join("; ").slice(0,2400),
  "Status buku: "+source.status+"; sumber ISBN, pustaka dan hak cipta tidak boleh direka.",
  "KELUARAN: sampul depan, halaman judul, identitas hak cipta, kata pengantar, daftar isi, petunjuk pembaca, penutup, glosarium, referensi, bibliografi, sampul belakang. Pertahankan field_id, jangan ubah naskah bab.",
  "Hasil AI harus berupa Markdown sesuai field_id untuk diunggah kembali. Form dipetakan dan disimpan otomatis setelah impor."
 ].join("\n"):"";
 if(!canEdit)return <section className="panel publishing-package-panel" aria-label="Paket penerbitan otomatis dan impor"><h4>Bagian awal dan akhir buku</h4><p className="form-hint">Akses baca. Perubahan editorial memerlukan revisi draf dan review ulang.</p>{error&&<p role="alert">{error}</p>}<p role="status">{loaded?"Paket penerbitan dimuat dari database. "+(source?.status==="APPROVED"?source.snapshotComplete?"Sumber: snapshot persetujuan "+source.snapshotId+".":"Snapshot lama belum lengkap. Pilih Buat revisi baru dan ajukan review ulang.":"Paket ini termasuk materi yang harus ditinjau."):"Memuat paket penerbitan..."}</p>{value&&publishingFields.map((key,i)=><details key={key}><summary>{i+1}. {labels[key]}</summary><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{value[key]||"Belum diisi."}</p></details>)}</section>;
 return <section className="panel publishing-package-panel" aria-label="Paket penerbitan otomatis dan impor">
  <h4>Paket penerbitan — dari Stage 1, 2, dan 3</h4>
  <p className="form-hint">Sistem mengisi draf bagian awal dan akhir buku dari metadata serta struktur bab. Anda tetap dapat menyunting setiap isian secara manual, menggunakan prompt AI kontekstual, atau mengunggah XLSX dan Markdown. Setiap perubahan disimpan otomatis tanpa menekan tombol Simpan.</p>
  {!loaded&&!error&&<p role="status">Memuat data penerbitan…</p>}
  {value&&source&&<>
   <div className="ai-prompt-actions">
    <button type="button" className="secondary-button" disabled={!canEdit||saving} onClick={()=>regenerate("missing")}>Lengkapi isian kosong dari Stage 1–3</button>
    <button type="button" className="secondary-button" disabled={!canEdit||saving} onClick={()=>regenerate("all")}>Buat ulang seluruh isian dari Stage 1–3</button>
   </div>
   <div className="publisher-ai-generator">
    <strong>Generate AI langsung berdasarkan konteks buku</strong>
    <p className="form-hint">Menggunakan model AI yang sudah diaktifkan pengelola. Hanya isian yang dipilih dikirim untuk diproses. Hasil AI mengganti isian tersebut dan tersimpan otomatis setelah berhasil; jangan gunakan untuk menerbitkan ISBN atau memverifikasi sumber. Kuota harian AI berlaku.</p>
    <div className="ai-prompt-actions">
     <label className="studio-field"><span>Bagian yang ingin dibuat AI</span><select value={aiField} disabled={!canEdit||aiBusy} onChange={e=>setAiField(e.target.value as keyof PublishingPackage)}>{aiFields.map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label>
     <button type="button" className="primary-button" disabled={!canEdit||aiBusy||saving} onClick={()=>void generateAI()}>{aiBusy?"Menghasilkan draf AI…":"Buat isian dengan AI"}</button>
    </div>
   </div>
   <FormTransfer key={"publishing-transfer-"+bookId} name="Paket penerbitan" bookId={bookId} fields={transferFields} values={value} aiContext={context} autoApply disabled={!canEdit||saving} onApply={importRecords} autoApplyNotice="XLSX/Markdown telah dipetakan berdasarkan field_id. Perubahan sedang disimpan otomatis; tunggu indikator Tersimpan."/>
   <div className="publishing-fields">
    {publishingFields.map((key,i)=><details key={key} className="stage-advanced-tools" open={i===0}>
     <summary>{i+1}. {labels[key]} {value[key].trim()?"— terisi":"— belum lengkap"}</summary>
     <label className="studio-field"><span>{labels[key]} (Markdown atau teks)</span><textarea aria-label={labels[key]} rows={key==="copyrightPage"||key==="bibliography"?7:5} value={value[key]} disabled={!canEdit} maxLength={12000} onChange={e=>apply({[key]:e.target.value})}/></label>
     <p className="form-hint">{hints[key]||"Selaraskan isi dengan konteks buku dan tahap sebelumnya. Pemeriksaan final tetap diperlukan."}</p>
    </details>)}
   </div>
  </>}
  {error&&<p role="alert">{error} <button type="button" className="secondary-button" disabled={saving} onClick={()=>{setError("");void save()}}>Coba simpan lagi</button></p>}
  <p role="status" aria-live="polite">{saving?"Menyimpan ke database…":dirty?"Perubahan belum tersimpan. "+notice:notice||"Tersimpan."}</p>
  <button type="button" className="secondary-button" disabled={!canEdit||saving||!loaded||!dirty} onClick={()=>void save()}>{saving?"Menyimpan…":"Simpan sekarang"}</button>
  <p className="form-hint">Catatan: paket ini masih DRAF. Bukti ISBN Perpusnas, lisensi, sitasi, sertifikasi format, dan distribusi membutuhkan verifikasi independen; sistem tidak akan menandainya sebagai sah secara otomatis.</p>
 </section>;
}
