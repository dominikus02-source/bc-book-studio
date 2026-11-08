"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, FileText, Layers3, Sparkles, WandSparkles, ShieldCheck } from "lucide-react";
import FormTransfer, {type TransferField,type TransferRecord} from "./form-transfer";
const briefFields:TransferField[]=[
 {key:"title",label:"Judul sementara",maxLength:180},
 {key:"author",label:"Penulis / organisasi",maxLength:180},
 {key:"bookType",label:"Jenis buku",options:["FICTION","NONFICTION"]},
 {key:"genre",label:"Genre",options:["NOVEL","SHORT_STORY","ANTHOLOGY","POETRY","TEXTBOOK","REFERENCE","GUIDE","WORKBOOK"]},
 {key:"category",label:"Kategori buku",maxLength:120},
 {key:"purpose",label:"Tujuan buku",maxLength:1600,example:"Membantu siswa memahami konsep dan menerapkannya melalui proyek sederhana yang terukur."},
 {key:"problem",label:"Masalah pembaca",maxLength:1600,example:"Siswa masih kesulitan menghubungkan teori dengan masalah di sekitar mereka."},
 {key:"audience",label:"Pembaca sasaran",options:["TK","SD","SMP","SMA","Mahasiswa","Guru","Profesional","Umum"]},
 {key:"grade",label:"Kelas",options:Array.from({length:12},(_,i)=>String(i+1))},
 {key:"level",label:"Kemampuan awal",options:["Pemula","Dasar","Menengah","Lanjut","Beragam"]},
 {key:"curriculum",label:"Kurikulum / sumber",maxLength:1200},
 {key:"topics",label:"Topik dan cakupan",maxLength:2500,example:"Pengamatan, pengukuran, eksperimen aman, tabel data, dan penarikan kesimpulan."},
 {key:"chapters",label:"Jumlah bab",options:["Rekomendasikan otomatis","4 bab","6 bab","8 bab","10 bab","12 bab","16 bab"]},
 {key:"style",label:"Gaya penyajian",maxLength:120},
 {key:"exercises",label:"Latihan dan asesmen",type:"boolean"},
 {key:"visuals",label:"Ilustrasi dan visual",type:"boolean"},
 {key:"references",label:"Referensi",type:"boolean"},
 {key:"template",label:"Template layout",options:["sd","smp-sma","teacher","workbook","reference","literature","enrichment","minimal"]},
 {key:"pageSize",label:"Ukuran halaman",options:["A4","A5","B5"]},
 {key:"outputs",label:"Format keluaran (pisahkan dengan titik koma)",maxLength:250},
 {key:"mode",label:"Cara kerja agen",maxLength:120},
 {key:"budget",label:"Batas anggaran",options:["Tentukan estimasi dahulu","Hemat","Standar","Mendalam"]}
];


const templates = [
  { id:"sd", name:"Buku Pelajaran SD", description:"Warna cerah, ilustrasi, aktivitas, kotak konsep, dan latihan bertahap.", formats:"A4 · berwarna" },
  { id:"smp-sma", name:"Buku Pelajaran SMP/SMA", description:"Tata letak terstruktur, materi konseptual, contoh, diskusi, dan asesmen.", formats:"B5 · akademik modern" },
  { id:"teacher", name:"Panduan Guru", description:"Panduan pelaksanaan, tujuan, langkah pembelajaran, diferensiasi, dan refleksi.", formats:"A4 · profesional" },
  { id:"workbook", name:"Modul dan Buku Kerja", description:"Ruang jawaban, lembar aktivitas, latihan, dan evaluasi mandiri.", formats:"A4 · fungsional" },
  { id:"reference", name:"Buku Referensi", description:"Hierarki informasi, tabel, catatan, kutipan, dan daftar pustaka.", formats:"B5 · editorial" },
  { id:"literature", name:"Sastra dan Literasi", description:"Ruang baca lapang, tipografi editorial, ilustrasi, dan catatan apresiasi.", formats:"A5 · literer" },
  { id:"enrichment", name:"Buku Pengayaan", description:"Visual komunikatif, contoh kontekstual, dan bacaan pendalaman.", formats:"A5 · populer" },
  { id:"minimal", name:"Minimalis Modern", description:"Tampilan bersih, tipografi kuat, ruang putih, dan aksen seperlunya.", formats:"A5 · minimal" }
];

