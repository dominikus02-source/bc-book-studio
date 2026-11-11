"use client";
import {useEffect,useState} from "react";
import {formatActiveModel,useActiveAiModel} from "./use-active-ai-model";
const labels:Record<string,string>={membership_letter:"Pernyataan anggota ISBN",application_letter:"Permohonan ISBN",authenticity:"SPKK bermeterai",translation_permission:"Izin penerjemahan",transfer_letter:"Pengalihan penerbitan",public_domain_statement:"Keterangan domain publik",title_pages:"Halaman awal buku"};
export default function IsbnDossierEditor({applicationId,requirements,editable,bookId}:{applicationId:string;requirements:string[];editable:boolean;bookId:string}){
 const [kind,setKind]=useState("application_letter"),[text,setText]=useState(""),[saved,setSaved]=useState(""),[defaults,setDefaults]=useState(""),[version,setVersion]=useState<string|null>(null);
 const aiModel=useActiveAiModel();
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[proposal,setProposal]=useState<{text:string;proposalId:string;provider:string;model:string}|null>(null),[accepted,setAccepted]=useState<string|undefined>();
 const base="/api/publisher/isbn/"+applicationId+"/dossier",dirty=text!==saved;
 async function read(url:string,init?:RequestInit){const r=await fetch(url,{cache:"no-store",...init});const data=await r.json();if(!r.ok)throw Error(data.error||"Gagal memproses dokumen");return data}
 useEffect(()=>{let active=true;setBusy(true);setProposal(null);setAccepted(undefined);setError("");void read(base+"?kind="+kind).then(d=>{if(active){setText(d.text);setSaved(d.text);setDefaults(d.defaultText);setVersion(d.version)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[base,kind]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=""}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty]);
 // Debounced persistence: keep each document versioned in IsbnEvent and never overwrite a newer tab.
 useEffect(()=>{
  if(!dirty||!editable||busy)return;
  const snapshot=text,expectedVersion=version;
  const timer=window.setTimeout(()=>{
   setBusy(true);setError("");
   void read(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",kind,text:snapshot,version:expectedVersion,proposalId:accepted})})
    .then(d=>{setVersion(d.version);setSaved(snapshot);setAccepted(undefined);setNotice("Tersimpan otomatis di database.");})
    .catch(e=>setError(e instanceof Error?e.message:"Autosave gagal. Simpan ulang setelah memuat versi terbaru."))
    .finally(()=>setBusy(false));
  },900);
  return()=>window.clearTimeout(timer);
 },[base,kind,text,saved,version,dirty,editable,busy,accepted]);

 async function action(action:"save"|"archive"|"generate"){
  if(action==="archive"&&!window.confirm("Arsipkan draf tersimpan? Riwayat versi tetap tersedia."))return;
  setBusy(true);setError("");setNotice("");
  try{const d=await read(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,kind,text,version,proposalId:accepted})});
   if(action==="generate"){setProposal(d);setNotice("Usulan AI belum diterapkan. Bandingkan dan tinjau terlebih dahulu.")}
   else{setVersion(d.version);if(action==="archive"){setText(defaults);setSaved(defaults)}else setSaved(text);setAccepted(undefined);setNotice(action==="save"?"Draf tersimpan di database.":"Draf diarsipkan; templat default ditampilkan.")}
  }catch(e){setError(e instanceof Error?e.message:"Gagal")}finally{setBusy(false)}
 }
 async function download(mode:string,format?:string){
  setError("");setBusy(true);
  try{const r=await fetch(base+"?mode="+mode+"&kind="+kind+(format?"&format="+format:""));if(!r.ok){const d=await r.json();throw Error(d.error||"Unduhan gagal")}
   const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=mode==="draft"?"DRAF-"+kind+"."+format:mode==="templates"?"templat-isbn.zip":"berkas-isbn.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:"Unduhan gagal")}finally{setBusy(false)}
 }
 return <section aria-label="Penyusun dokumen ISBN">
 <h3>Siapkan dokumen pengajuan</h3><p>Templat mengambil metadata dan urutan bab buku ini. Lengkapi bagian bertanda kurung, lalu simpan dan unduh. Identitas legal, izin, tanda tangan dan meterai harus berasal dari pihak berwenang.</p>
 <div className="isbn-actions"><label className="isbn-field">Dokumen yang disunting<select value={kind} disabled={busy} onChange={e=>{if(!dirty||window.confirm("Ada perubahan belum tersimpan. Pindah dokumen?"))setKind(e.target.value)}}>{Object.entries(labels).filter(([k])=>k==="membership_letter"||requirements.includes(k)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="secondary-button" disabled={busy||!editable} onClick={()=>{if(!dirty||window.confirm("Ganti isian editor dengan templat default?")){setText(defaults);setAccepted(undefined);setNotice("Templat dimuat. Simpan untuk menerapkan.")}}}>Isi dari templat</button><button className="secondary-button" disabled={busy||!editable} onClick={()=>void action("generate")}>Bantu susun dengan AI</button></div>
 <p><small>AI menggunakan provider aktif di Pengaturan; isi editor dikirim saat tombol AI dipilih. Hasil tetap perlu ditinjau. Model aktif: {formatActiveModel(aiModel)}.</small></p>
 <label className="isbn-field"><span>Isi draf dokumen</span><textarea aria-label="Isi draf dokumen" rows={14} value={text} disabled={busy||!editable} onChange={e=>setText(e.target.value)}/></label>
 <p role="status">{busy?"Memproses…":dirty?"Ada perubahan belum disimpan":"Draf siap ditinjau"} {notice}</p>{error&&<p role="alert" className="isbn-error">{error}</p>}
 {proposal&&<div className="panel"><h4>Usulan AI · {proposal.provider} / {proposal.model}</h4><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{proposal.text}</pre><div className="isbn-actions"><button className="secondary-button" onClick={()=>{setText(proposal.text);setAccepted(proposal.proposalId);setProposal(null);setNotice("Usulan diterapkan ke editor. Simpan setelah ditinjau.")}}>Terapkan ke editor</button><button className="secondary-button" onClick={()=>setProposal(null)}>Abaikan usulan</button></div></div>}
 <div className="isbn-actions"><button className="primary-button" disabled={busy||!editable} onClick={()=>void action("save")}>Simpan draf dokumen</button><button className="secondary-button" disabled={busy||!editable||!version} onClick={()=>void action("archive")}>Arsipkan draf</button>{["pdf","docx"].map(f=><button key={f} className="secondary-button" disabled={busy||dirty} onClick={()=>void download("draft",f)}>Unduh {f.toUpperCase()}</button>)}</div>
 <div className="isbn-actions"><button className="secondary-button" disabled={busy||dirty} onClick={()=>void download("templates")}>Unduh ZIP templat</button><button className="primary-button" disabled={busy||dirty} onClick={()=>void download("package")}>Unduh ZIP berkas lengkap</button></div>
 <p>ZIP lengkap memakai PDF bukti yang sudah diunggah, deklarasi pemeriksaan, legalitas penerbit, dan persetujuan Review. ZIP templat selalu berstatus draf.</p>
 <details><summary>Naskah final dan meterai</summary><p>Siapkan PDF final dari tahap Tata Letak/Terbit, tambahkan watermark, lalu unggah sebagai naskah akhir. Akta, pengesahan badan hukum dan NIB diunggah melalui Profil & Legalitas.</p><p>Meterai fisik: tanda tangani dan pindai dokumen bermeterai. E-meterai: bubuhkan melalui penyedia resmi, lalu unggah PDF hasilnya tanpa mengubahnya. Aplikasi mencatat deklarasi dan checksum; keaslian e-meterai tidak diverifikasi otomatis.</p><a href={"/studio?bookId="+encodeURIComponent(bookId)+"&module=Tata+Letak"}>Buka Tata Letak buku ini</a><p><a href="https://isbn.perpusnas.go.id/landing_page/home" target="_blank" rel="noreferrer">Persyaratan resmi Perpusnas ↗</a></p></details>
 </section>;
}
