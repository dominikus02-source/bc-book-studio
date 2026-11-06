"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, FileText, Layers3, Sparkles, WandSparkles, ShieldCheck } from "lucide-react";

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

export default function BookCommandForm({onCreated}:{onCreated:()=>void}) {
 const [saving,setSaving]=useState(false); const [saveError,setSaveError]=useState("");
 async function saveBrief(){setSaving(true);setSaveError("");try{const r=await fetch("/api/books",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title.trim()||topics.trim().slice(0,180),grade:["SD","SMP","SMA"].includes(audience)?grade:"Referensi",subject:category,description:generatedPrompt,bookType,genre,pageSize,author:author.trim()||"BC Book Studio"})});const d=await r.json();if(!r.ok)throw Error(d.error||"Gagal menyimpan");setConfirmed(true);onCreated();}catch(e){setSaveError(e instanceof Error?e.message:"Gagal menyimpan")}finally{setSaving(false)}}
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
 const [pageSize,setPageSize]=useState("B5");
 const [outputs,setOutputs]=useState<string[]>(["DOCX (dapat disunting)","PDF (digital/cetak)"]);
 const [mode,setMode]=useState("Otomatis dengan persetujuan pada gerbang penting");
 const [budget,setBudget]=useState("Tentukan estimasi dahulu");
 const [prompt,setPrompt]=useState("");
 const [confirmed,setConfirmed]=useState(false);

 const selectedTemplate=templates.find(x=>x.id===template)!;
 const complete=purpose.trim().length>=20 && problem.trim().length>=10 && topics.trim().length>=5;
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

 return <div className="workspace-stack">
  <div className="local-notice"><ShieldCheck size={16}/><span>Formulir ini adalah pintu masuk utama produksi buku. Saat ini brief disimpan sebagai deskripsi proyek di server. Eksekusi 11 agen menunggu orkestrator.</span></div>
  <div className="workspace-heading"><div><div className="eyebrow-dark">PERINTAH PRODUKSI TERPADU</div><h2>Satu brief, satu alur produksi buku</h2><p>Jelaskan hasil yang kamu inginkan. Sistem akan menyusun prompt induk dan menentukan alur agen yang tepat.</p></div><span className="status">Formulir utama</span></div>
  <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">01 · Tujuan dan kebutuhan buku</h3><p className="panel-desc">Bagian ini menentukan arah seluruh prompt produksi.</p></div><BookOpenCheck size={20} color="#5670b6"/></div>
   <div className="form-grid two">
    <Field label="Judul sementara"><input value={title} onChange={e=>{setTitle(e.target.value);setConfirmed(false)}} placeholder="Boleh dikosongkan, agen dapat mengusulkan judul"/></Field>
    <Field label="Nama penulis atau organisasi"><input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Penulis buku" maxLength={180}/></Field>
    <Field label="Jenis buku"><select value={bookType} onChange={e=>{const next=e.target.value as "FICTION"|"NONFICTION";setBookType(next);setGenre(next==="FICTION"?"NOVEL":"TEXTBOOK");setPageSize(next==="FICTION"?"A5":"B5")}}><option value="NONFICTION">Nonfiksi</option><option value="FICTION">Fiksi</option></select></Field>
    <Field label="Genre"><select value={genre} onChange={e=>setGenre(e.target.value)}>{(bookType==="FICTION"?fictionGenres:nonfictionGenres).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field>
    <Field label="Kategori buku"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Apa tujuan utama buku ini?" hint="Jelaskan hasil yang ingin dicapai pembaca."><textarea rows={4} value={purpose} onChange={e=>{setPurpose(e.target.value);setConfirmed(false)}} placeholder="Contoh: Membantu siswa memahami teks argumentasi dan mampu menulis argumen yang didukung bukti..."/></Field>
    <Field label="Masalah apa yang ingin diselesaikan?" hint="Semakin spesifik, semakin tepat rancangan isi dan prompt."><textarea rows={4} value={problem} onChange={e=>{setProblem(e.target.value);setConfirmed(false)}} placeholder="Contoh: Siswa sering menyampaikan pendapat tanpa alasan dan bukti yang relevan..."/></Field>
   </div>
  </section>
  <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">02 · Pembaca dan tingkat kedalaman</h3><p className="panel-desc">Profil pembaca akan mengarahkan bahasa, contoh, visual, dan kompleksitas materi.</p></div><Layers3 size={20} color="#5670b6"/></div>
   <div className="form-grid two">
    <Field label="Pembaca sasaran"><select value={audience} onChange={e=>setAudience(e.target.value)}>{audiences.map(x=><option key={x}>{x}</option>)}</select></Field>
    {(audience==="SD"||audience==="SMP"||audience==="SMA")&&<Field label="Kelas"><select value={grade} onChange={e=>setGrade(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Kelas {i+1}</option>)}</select></Field>}
    <Field label="Kemampuan awal pembaca"><select value={level} onChange={e=>setLevel(e.target.value)}>{["Pemula","Dasar","Menengah","Lanjut","Beragam"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Kurikulum atau sumber wajib"><input value={curriculum} onChange={e=>setCurriculum(e.target.value)} placeholder="Nama kurikulum, dokumen, atau sumber khusus"/></Field>
   </div>
  </section>
  <section className="panel"><h3 className="panel-title">03 · Cakupan dan pendekatan isi</h3><div className="form-grid two">
   <Field label="Topik dan ruang lingkup" hint="Sebutkan topik utama, subtopik, atau batasan."><textarea rows={5} value={topics} onChange={e=>{setTopics(e.target.value);setConfirmed(false)}} placeholder="Topik utama, subtopik, contoh konteks, dan hal yang perlu dihindari..."/></Field>
   <div><Field label="Jumlah bab"><select value={chapters} onChange={e=>setChapters(e.target.value)}>{["Rekomendasikan otomatis","4 bab","6 bab","8 bab","10 bab","12 bab","16 bab"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Gaya penyajian"><select value={style} onChange={e=>setStyle(e.target.value)}>{styles.map(x=><option key={x}>{x}</option>)}</select></Field></div>
  </div><div className="toggle-grid">
   <label><input type="checkbox" checked={exercises} onChange={e=>setExercises(e.target.checked)}/> Latihan, soal, dan asesmen</label>
   <label><input type="checkbox" checked={visuals} onChange={e=>setVisuals(e.target.checked)}/> Ilustrasi dan infografik</label>
   <label><input type="checkbox" checked={references} onChange={e=>setReferences(e.target.checked)}/> Referensi dan daftar pustaka</label>
  </div></section>
  <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">04 · Pilih templat layout buku</h3><p className="panel-desc">Templat menentukan ukuran halaman, hierarki, tipografi, dan komponen isi.</p></div><FileText size={20} color="#5670b6"/></div>
   <div className="template-grid">{templates.map(t=><button type="button" key={t.id} className={template===t.id?"template-card selected":"template-card"} onClick={()=>setTemplate(t.id)}><span className="template-preview"><i/><i/><i/><i/></span><strong>{t.name}</strong><small>{t.description}</small><em>{t.formats}</em></button>)}</div>
   <div className="form-grid two"><Field label="Ukuran halaman"><select value={pageSize} onChange={e=>setPageSize(e.target.value)}>{["A4","A5","B5"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Format dokumen keluaran"><div className="output-checks">{outputOptions.map(x=><label key={x}><input type="checkbox" checked={outputs.includes(x)} onChange={()=>toggleOutput(x)}/>{x}</label>)}</div></Field></div>
  </section>
  <section className="panel"><h3 className="panel-title">05 · Kendali produksi</h3><div className="form-grid two">
   <Field label="Cara kerja agen"><select value={mode} onChange={e=>setMode(e.target.value)}><option>Otomatis dengan persetujuan pada gerbang penting</option><option>Bertahap dengan persetujuan setiap tahap</option></select></Field>
   <Field label="Batas anggaran"><select value={budget} onChange={e=>setBudget(e.target.value)}>{["Tentukan estimasi dahulu","Hemat","Standar","Mendalam"].map(x=><option key={x}>{x}</option>)}</select></Field>
  </div></section>
  <section className="panel prompt-panel"><div className="panel-toolbar"><div><div className="eyebrow-dark">PROMPT INDUK DINAMIS</div><h3 className="panel-title">Instruksi produksi yang akan diterima agen</h3><p className="panel-desc">Dibentuk dari tujuan, pembaca, cakupan, sumber, dan templat yang kamu pilih.</p></div><WandSparkles size={22} color="#667bc1"/></div>
   <div className="prompt-preview" tabIndex={0} role="region" aria-label="Pratinjau prompt produksi buku">{generatedPrompt}</div>
   <div className="prompt-actions"><span className={complete?"complete-label":"incomplete-label"}>{complete?"Brief minimum terpenuhi":"Lengkapi tujuan, masalah, dan cakupan isi"}</span><button type="button" className="primary-button" disabled={!complete} onClick={()=>{setPrompt(generatedPrompt);setConfirmed(false)}}><Sparkles size={15}/> Susun prompt induk</button></div>
   {prompt&&<div className="prompt-confirm"><strong>Prompt induk siap ditinjau.</strong><p>Periksa instruksi di atas. Simpan brief sebagai proyek buku. Penyimpanan ini belum menjalankan agen atau menerbitkan buku.</p><button type="button" className="secondary-button" disabled={saving || generatedPrompt.length>12000} onClick={saveBrief}>{saving?"Menyimpan…":"Simpan proyek buku"}</button>{saveError&&<p role="alert">{saveError}</p>}{generatedPrompt.length>12000&&<p role="alert">Brief melebihi batas 12.000 karakter API beta. Ringkas isian sebelum menyimpan.</p>}{confirmed&&<span className="complete-label">Proyek tersimpan. Belum ada agen yang dijalankan.</span>}</div>}
  </section>
 </div>;
}
