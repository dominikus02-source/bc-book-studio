"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpen, ChevronDown, CircleDashed, FilePlus2,
  FileText, GraduationCap, Image as ImageIcon, Layers3, Plus, Save,
  Search, ShieldCheck, Sparkles
} from "lucide-react";

import ProviderSettings from "./provider-settings";
import SettingsOverview from "./settings-overview";
import PaginationSettingsPanel from "./pagination-settings-panel";
import FormDraftManager from "./form-draft-manager";
import {type TransferField,type TransferRecord} from "./form-transfer";

import registry from "../agents/agent-registry.json";

type Props = { active: string };

const agentList = registry.agents.map(agent => [agent.name, agent.capabilities.join(" · ")]);

const classOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Kelas ${i + 1} · ${i < 6 ? "SD" : i < 9 ? "SMP" : "SMA"}`
}));

const formFields:Record<string,TransferField[]>={
 "Idea Lab":[{key:"bookTitle",label:"Judul sementara",maxLength:180},{key:"category",label:"Kategori",maxLength:120},{key:"audience",label:"Pembaca",maxLength:80},{key:"grade",label:"Kelas",maxLength:3},{key:"idea",label:"Masalah pembaca",maxLength:4000},{key:"localBrief",label:"Ringkasan draf",maxLength:12000}],
 "Studio Latihan":[{key:"questionType",label:"Jenis soal",maxLength:80},{key:"questionObjective",label:"Indikator",maxLength:1000},{key:"question",label:"Pertanyaan",maxLength:5000},{key:"questionAnswer",label:"Jawaban",maxLength:2000},{key:"questionExplanation",label:"Pembahasan",maxLength:5000},{key:"exerciseItemsJson",label:"Daftar soal tersusun (JSON)",maxLength:12000}],
 "Kurikulum":[{key:"grade",label:"Jenjang",maxLength:3},{key:"curriculumName",label:"Kerangka / versi",maxLength:180},{key:"curriculumOutcome",label:"Capaian",maxLength:6000},{key:"curriculumObjective",label:"Tujuan pembelajaran",maxLength:6000},{key:"curriculumSource",label:"URL dokumen sumber resmi",maxLength:500},{key:"curriculumSequence",label:"Urutan materi dan prasyarat",maxLength:6000}],
 "Studio Visual":[{key:"visualPurpose",label:"Tujuan visual",maxLength:160},{key:"grade",label:"Jenjang pembaca",maxLength:3},{key:"visualDescription",label:"Deskripsi visual",maxLength:6000},{key:"visualLicense",label:"Lisensi dan referensi",maxLength:4000}],
 "Pusat Agen":[{key:"agentQuery",label:"Pencarian agen",maxLength:180},{key:"selectedAgent",label:"Agen terpilih",maxLength:120}]
};
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="studio-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function LocalDraftNotice() {
  return <div className="local-notice"><CircleDashed size={16}/><span>Ruang kerja tahap awal. Idea Lab, Kurikulum, Latihan, dan Visual tersimpan sebagai draf terpisah di database. Konten belum otomatis menjadi bab/aset buku; gunakan Studio Penulisan untuk memasukkannya ke proyek.</span></div>;
}

export default function StudioWorkspace({ active }: Props) {
  const [runtimeStatus,setRuntimeStatus]=useState<{database:string;ai:{configured:boolean;model:string|null}}|null>(null);
  const [statusError,setStatusError]=useState("");
  useEffect(()=>{if(active!=="Pengaturan")return;const controller=new AbortController();fetch("/api/studio/status",{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw Error("Status layanan belum dapat dimuat");setRuntimeStatus(await r.json());setStatusError("")}).catch(e=>{if(!controller.signal.aborted)setStatusError(e.message)});return()=>controller.abort()},[active]);
  const [bookTitle, setBookTitle] = useState("");
  const [audience, setAudience] = useState("SMP");
  const [category, setCategory] = useState("Buku pelajaran");
  const [idea, setIdea] = useState("");
  const [localBrief, setLocalBrief] = useState("");
  const [grade, setGrade] = useState("7");
  const [chapter, setChapter] = useState("Bab 1");
  const [manuscript, setManuscript] = useState("");
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState("Pilihan ganda");
  const [questionObjective, setQuestionObjective] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [questionExplanation, setQuestionExplanation] = useState("");
  const [exerciseItems, setExerciseItems] = useState<Array<{id:number;type:string;objective:string;prompt:string;answer:string;explanation:string}>>([]);
  const [agentQuery, setAgentQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Pemimpin Redaksi");
  const [visualPurpose, setVisualPurpose] = useState("Menjelaskan konsep");
  const [editorText, setEditorText] = useState("");
  const [curriculumName,setCurriculumName]=useState("");
  const [curriculumOutcome,setCurriculumOutcome]=useState("");
  const [curriculumObjective,setCurriculumObjective]=useState("");
  const [curriculumSource,setCurriculumSource]=useState("");
  const [curriculumSequence,setCurriculumSequence]=useState("");
  const [visualDescription,setVisualDescription]=useState("");
  const [visualLicense,setVisualLicense]=useState("");


  const words = useMemo(() => manuscript.trim() ? manuscript.trim().split(/\s+/).length : 0, [manuscript]);
  const filteredAgents = agentList.filter(([name, desc]) => (name + desc).toLowerCase().includes(agentQuery.toLowerCase()));

  const draftModule=(["Idea Lab","Studio Latihan","Kurikulum","Studio Visual","Pusat Agen"] as const).find(x=>x===active);
  const draftValues:TransferRecord=active==="Idea Lab"?{bookTitle,category,audience,grade,idea,localBrief}:active==="Studio Latihan"?{questionType,questionObjective,question,questionAnswer,questionExplanation,exerciseItemsJson:JSON.stringify(exerciseItems)}:active==="Kurikulum"?{grade,curriculumName,curriculumOutcome,curriculumObjective,curriculumSource,curriculumSequence}:active==="Studio Visual"?{visualPurpose,grade,visualDescription,visualLicense}:{agentQuery,selectedAgent};
  function applyDraft(data:TransferRecord){
   const set=(key:string,fn:(v:string)=>void)=>{if(typeof data[key]==="string")fn(String(data[key]))};
   if(active==="Idea Lab"){set("bookTitle",setBookTitle);set("category",setCategory);set("audience",setAudience);set("grade",setGrade);set("idea",setIdea);set("localBrief",setLocalBrief)}
   if(active==="Studio Latihan"){set("questionType",setQuestionType);set("questionObjective",setQuestionObjective);set("question",setQuestion);set("questionAnswer",setQuestionAnswer);set("questionExplanation",setQuestionExplanation);if(typeof data.exerciseItemsJson==="string"){try{const parsed=JSON.parse(data.exerciseItemsJson);if(Array.isArray(parsed)&&parsed.length<=100&&parsed.every(x=>x&&typeof x.prompt==="string"&&typeof x.objective==="string"&&typeof x.type==="string"&&typeof x.answer==="string"&&typeof x.explanation==="string"&&x.prompt.length<=5000))setExerciseItems(parsed.map((x,i)=>({id:Date.now()+i,type:x.type,objective:x.objective,prompt:x.prompt,answer:x.answer,explanation:x.explanation})));}catch{}}}
   if(active==="Kurikulum"){set("grade",setGrade);set("curriculumName",setCurriculumName);set("curriculumOutcome",setCurriculumOutcome);set("curriculumObjective",setCurriculumObjective);set("curriculumSource",setCurriculumSource);set("curriculumSequence",setCurriculumSequence)}
   if(active==="Studio Visual"){set("visualPurpose",setVisualPurpose);set("grade",setGrade);set("visualDescription",setVisualDescription);set("visualLicense",setVisualLicense)}
   if(active==="Pusat Agen"){set("agentQuery",setAgentQuery);set("selectedAgent",setSelectedAgent)}
  }
  const draftManager=draftModule?<FormDraftManager module={draftModule} fields={formFields[draftModule]} values={draftValues} onApply={applyDraft}/>:null;

  if (active === "Pusat Agen") {
    return <div className="workspace-stack">
      <LocalDraftNotice/>{draftManager}
      <div className="workspace-heading"><div><div className="eyebrow-dark">PUSAT KENDALI AGEN</div><h2>Arsitektur multi-agen hibrida</h2><p>11 peran inti, 8 spesialisasi, 12 profil jenjang, dan tiga lingkup memori.</p></div><span className="status">Rancangan awal</span></div>
      <div className="workspace-stats"><div><strong>11</strong><span>Agen inti</span></div><div><strong>8</strong><span>Spesialisasi</span></div><div><strong>12</strong><span>Profil kelas</span></div><div><strong>3</strong><span>Lingkup memori</span></div></div>
      <section className="panel"><div className="panel-toolbar"><div><h3 className="panel-title">Daftar agen</h3><p className="panel-desc">Peran logis yang kelak dipanggil orkestrator sesuai tahap produksi.</p></div><div className="search-box"><Search size={15}/><input value={agentQuery} onChange={e=>setAgentQuery(e.target.value)} placeholder="Cari peran agen"/></div></div>
        <div className="agent-directory">{filteredAgents.map(([name,desc])=><button className={selectedAgent===name?"agent-card selected":"agent-card"} key={name} onClick={()=>setSelectedAgent(name)}><span className="agent-number">{String(agentList.findIndex(a=>a[0]===name)+1).padStart(2,"0")}</span><span className="agent-card-copy"><strong>{name}</strong><small>{desc}</small></span><ChevronDown size={15}/></button>)}</div>
        <div className="agent-detail"><span className="status">Belum diaktifkan</span><h3>{selectedAgent}</h3><p>Instruksi, kemampuan, batas kewenangan, dan format keluaran agen tersedia dalam dokumen spesifikasi. Eksekusi menunggu orkestrator backend.</p><a href="https://github.com/dominikus02-source/bc-book-studio/tree/feat/frontend-agent-foundation/agents/roles" target="_blank" rel="noreferrer">Buka spesifikasi agen <ArrowRight size={14}/></a></div>
      </section>
      <div className="workspace-two"><section className="panel"><h3 className="panel-title">Spesialisasi keilmuan</h3><div className="tag-cloud">{["Linguistik","Tata bahasa dan ortografi","Sastra","Literasi","Retorika dan komunikasi","Genre dan keterampilan menulis","Asesmen","Literasi digital"].map(x=><span key={x}>{x}</span>)}</div></section><section className="panel"><h3 className="panel-title">Lingkup memori</h3><div className="memory-item"><strong>Pengetahuan global</strong><small>Sumber terverifikasi dan pedoman umum.</small></div><div className="memory-item"><strong>Memori proyek</strong><small>Keputusan, sumber, dan konteks setiap buku.</small></div><div className="memory-item"><strong>Memori kerja</strong><small>Konteks sementara untuk tugas aktif.</small></div></section></div>
    </div>;
  }

  if (active === "Idea Lab") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PERANCANGAN GAGASAN</div><h2>Mulai dari kebutuhan pembaca</h2><p>Catat ide awal dan susun ringkasan konsep sebagai bahan diskusi editorial.</p></div><span className="status">Draf terkelola</span></div><div className="workspace-two"><section className="panel"><h3 className="panel-title">Identitas gagasan</h3><div className="form-grid"><Field label="Judul sementara"><input value={bookTitle} onChange={e=>setBookTitle(e.target.value)} placeholder="Contoh: Bahasa di Sekitar Kita"/></Field><Field label="Kategori buku"><select value={category} onChange={e=>setCategory(e.target.value)}>{["Buku pelajaran","Panduan guru","Buku pengayaan","Tata bahasa","Sastra","Literasi","Persiapan UKBI/TKA","Buku umum"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Pembaca sasaran"><select value={audience} onChange={e=>setAudience(e.target.value)}>{["TK","SD","SMP","SMA","Mahasiswa","Guru","Umum"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Jenjang kelas"><select value={grade} onChange={e=>setGrade(e.target.value)}>{classOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></Field><Field label="Masalah atau kebutuhan pembaca" hint="Tuliskan masalah nyata yang ingin dijawab buku."><textarea rows={5} value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Apa yang belum dipahami atau dibutuhkan pembaca?"/></Field></div><button className="primary-button" onClick={()=>setLocalBrief(`Gagasan: ${bookTitle||"Belum diberi judul"}\nKategori: ${category}\nPembaca: ${audience} · Kelas ${grade}\nKebutuhan: ${idea||"Belum diisi"}\n\nTahap berikutnya: riset kebutuhan, verifikasi sumber, dan penilaian kelayakan oleh editor.`)}><FilePlus2 size={15}/> Susun ringkasan draf</button></section><section className="panel"><h3 className="panel-title">Ringkasan konsep</h3><p className="panel-desc">Pratinjau lokal dari informasi yang kamu masukkan.</p>{localBrief?<pre className="draft-preview">{localBrief}</pre>:<div className="empty-state"><LightbulbIcon/><strong>Belum ada ringkasan</strong><span>Isi gagasan di sebelah kiri, lalu susun draf ringkasannya.</span></div>}</section></div></div>;

  if (active === "Studio Penulisan") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">RUANG PENULISAN</div><h2>Bangun naskah secara bertahap</h2><p>Editor awal untuk menyusun kerangka dan isi bab. Belum terhubung ke penyimpanan server.</p></div><span className="status">Draf terkelola</span></div><section className="panel"><div className="form-grid two"><Field label="Judul buku"><input value={bookTitle} onChange={e=>setBookTitle(e.target.value)} placeholder="Judul naskah"/></Field><Field label="Bab aktif"><input value={chapter} onChange={e=>setChapter(e.target.value)}/></Field></div><Field label="Isi naskah" hint={`${words} kata · Perubahan belum disimpan ke server`}><textarea className="manuscript-editor" rows={18} value={manuscript} onChange={e=>setManuscript(e.target.value)} placeholder="Mulai menulis naskah di sini..."/></Field><div className="editor-toolbar"><span><FileText size={14}/> Naskah kerja</span><button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(manuscript)}><Save size={14}/> Salin naskah</button></div></section></div>;

  if (active === "Studio Latihan") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PERANCANGAN ASESMEN</div><h2>Rancang latihan yang terukur</h2><p>Setiap butir perlu terhubung dengan tujuan, indikator, kunci, dan pembahasan.</p></div><span className="status">Draf terkelola</span></div><div className="workspace-two"><section className="panel"><h3 className="panel-title">Butir latihan baru</h3><Field label="Jenis soal"><select value={questionType} onChange={e=>setQuestionType(e.target.value)}>{["Pilihan ganda","Pilihan ganda kompleks","Benar atau salah","Menjodohkan","Isian singkat","Uraian","Analisis teks","Proyek"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Tujuan atau indikator"><input value={questionObjective} onChange={e=>setQuestionObjective(e.target.value)} placeholder="Contoh: Mengidentifikasi gagasan utama"/></Field><Field label="Pertanyaan atau instruksi"><textarea rows={5} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Tuliskan pertanyaan atau instruksi..."/></Field><Field label="Kunci atau jawaban acuan"><textarea rows={2} value={questionAnswer} onChange={e=>setQuestionAnswer(e.target.value)} placeholder="Masukkan jawaban atau kriteria jawaban..."/></Field><Field label="Pembahasan"><textarea rows={3} value={questionExplanation} onChange={e=>setQuestionExplanation(e.target.value)} placeholder="Jelaskan alasan jawaban..."/></Field><button className="primary-button" disabled={!question.trim()||!questionObjective.trim()} onClick={()=>{setExerciseItems(items=>[...items,{id:Date.now(),type:questionType,objective:questionObjective,prompt:question,answer:questionAnswer,explanation:questionExplanation}]);setQuestion("");setQuestionObjective("");setQuestionAnswer("");setQuestionExplanation("");}}><Plus size={15}/> Tambahkan ke daftar draf</button></section><section className="panel"><h3 className="panel-title">Pratinjau butir</h3><span className="status">{questionType}</span><div className="question-preview">{question||"Pertanyaan yang kamu tulis akan tampil di sini."}</div><div className="quality-reminder"><ShieldCheck size={16}/><span>Kunci jawaban, pembahasan, distraktor, dan rubrik harus ditambahkan serta ditinjau sebelum soal digunakan.</span></div><h3 className="panel-title" style={{marginTop:18}}>Daftar butir draf · {exerciseItems.length}</h3>{exerciseItems.length===0?<p className="panel-desc">Belum ada butir yang ditambahkan.</p>:exerciseItems.map((item,index)=><div className="check-row" key={item.id}><span>{index+1}. {item.prompt}</span><small>{item.type}</small><button className="secondary-button" onClick={()=>{setQuestionType(item.type);setQuestionObjective(item.objective);setQuestion(item.prompt);setQuestionAnswer(item.answer);setQuestionExplanation(item.explanation);setExerciseItems(items=>items.filter(x=>x.id!==item.id))}}>Ubah</button><button className="secondary-button" onClick={()=>setExerciseItems(items=>items.filter(x=>x.id!==item.id))}>Hapus</button></div>)}</section></div></div>;

  if (active === "Kurikulum") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PEMETAAN PEMBELAJARAN</div><h2>Bangun kesinambungan kurikulum</h2><p>Kerangka kurikulum dan dokumen sumber harus ditetapkan sebelum pemetaan disahkan.</p></div><span className="status">Menunggu sumber resmi</span></div><section className="panel"><h3 className="panel-title">Identitas pemetaan</h3><div className="form-grid two"><Field label="Jenjang"><select value={grade} onChange={e=>setGrade(e.target.value)}>{classOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></Field><Field label="Nama kerangka dan versi"><input value={curriculumName} onChange={e=>setCurriculumName(e.target.value)} placeholder="Isi berdasarkan dokumen resmi yang dipilih"/></Field><Field label="Capaian pembelajaran"><textarea rows={3} value={curriculumOutcome} onChange={e=>setCurriculumOutcome(e.target.value)} placeholder="Salin atau ringkas capaian dari sumber resmi..."/></Field><Field label="Tujuan pembelajaran"><textarea rows={3} value={curriculumObjective} onChange={e=>setCurriculumObjective(e.target.value)} placeholder="Rumuskan tujuan yang dapat diamati..."/></Field><Field label="URL sumber kurikulum resmi"><input type="url" value={curriculumSource} onChange={e=>setCurriculumSource(e.target.value)} placeholder="https://... dokumen resmi" maxLength={500}/></Field><Field label="Urutan materi dan prasyarat"><textarea rows={4} value={curriculumSequence} onChange={e=>setCurriculumSequence(e.target.value)} placeholder="Topik, prasyarat, dan keterkaitan antarbab..."/></Field></div><div className="quality-reminder"><ShieldCheck size={16}/><span>Pemetaan berstatus draf sampai sumber resmi, versi, dan validasi ahli dicatat.</span></div></section></div>;

  if (active === "Studio Visual") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PERENCANAAN VISUAL</div><h2>Visual yang membantu pembelajaran</h2><p>Setiap aset harus memiliki tujuan, keterangan, dan catatan hak penggunaan.</p></div><span className="status">Brief visual</span></div><section className="panel"><div className="form-grid two"><Field label="Tujuan visual"><select value={visualPurpose} onChange={e=>setVisualPurpose(e.target.value)}>{["Menjelaskan konsep","Membandingkan informasi","Menunjukkan proses","Membangun konteks cerita","Memetakan hubungan ide","Sampul buku"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Jenjang pembaca"><select value={grade} onChange={e=>setGrade(e.target.value)}>{classOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></Field><Field label="Deskripsi kebutuhan visual"><textarea rows={5} value={visualDescription} onChange={e=>setVisualDescription(e.target.value)} placeholder="Apa yang harus dipahami pembaca melalui visual ini?"/></Field><Field label="Catatan lisensi dan referensi"><textarea rows={5} value={visualLicense} onChange={e=>setVisualLicense(e.target.value)} placeholder="Cantumkan sumber, izin, atau kebutuhan aset orisinal."/></Field></div><div className="quality-reminder"><ImageIcon size={20}/><span>Form ini menyimpan brief visual sebagai draf. Untuk mengunggah aset gambar ke buku beserta lisensi dan alt text, buka Studio Penulisan pada buku aktif.</span><button type="button" className="secondary-button" onClick={()=>window.dispatchEvent(new CustomEvent("bc-studio-navigate",{detail:"Studio Penulisan"}))}>Buka aset buku</button></div></section></div>;

  if (active === "Penyuntingan" || active === "Tinjauan Pedagogis") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PENJAMINAN MUTU</div><h2>{active==="Penyuntingan"?"Tinjau bahasa dan keterbacaan":"Tinjau kelayakan pembelajaran"}</h2><p>{active==="Penyuntingan"?"Masukkan naskah untuk menyiapkan bahan telaah editor.":"Nilai tujuan, pembaca, materi, aktivitas, dan asesmen secara berbukti."}</p></div><span className="status">Belum ditelaah</span></div><section className="panel"><Field label={active==="Penyuntingan"?"Naskah yang akan disunting":"Bagian buku yang akan ditelaah"}><textarea className="manuscript-editor" rows={12} value={editorText} onChange={e=>setEditorText(e.target.value)} placeholder="Tempelkan teks atau ringkasan bagian yang akan ditinjau..."/></Field><div className="quality-reminder"><ShieldCheck size={16}/><span>Belum ada pemeriksaan otomatis. Hasil telaah harus memuat bukti, lokasi temuan, tingkat keparahan, dan rekomendasi.</span></div></section></div>;

  if (active === "Tata Letak" || active === "Penerbitan") return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PERSIAPAN TERBIT</div><h2>{active==="Tata Letak"?"Rancang pengalaman membaca":"Pastikan buku siap diterbitkan"}</h2><p>{active==="Tata Letak"?"Pilih arah desain dan struktur halaman untuk pembaca.":"Penerbitan memerlukan pemeriksaan kelengkapan dan persetujuan manusia."}</p></div><span className="status">Belum siap terbit</span></div><div className="workspace-three">{["Buku pelajaran","Panduan guru","Buku pengayaan"].map((x,i)=><button className="layout-choice" key={x}><span className="layout-sheet"><span/><span/><span/><span/></span><strong>{x}</strong><small>{i===0?"Struktur pembelajaran bertahap":i===1?"Panduan praktik untuk pendidik":"Pendalaman dan aktivitas mandiri"}</small></button>)}</div><section className="panel"><h3 className="panel-title">Daftar pemeriksaan praterbit</h3>{["Naskah lengkap dan telah disetujui","Sumber dan hak penggunaan sudah ditinjau","Penyuntingan dan telaah pedagogis selesai","Tidak ada temuan mutu kritis terbuka","Sampul, ilustrasi, dan metadata lengkap","Persetujuan editor untuk penerbitan"].map(x=><div className="check-row" key={x}><CircleDashed size={16}/><span>{x}</span><small>Belum diperiksa</small></div>)}</section></div>;

  if (active === "Pengaturan") return <div className="workspace-stack settings-workspace"><SettingsOverview/><PaginationSettingsLink/><ProviderSettings/></div>;

  return <div className="workspace-stack"><LocalDraftNotice/>{draftManager}<div className="workspace-heading"><div><div className="eyebrow-dark">PENGELOLAAN NASKAH</div><h2>Ruang proyek buku</h2><p>Daftar proyek akan tampil setelah layanan penyimpanan dan basis data tersedia.</p></div><span className="status">Belum ada proyek</span></div><section className="panel empty-project"><BookOpen size={28}/><h3>Belum ada proyek buku</h3><p>Mulai dari Idea Lab untuk merancang gagasan, lalu buat proyek setelah layanan backend tersedia.</p><button className="primary-button" onClick={()=>window.dispatchEvent(new CustomEvent("bc-studio-navigate",{detail:"Idea Lab"}))}><Plus size={15}/> Rancang gagasan buku</button></section></div>;
}

function LightbulbIcon(){return <Sparkles size={23}/>}

function PaginationSettingsLink(){
  const [bookId,setBookId]=useState("");
  useEffect(()=>{setBookId(new URLSearchParams(window.location.search).get("bookId")||"")},[]);
  return <PaginationSettingsPanel bookId={bookId}/>;
}
