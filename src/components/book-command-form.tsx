"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, LockKeyhole } from "lucide-react";

const types = ["Buku pelajaran","Buku pendamping pembelajaran","Buku latihan dan evaluasi","Buku cerita anak","Buku sastra","Buku referensi","Buku umum"];
const audiences = ["TK","SD","SMP","SMA","Mahasiswa","Guru","Umum"];
const steps = ["Gagasan buku","Sasaran pembaca","Struktur buku","Pengaturan produksi","Ringkasan"];
const capabilities = [
  ["Ketua Editor AI","Membantu menyusun dan meninjau isi"],
  ["Riset sumber","Memeriksa sumber dan referensi"],
  ["Latihan dan evaluasi","Membuat rancangan latihan"],
  ["Ilustrasi","Menyusun gambar pendukung"],
  ["Pemeriksaan bahasa","Meninjau ejaan dan keterbacaan"],
  ["Pemeriksaan pedagogis","Meninjau kesesuaian pembelajaran"],
  ["Tata letak penerbitan","Menyiapkan rancangan halaman"],
] as const;
type State = { title:string; idea:string; purpose:string; type:string; audience:string; grade:string; chapters:string; length:string; style:string; depth:string; approach:string; curriculum:string };
const initial:State={title:"",idea:"",purpose:"",type:types[0],audience:"SMP",grade:"7",chapters:"8",length:"Sedang",style:"Komunikatif",depth:"Menengah",approach:"Kontekstual",curriculum:""};
const gradeRanges:Record<string,number[]>={SD:[1,2,3,4,5,6],SMP:[7,8,9],SMA:[10,11,12]};
function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}) {
 return <label className="studio-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
export default function BookCommandForm(){
 const [step,setStep]=useState(0);
 const [form,setForm]=useState<State>(initial);
 const [options,setOptions]=useState<string[]>([]);
 const [touched,setTouched]=useState(false);
 const update=(key:keyof State,value:string)=>setForm(prev=>({...prev,[key]:value}));
 const grades=gradeRanges[form.audience];
 const valid=step!==0 || (form.title.trim().length>=3 && form.idea.trim().length>=10 && form.purpose.trim().length>=10);
 const next=()=>{setTouched(true);if(valid){setStep(s=>Math.min(4,s+1));setTouched(false);}};
 return <div className="workspace-stack wizard">
  <div className="local-notice" role="status"><LockKeyhole size={17}/><span>Mode perancangan: belum tersedia sesi pengguna dan penyimpanan proyek yang aman. Pengaturan hanya tersimpan selama halaman ini terbuka; proyek belum dibuat.</span></div>
  <nav aria-label="Tahapan membuat buku" className="wizard-steps">{steps.map((name,index)=><button type="button" key={name} className={index===step?"wizard-step current":"wizard-step"} aria-current={index===step?"step":undefined} onClick={()=>{if(index<step){setStep(index);setTouched(false);}}} disabled={index>step}><span>{index+1}</span>{name}</button>)}</nav>
  <section className="panel wizard-panel">
   <div className="workspace-heading"><div><div className="eyebrow-dark">LANGKAH {step+1} DARI 5</div><h2>{steps[step]}</h2><p>{["Jelaskan buku yang ingin kamu buat.","Pilih siapa yang akan membaca buku ini.","Tentukan rancangan awal yang dapat diubah nanti.","Pilih bantuan yang ingin digunakan setelah layanan tersedia.","Periksa seluruh pilihan sebelum membuat proyek."][step]}</p></div></div>
   {step===0&&<div className="form-grid two">
    <Field label="Judul sementara" hint="Minimal 3 karakter."><input value={form.title} maxLength={180} onChange={e=>update("title",e.target.value)} placeholder="Contoh: Belajar Fisika dari Sekitar Kita"/></Field>
    <Field label="Jenis buku"><select value={form.type} onChange={e=>update("type",e.target.value)}>{types.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Gagasan atau deskripsi" hint="Minimal 10 karakter."><textarea rows={5} maxLength={2000} value={form.idea} onChange={e=>update("idea",e.target.value)} placeholder="Buku ini membahas..."/></Field>
    <Field label="Tujuan penulisan" hint="Minimal 10 karakter."><textarea rows={5} maxLength={2000} value={form.purpose} onChange={e=>update("purpose",e.target.value)} placeholder="Setelah membaca, pembaca diharapkan..."/></Field>
   </div>}
   {step===1&&<div className="form-grid two"><Field label="Sasaran pembaca"><select value={form.audience} onChange={e=>setForm(prev=>({...prev,audience:e.target.value,grade:gradeRanges[e.target.value]?.[0]?.toString()||""}))}>{audiences.map(x=><option key={x}>{x}</option>)}</select></Field>{grades&&<Field label="Kelas"><select value={form.grade} onChange={e=>update("grade",e.target.value)}>{grades.map(n=><option key={n} value={n}>Kelas {n}</option>)}</select></Field>}</div>}
   {step===2&&<div className="form-grid two">
    <Field label="Jumlah bab"><select value={form.chapters} onChange={e=>update("chapters",e.target.value)}>{["4","6","8","10","12","16"].map(x=><option key={x} value={x}>{x} bab</option>)}</select></Field>
    <Field label="Perkiraan panjang buku"><select value={form.length} onChange={e=>update("length",e.target.value)}>{["Ringkas","Sedang","Panjang"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Gaya bahasa"><select value={form.style} onChange={e=>update("style",e.target.value)}>{["Komunikatif","Akademik","Naratif","Praktis"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Kedalaman materi"><select value={form.depth} onChange={e=>update("depth",e.target.value)}>{["Dasar","Menengah","Mendalam"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Pendekatan pembelajaran"><select value={form.approach} onChange={e=>update("approach",e.target.value)}>{["Kontekstual","Berbasis proyek","Berbasis masalah","Tidak berlaku"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Kurikulum atau acuan (opsional)" hint="Belum diverifikasi kesesuaiannya."><input value={form.curriculum} maxLength={250} onChange={e=>update("curriculum",e.target.value)} placeholder="Contoh: Kurikulum Merdeka"/></Field>
   </div>}
   {step===3&&<div className="wizard-options">{capabilities.map(([name,description])=><label key={name} className="wizard-option"><input type="checkbox" checked={options.includes(name)} onChange={e=>setOptions(old=>e.target.checked?[...old,name]:old.filter(x=>x!==name))}/><span><strong>{name}</strong><small>{description}</small><small className="wizard-unavailable">Belum tersedia dalam alur proyek</small></span></label>)}</div>}
   {step===4&&<div className="wizard-summary">
    {([["Judul",form.title],["Jenis buku",form.type],["Gagasan",form.idea],["Tujuan",form.purpose],["Pembaca",form.audience+(grades?" · Kelas "+form.grade:"")],["Jumlah bab",form.chapters],["Panjang",form.length],["Gaya bahasa",form.style],["Kedalaman",form.depth],["Pendekatan",form.approach],["Kurikulum / acuan",form.curriculum||"Tidak ditentukan"],["Bantuan yang diinginkan",options.join(", ")||"Belum dipilih"]] as const).map(([label,value])=><div key={label}><strong>{label}</strong><span>{value}</span></div>)}
    <div className="local-notice"><CircleHelp size={16}/><span>Konfigurasi ini belum dikirim ke server. Pembuatan proyek akan diaktifkan setelah autentikasi, otorisasi, dan penyimpanan backend lulus pengujian.</span></div>
   </div>}
   {touched&&!valid&&<p className="wizard-error" role="alert"><AlertCircle size={16}/> Lengkapi judul (3 karakter), gagasan (10 karakter), dan tujuan (10 karakter) sebelum melanjutkan.</p>}
   <div className="wizard-actions"><button type="button" className="secondary-button" onClick={()=>{setStep(s=>Math.max(0,s-1));setTouched(false);}} disabled={step===0}><ArrowLeft size={15}/> Kembali</button>{step<4?<button type="button" className="primary-button" onClick={next}>Lanjutkan <ArrowRight size={15}/></button>:<button type="button" className="primary-button" disabled title="Menunggu autentikasi dan API penyimpanan proyek"><CheckCircle2 size={15}/> Buat Proyek Buku — Belum Tersedia</button>}</div>
  </section>
 </div>;
}