const categories = ["Buku pelajaran","Panduan guru","Buku pengayaan","Buku referensi","Tata bahasa","Sastra dan literasi","Persiapan UKBI/TKA","Komunikasi dan keterampilan","Buku umum"];
const audiences = ["TK","SD","SMP","SMA","Mahasiswa","Guru","Profesional","Umum"];
const styles = ["Komunikatif dan kontekstual","Akademik dan mendalam","Populer dan ringan","Naratif dan bercerita","Instruksional dan praktis"];
const outputOptions = ["DOCX (dapat disunting)","PDF (digital/cetak)","EPUB (buku digital)","HTML (web)"];

function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}) {
 return <label className="studio-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}

export default function BookCommandForm({onCreated}:{onCreated:(book: {id:string;title:string;subject:string;grade:string;description:string;author?:string;pageSize?:string;bookType?:string;genre?:string})=>void}) {
 const [ideaDrafts,setIdeaDrafts]=useState<Array<{id:string;title:string;payload:TransferRecord}>>([]);
 const [ideaId,setIdeaId]=useState("");
 const [ideaError,setIdeaError]=useState("");
 const [autoIdea,setAutoIdea]=useState<{id:string;title:string;payload:TransferRecord}|null>(null);
 useEffect(()=>{let mounted=true;fetch("/api/form-drafts?module=Idea%20Lab",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("Gagal memuat draf Idea Lab");return r.json()}).then(data=>{if(mounted){setIdeaDrafts(data.drafts||[]);const pending=window.sessionStorage.getItem("bcstudio-idea-next");if(pending&&(data.drafts||[]).some((d:{id:string})=>d.id===pending)){setIdeaId(pending);window.sessionStorage.removeItem("bcstudio-idea-next");setAutoIdea(data.drafts.find((d:{id:string})=>d.id===pending));}}}).catch(e=>{if(mounted)setIdeaError(String(e.message))});return()=>{mounted=false}},[]);
 function applyIdea(source?:{id:string;title:string;payload:TransferRecord}){
  const draft=source||ideaDrafts.find(x=>x.id===ideaId);if(!draft)return;
  const v=draft.payload;
  const sourceTitle=String(v.bookTitle||draft.title).trim();
  const sourceProblem=String(v.idea||"").trim();
  const sourceBrief=String(v.localBrief||"").trim();
  setTitle(sourceTitle.slice(0,180));setCategory(String(v.category||"Buku pelajaran"));
  setAudience(String(v.audience||"SMP"));setGrade(String(v.grade||"7"));
  setProblem(sourceProblem.slice(0,1600));
  setPurpose(("Membantu "+String(v.audience||"siswa").toLowerCase()+" kelas "+String(v.grade||"7")+" memahami dan menerapkan konsep dalam "+sourceTitle+" melalui aktivitas kontekstual, eksperimen aman, dan asesmen bertahap.").slice(0,1600));
  setTopics((sourceBrief||sourceProblem).slice(0,2500));
  setBookType("NONFICTION");setGenre("TEXTBOOK");setTemplate("smp-sma");
  setPrompt("");setConfirmed(false);setIdeaError("");setImportPendingPrompt(true);
 }
 const [saving,setSaving]=useState(false); const [saveError,setSaveError]=useState("");
 async function saveBrief(){setSaving(true);setSaveError("");try{const r=await fetch("/api/books",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title.trim()||topics.trim().slice(0,180),grade:["SD","SMP","SMA"].includes(audience)?grade:"Referensi",subject:category,description:generatedPrompt,bookType,genre,pageSize,author:author.trim()||"BC Book Studio"})});const d=await r.json();if(!r.ok)throw Error(d.error||"Gagal menyimpan");setConfirmed(true);onCreated(d.book);}catch(e){setSaveError(e instanceof Error?e.message:"Gagal menyimpan")}finally{setSaving(false)}}
 const [title,setTitle]=useState("");
 const [category,setCategory]=useState("Buku pelajaran");
 const [bookType,setBookType]=useState<"FICTION"|"NONFICTION">("NONFICTION");
 const [author,setAuthor]=useState("");
 const [genre,setGenre]=useState("TEXTBOOK");
 const fictionGenres=[["NOVEL","Novel"],["SHORT_STORY","Cerita pendek"],["ANTHOLOGY","Antologi"],["POETRY","Puisi"]];
 const nonfictionGenres=[["TEXTBOOK","Buku ajar"],["REFERENCE","Referensi"],["GUIDE","Panduan"],["WORKBOOK","Modul dan buku kerja"]];
 const [purpose,setPurpose]=useState("");
 const [problem,setProblem]=useState("");
 const [audience,setAudience]=useState("SMP");
 const [grade,setGrade]=useState("7");
 const [level,setLevel]=useState("Menengah");
 const [topics,setTopics]=useState("");
 const [chapters,setChapters]=useState("Rekomendasikan otomatis");
 const [style,setStyle]=useState(styles[0]);
 const [exercises,setExercises]=useState(true);
 const [visuals,setVisuals]=useState(true);
 const [references,setReferences]=useState(true);
 const [curriculum,setCurriculum]=useState("");
 const [template,setTemplate]=useState("smp-sma");
 const [templateExpanded,setTemplateExpanded]=useState(false);
 const [advancedOpen,setAdvancedOpen]=useState(false);
 const [templateFullscreen,setTemplateFullscreen]=useState(false);
 const [pageSize,setPageSize]=useState("B5");
 const [outputs,setOutputs]=useState<string[]>(["DOCX (dapat disunting)","PDF (digital/cetak)"]);
 const [mode,setMode]=useState("Otomatis dengan persetujuan pada gerbang penting");
 const [budget,setBudget]=useState("Tentukan estimasi dahulu");
 const [prompt,setPrompt]=useState("");
 const [importPendingPrompt,setImportPendingPrompt]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 useEffect(()=>{if(autoIdea){applyIdea(autoIdea);setAutoIdea(null)}},[autoIdea]);

 const transferValues:TransferRecord={title,author,bookType,genre,category,purpose,problem,audience,grade,level,curriculum,topics,chapters,style,exercises,visuals,references,template,pageSize,outputs:outputs.join("; "),mode,budget};
 function applyTransfer(v:TransferRecord){
  const str=(key:string)=>typeof v[key]==="string"?String(v[key]):undefined;
  if(str("title")!==undefined)setTitle(str("title")!);
  if(str("author")!==undefined)setAuthor(str("author")!);
  if(str("bookType")!==undefined)setBookType(str("bookType") as "FICTION"|"NONFICTION");
  if(str("genre")!==undefined)setGenre(str("genre")!);
  if(str("category")!==undefined)setCategory(str("category")!);
  if(str("purpose")!==undefined)setPurpose(str("purpose")!);
  if(str("problem")!==undefined)setProblem(str("problem")!);
  if(str("audience")!==undefined)setAudience(str("audience")!);
  if(str("grade")!==undefined)setGrade(str("grade")!);
  if(str("level")!==undefined)setLevel(str("level")!);
  if(str("curriculum")!==undefined)setCurriculum(str("curriculum")!);
  if(str("topics")!==undefined)setTopics(str("topics")!);
  if(str("chapters")!==undefined)setChapters(str("chapters")!);
  if(str("style")!==undefined)setStyle(str("style")!);
  if(typeof v.exercises==="boolean")setExercises(v.exercises);
  if(typeof v.visuals==="boolean")setVisuals(v.visuals);
  if(typeof v.references==="boolean")setReferences(v.references);
  if(str("template")!==undefined)setTemplate(str("template")!);
  if(str("pageSize")!==undefined)setPageSize(str("pageSize")!);
  if(str("outputs")!==undefined)setOutputs(str("outputs")!.split(";").map(x=>x.trim()).filter(x=>outputOptions.includes(x)));
  if(str("mode")!==undefined)setMode(str("mode")!);
  if(str("budget")!==undefined)setBudget(str("budget")!);
  setPrompt("");setConfirmed(false);setImportPendingPrompt(true);
 }

 const selectedTemplate=templates.find(x=>x.id===template)!;
 const complete=Boolean(title.trim()||topics.trim()) && topics.trim().length>=5;
 const toggleOutput=(value:string)=>setOutputs(old=>old.includes(value)?old.filter(x=>x!==value):[...old,value]);
 const generatedPrompt=useMemo(()=>[
  "PERINTAH INDUK PRODUKSI BUKU BC BOOK STUDIO",
  "",
  "TUJUAN DAN IDENTITAS",
  `Judul sementara: ${title||"Usulkan judul berdasarkan tujuan"}`,
  `Kategori: ${category}`,
  `Tujuan buku: ${purpose||"[Belum diisi]"}`,
  `Masalah/kebutuhan pembaca: ${problem||"[Belum diisi]"}`,
  "",
  "PEMBACA SASARAN",
  `Pembaca: ${audience}`,
  `Kelas: ${audience==="SD"||audience==="SMP"||audience==="SMA"?grade:"Tidak berlaku"}`,
  `Kemampuan awal: ${level}`,
  "",
  "CAKUPAN DAN METODE",
  `Topik: ${topics||"[Belum diisi]"}`,
  `Jumlah bab: ${chapters}`,
  `Gaya penyajian: ${style}`,
  `Kurikulum/sumber wajib: ${curriculum||"Riset dan rekomendasikan sumber tepercaya; minta persetujuan untuk sumber utama."}`,
  `Latihan dan asesmen: ${exercises?"Ya":"Tidak"}`,
  `Ilustrasi/visual: ${visuals?"Ya":"Tidak"}`,
  `Referensi dan daftar pustaka: ${references?"Ya":"Sesuai kebutuhan dan wajib untuk klaim yang memerlukannya"}`,
  "",
  "SPESIFIKASI DOKUMEN",
  `Template: ${selectedTemplate.name} — ${selectedTemplate.description}`,
  `Ukuran halaman: ${pageSize}`,
  `Keluaran: ${outputs.join(", ")||"Belum dipilih"}`,
  "",
  "KENDALI PRODUKSI",
  `Mode: ${mode}`,
  `Anggaran: ${budget}`,
  "Rancang prompt tugas per tahap, pilih agen dan spesialisasi yang sesuai, catat sumber, lakukan pemeriksaan fakta, bahasa, pedagogi, hak cipta, dan tata letak. Simpan checkpoint dan versi setiap tahap.",
  "Jangan mengarang fakta, sumber, kutipan, ISBN, atau persetujuan resmi. Minta persetujuan manusia pada gerbang yang ditentukan dan sebelum penerbitan.",
  "",
  "URUTAN KERJA YANG DIMINTA",
  "Validasi brief → estimasi → riset → kerangka → persetujuan struktur → penulisan bab → latihan/visual → penyuntingan → telaah pedagogis → QA → layout → ekspor dokumen → persetujuan final."
 ].join("\n"),[title,category,bookType,genre,purpose,problem,audience,grade,level,topics,chapters,style,curriculum,exercises,visuals,references,selectedTemplate,pageSize,outputs,mode,budget]);
 useEffect(()=>{if(importPendingPrompt){if(complete)setPrompt(generatedPrompt);setImportPendingPrompt(false)}},[importPendingPrompt,generatedPrompt,complete]);

 return <div className="workspace-stack">
  <div className="local-notice"><ShieldCheck size={16}/><span>Formulir ini adalah pintu masuk utama produksi buku. Brief tersimpan sebagai deskripsi proyek di server setelah klik Simpan. Eksekusi agen tetap memerlukan orkestrator.</span></div>
  <section className="panel"><h3 className="panel-title">Lanjutkan dari Idea Lab</h3><p className="panel-desc">Pilih draf yang sebelumnya diunggah atau tersimpan otomatis. Sistem mengisi brief dan menyusun prompt induk dari gagasan tersebut; Anda tetap dapat mengeditnya sebelum membuat proyek.</p><div className="form-grid two"><Field label="Draf Idea Lab tersimpan"><select value={ideaId} onChange={e=>setIdeaId(e.target.value)}><option value="">Pilih gagasan sebelumnya</option>{ideaDrafts.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></Field><div style={{display:"flex",alignItems:"end"}}><button type="button" className="primary-button" disabled={!ideaId} onClick={()=>applyIdea()}>Gunakan gagasan &amp; isi prompt template</button></div></div>{ideaError&&<p role="alert">{ideaError}</p>}{ideaDrafts.length===0&&!ideaError&&<p className="panel-desc">Belum ada draf Idea Lab. Simpan gagasan terlebih dahulu atau impor melalui formulir di bawah.</p>}</section>
  {advancedOpen&&<FormTransfer name="Brief Buku" fields={briefFields} values={transferValues} onApply={applyTransfer} autoApply disabled={saving} hint="Unduh format untuk semua isian brief, edit di Excel atau Markdown, lalu impor sebagai nilai form. Periksa kembali sebelum menyimpan proyek." />}
  <div className="workspace-heading"><div><div className="eyebrow-dark">PERINTAH PRODUKSI TERPADU</div><h2>Satu brief, satu alur produksi buku</h2><p>Jelaskan hasil yang kamu inginkan. Sistem akan menyusun prompt induk dan menentukan alur agen yang tepat.</p></div><span className="status">Formulir utama</span></div>
  <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">01 · Tujuan dan kebutuhan buku</h3><p className="panel-desc">Bagian ini menentukan arah seluruh prompt produksi.</p></div><BookOpenCheck size={20} color="#5670b6"/></div>
   <div className="form-grid two">
    <Field label="Judul sementara"><input value={title} onChange={e=>{setTitle(e.target.value);setConfirmed(false)}} placeholder="Boleh dikosongkan, agen dapat mengusulkan judul"/></Field>
    <Field label="Nama penulis atau organisasi"><input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Penulis buku" maxLength={180}/></Field>
    <Field label="Jenis buku"><select value={bookType} onChange={e=>{const next=e.target.value as "FICTION"|"NONFICTION";setBookType(next);setGenre(next==="FICTION"?"NOVEL":"TEXTBOOK");setPageSize(next==="FICTION"?"A5":"B5")}}><option value="NONFICTION">Nonfiksi</option><option value="FICTION">Fiksi</option></select></Field>
    <Field label="Genre"><select value={genre} onChange={e=>setGenre(e.target.value)}>{(bookType==="FICTION"?fictionGenres:nonfictionGenres).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field>
    {advancedOpen&&<Field label="Kategori buku"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></Field>}
    <Field label="Apa tujuan utama buku ini?" hint="Jelaskan hasil yang ingin dicapai pembaca."><textarea rows={4} value={purpose} onChange={e=>{setPurpose(e.target.value);setConfirmed(false)}} placeholder="Contoh: Membantu siswa memahami teks argumentasi dan mampu menulis argumen yang didukung bukti..."/></Field>
    {advancedOpen&&<Field label="Masalah apa yang ingin diselesaikan?" hint="Semakin spesifik, semakin tepat rancangan isi dan prompt."><textarea rows={4} value={problem} onChange={e=>{setProblem(e.target.value);setConfirmed(false)}} placeholder="Contoh: Siswa sering menyampaikan pendapat tanpa alasan dan bukti yang relevan..."/></Field>}
   </div>
  </section>
  <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">02 · Pembaca dan tingkat kedalaman</h3><p className="panel-desc">Profil pembaca akan mengarahkan bahasa, contoh, visual, dan kompleksitas materi.</p></div><Layers3 size={20} color="#5670b6"/></div>
   <div className="form-grid two">
    <Field label="Pembaca sasaran"><select value={audience} onChange={e=>setAudience(e.target.value)}>{audiences.map(x=><option key={x}>{x}</option>)}</select></Field>
    {(audience==="SD"||audience==="SMP"||audience==="SMA")&&<Field label="Kelas"><select value={grade} onChange={e=>setGrade(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Kelas {i+1}</option>)}</select></Field>}
    {advancedOpen&&<Field label="Kemampuan awal pembaca"><select value={level} onChange={e=>setLevel(e.target.value)}>{["Pemula","Dasar","Menengah","Lanjut","Beragam"].map(x=><option key={x}>{x}</option>)}</select></Field>}
    {advancedOpen&&<Field label="Kurikulum atau sumber wajib"><input value={curriculum} onChange={e=>setCurriculum(e.target.value)} placeholder="Nama kurikulum, dokumen, atau sumber khusus"/></Field>}
   </div>
  </section>
  <section className="panel"><h3 className="panel-title">03 · Cakupan dan pendekatan isi</h3><div className="form-grid two">
   <Field label="Topik dan ruang lingkup" hint="Sebutkan topik utama, subtopik, atau batasan."><textarea rows={5} value={topics} onChange={e=>{setTopics(e.target.value);setConfirmed(false)}} placeholder="Topik utama, subtopik, contoh konteks, dan hal yang perlu dihindari..."/></Field>
   {advancedOpen&&<div><Field label="Jumlah bab"><select value={chapters} onChange={e=>setChapters(e.target.value)}>{["Rekomendasikan otomatis","4 bab","6 bab","8 bab","10 bab","12 bab","16 bab"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Gaya penyajian"><select value={style} onChange={e=>setStyle(e.target.value)}>{styles.map(x=><option key={x}>{x}</option>)}</select></Field></div>}
  </div>{advancedOpen&&<div className="toggle-grid">
   <label><input type="checkbox" checked={exercises} onChange={e=>setExercises(e.target.checked)}/> Latihan, soal, dan asesmen</label>
   <label><input type="checkbox" checked={visuals} onChange={e=>setVisuals(e.target.checked)}/> Ilustrasi dan infografik</label>
   <label><input type="checkbox" checked={references} onChange={e=>setReferences(e.target.checked)}/> Referensi dan daftar pustaka</label>
  </div>}</section>
  {advancedOpen&&<><section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">04 · Pilih templat layout buku</h3><p className="panel-desc">Templat menentukan ukuran halaman, hierarki, tipografi, dan komponen isi.</p></div><FileText size={20} color="#5670b6"/></div>
   <div className="template-view-toolbar"><label htmlFor="book-template-select">Templat terpilih</label><select id="book-template-select" value={template} onChange={e=>setTemplate(e.target.value)}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button type="button" className="secondary-button" onClick={()=>setTemplateExpanded(v=>!v)}>{templateExpanded?"Tutup galeri ▲":"Lihat semua templat ▼"}</button><button type="button" className="secondary-button" onClick={()=>setTemplateFullscreen(true)} aria-label="Perbesar pratinjau templat">⛶ Perbesar</button></div>
   {templateExpanded&&<div className="template-grid">{templates.map(t=><button type="button" key={t.id} className={template===t.id?"template-card selected":"template-card"} onClick={()=>setTemplate(t.id)}><span className="template-preview" aria-hidden="true"><span className="template-page" style={{display:"block",width:"74%",height:112,margin:"6px auto",padding:9,background:"#fff",border:"1px solid #d5dce8",borderRadius:3,boxShadow:"0 3px 9px #13243c18",textAlign:"left"}}><span style={{display:"block",height:8,width:"70%",background:t.id==="literature"?"#a17b69":"#6479b9",borderRadius:2,marginBottom:7}}/><span style={{display:"block",height:4,width:"92%",background:"#d5dce8",marginBottom:4}}/><span style={{display:"block",height:4,width:"78%",background:"#d5dce8",marginBottom:7}}/><span style={{display:"block",height:30,width:"100%",background:t.id==="sd"?"#e3f2e9":t.id==="literature"?"#f4e8df":"#e7edf9",borderRadius:3,marginBottom:7}}/><span style={{display:"block",height:4,width:"88%",background:"#d5dce8",marginBottom:4}}/><span style={{display:"block",height:4,width:"65%",background:"#d5dce8"}}/></span></span><strong>{t.name}</strong><small>{t.description}</small><em>{t.formats}</em><small>{template===t.id?"✓ Template dipilih":"Klik untuk memilih"}</small></button>)}</div>}
   {templateFullscreen&&<div className="template-modal-backdrop" role="presentation" onClick={()=>setTemplateFullscreen(false)}><section className="template-modal" role="dialog" aria-modal="true" aria-label="Pratinjau besar templat buku" onClick={e=>e.stopPropagation()}><header><strong>Pratinjau templat — {templates.find(t=>t.id===template)?.name}</strong><button type="button" className="secondary-button" onClick={()=>setTemplateFullscreen(false)}>✕ Tutup</button></header><div className="template-modal-page"><div className="template-modal-title">{title||"Judul Buku Anda"}</div><p>{templates.find(t=>t.id===template)?.description}</p><div className="template-modal-banner">ILUSTRASI / DIAGRAM</div><h3>Bab 1 · Pengantar</h3><p>Tujuan pembelajaran, konsep utama, contoh kontekstual, kegiatan belajar, dan refleksi.</p><div className="template-modal-lines" aria-hidden="true"><i/><i/><i/><i/></div></div><footer><select aria-label="Ganti templat pratinjau" value={template} onChange={e=>setTemplate(e.target.value)}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button type="button" className="primary-button" onClick={()=>setTemplateFullscreen(false)}>Gunakan templat ini</button></footer></section></div>}
   <div className="book-output-settings"><fieldset className="book-output-group"><legend>Ukuran halaman</legend><p className="book-output-help">Pilih ukuran cetak. B5 direkomendasikan untuk buku pelajaran SMP.</p><div className="book-page-sizes">{["A4","A5","B5"].map(x=><label key={x} className={pageSize===x?"book-choice selected":"book-choice"}><input type="radio" name="book-page-size" value={x} checked={pageSize===x} onChange={()=>setPageSize(x)}/><span><strong>{x}</strong><small>{x==="A4"?"210 × 297 mm":x==="A5"?"148 × 210 mm":"176 × 250 mm"}</small></span></label>)}</div></fieldset><fieldset className="book-output-group"><legend>Format dokumen keluaran</legend><p className="book-output-help">Pilih satu atau beberapa format untuk diekspor.</p><div className="book-format-options">{outputOptions.map(x=><label key={x} className={outputs.includes(x)?"book-choice selected":"book-choice"}><input type="checkbox" checked={outputs.includes(x)} onChange={()=>toggleOutput(x)}/><span><strong>{x.split(" (")[0]}</strong><small>{x.includes("(")?x.slice(x.indexOf("(")+1,-1):"Dokumen buku"}</small></span></label>)}</div></fieldset></div>
  </section>
  <section className="panel"><h3 className="panel-title">05 · Kendali produksi</h3><div className="form-grid two">
   <Field label="Cara kerja agen"><select value={mode} onChange={e=>setMode(e.target.value)}><option>Otomatis dengan persetujuan pada gerbang penting</option><option>Bertahap dengan persetujuan setiap tahap</option></select></Field>
   <Field label="Batas anggaran"><select value={budget} onChange={e=>setBudget(e.target.value)}>{["Tentukan estimasi dahulu","Hemat","Standar","Mendalam"].map(x=><option key={x}>{x}</option>)}</select></Field>
  </div></section>
  </>}
  <button type="button" className="secondary-button" aria-expanded={advancedOpen} onClick={()=>setAdvancedOpen(v=>!v)}>{advancedOpen?"Sembunyikan pengaturan lanjutan":"Pengaturan lanjutan: kurikulum, bab, visual, layout dan ekspor"}</button>
  <section className="panel prompt-panel"><div className="panel-toolbar"><div><div className="eyebrow-dark">PROMPT INDUK DINAMIS</div><h3 className="panel-title">Instruksi produksi yang akan diterima agen</h3><p className="panel-desc">Dibentuk dari tujuan, pembaca, cakupan, sumber, dan templat yang kamu pilih.</p></div><WandSparkles size={22} color="#667bc1"/></div>
   {advancedOpen&&<div className="prompt-preview" tabIndex={0} role="region" aria-label="Pratinjau prompt produksi buku">{generatedPrompt}</div>}
   <div className="prompt-actions"><span className={complete?"complete-label":"incomplete-label"}>{complete?"Brief minimum terpenuhi":"Isi judul atau gambaran buku serta topik utama"}</span><button type="button" className="primary-button" disabled={!complete} onClick={()=>{setPrompt(generatedPrompt);setConfirmed(false)}}><Sparkles size={15}/> Susun prompt induk</button></div>
   {prompt&&<div className="prompt-confirm"><strong>Prompt induk siap ditinjau.</strong><p>Periksa instruksi di atas. Simpan brief sebagai proyek buku. Penyimpanan ini belum menjalankan agen atau menerbitkan buku.</p><button type="button" className="secondary-button" disabled={saving || generatedPrompt.length>12000} onClick={saveBrief}>{saving?"Menyimpan…":"Simpan proyek buku"}</button>{saveError&&<p role="alert">{saveError}</p>}{generatedPrompt.length>12000&&<p role="alert">Brief melebihi batas 12.000 karakter API beta. Ringkas isian sebelum menyimpan.</p>}{confirmed&&<span className="complete-label">Proyek tersimpan. Belum ada agen yang dijalankan.</span>}</div>}
  </section>
 </div>;
}
