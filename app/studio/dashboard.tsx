"use client";

import { useEffect, useState } from "react";
import BetaWorkspace, { useBooks } from "@/components/beta-workspace";
import StudioWorkspace from "@/components/studio-workspace";
import IsbnOfficeDashboard from "@/components/isbn-office-dashboard";
import ReviewerWorkspace from "@/app/reviewer/reviewer-workspace";
import BlankBookForm from "@/components/blank-book-form";
import PrintingWorkspace from "@/components/printing-workspace";
import StudioUserGuide from "@/components/studio-user-guide";
import {
  Activity, BookOpen, Bot, Boxes, BrainCircuit, ChevronRight, Clock3,
  FlaskConical, FolderOpen, GraduationCap, Image, LayoutTemplate, Library,
  Lightbulb, Menu, PenLine, Settings2, ShieldCheck, Sparkles, SpellCheck, Bell, Printer, BookMarked
} from "lucide-react";

const navigation = [
  { label: "Dasbor", icon: Boxes, group: "UTAMA" },
  { label: "Buat Buku", icon: BookOpen, group: "UTAMA" },
  { label: "Proyek Buku", icon: FolderOpen, group: "UTAMA" },
  { label: "Idea Lab", icon: Lightbulb, group: "PRODUKSI" },
  { label: "Rancang", icon: GraduationCap, group: "PRODUKSI" },
  { label: "Kurikulum", icon: GraduationCap, group: "PRODUKSI" },
  { label: "Studio Penulisan", icon: PenLine, group: "PRODUKSI" },
  { label: "Studio Latihan", icon: FlaskConical, group: "PRODUKSI" },
  { label: "Studio Visual", icon: Image, group: "PRODUKSI" },
  { label: "Penyuntingan", icon: SpellCheck, group: "MUTU & TERBIT" },
  { label: "Review Naskah", icon: ShieldCheck, group: "MUTU & TERBIT" },
  { label: "Tata Letak", icon: LayoutTemplate, group: "MUTU & TERBIT" },
  { label: "Penerbitan", icon: Library, group: "MUTU & TERBIT" },
  { label: "Pengaturan", icon: Settings2, group: "PENGELOLAAN" },
  { label: "ISBN & Legalitas", icon: ShieldCheck, group: "PENGELOLAAN" },
  { label: "Percetakan", icon: Printer, group: "PENGELOLAAN" },
  { label: "Petunjuk Penggunaan", icon: BookMarked, group: "PENGELOLAAN" },
];

const modules = [
  { title: "Laboratorium Ide", desc: "Temukan peluang dan rancang gagasan buku.", icon: Lightbulb, target: "Idea Lab" },
  { title: "Laboratorium Kurikulum", desc: "Petakan capaian, tujuan, dan urutan belajar.", icon: GraduationCap, target: "Kurikulum" },
  { title: "Studio Penulisan", desc: "Susun naskah bab demi bab.", icon: PenLine, target: "Studio Penulisan" },
  { title: "Studio Latihan", desc: "Rancang soal, aktivitas, dan rubrik.", icon: FlaskConical, target: "Studio Latihan" },
  { title: "Studio Visual", desc: "Siapkan ilustrasi dan media pembelajaran.", icon: Image, target: "Studio Visual" },
  { title: "Penyuntingan", desc: "Periksa bahasa, konsistensi, dan keterbacaan.", icon: SpellCheck, target: "Penyuntingan" },
  { title: "Tata Letak & Terbit", desc: "Siapkan PDF, EPUB, dan edisi digital.", icon: BookOpen, target: "Tata Letak" },
];

export default function Home({role}:{role:"EDITOR"|"REVIEWER"|"ADMIN"}) {
  const { books, error: booksError, loading, refresh } = useBooks();
  const visibleNavigation=navigation.filter(item=>(item.label!=="ISBN & Legalitas"||role==="ADMIN"));
  const primaryNavigation=[{label:"Dasbor",title:"Beranda",icon:Boxes},{label:"Buat Buku",title:"Buat Buku Baru",icon:BookOpen},{label:"Proyek Buku",title:"Buku Saya",icon:FolderOpen},{label:"Tata Letak",title:"Tata Letak",icon:LayoutTemplate},{label:"Review Naskah",title:"Review & Persetujuan",icon:ShieldCheck},{label:"Pengaturan",title:"Pengaturan",icon:Settings2},{label:"ISBN & Legalitas",title:"ISBN & Legalitas Penerbit",icon:ShieldCheck},{label:"Percetakan",title:"Percetakan",icon:Printer},{label:"Petunjuk Penggunaan",title:"Petunjuk Penggunaan",icon:BookMarked}].filter(item=>(item.label!=="ISBN & Legalitas"||role==="ADMIN"));
  const workflow=[{name:"Ide",modules:["Proyek Buku","Idea Lab"]},{name:"Rancang",modules:["Rancang","Kurikulum"]},{name:"Tulis",modules:["Studio Penulisan","Studio Latihan","Studio Visual"]},{name:"Review",modules:["Penyuntingan","Review Naskah"]},{name:"Terbit",modules:["Tata Letak","Penerbitan"]}];
  const [workflowOpen,setWorkflowOpen]=useState(false);
  const [layoutView,setLayoutView]=useState<"editor"|"formats">("editor");
  const [workflowBookId,setWorkflowBookId]=useState("");
  const workflowBook=books.find(b=>b.id===workflowBookId)||books.find(b=>b.isOwner!==false)||books[0];
  type Stage={name:string;complete:boolean;available:boolean;missing:string[]};
  const [progress,setProgress]=useState<{bookId:string;stages:Stage[]}|null>(null);
  const [progressError,setProgressError]=useState("");
  useEffect(()=>{
    if(!workflowBook||workflowBook.isOwner===false){setProgress(null);return}
    const controller=new AbortController();
    setProgressError("");
    fetch("/api/books/"+workflowBook.id+"/workflow",{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);return data})
      .then(data=>{if(!controller.signal.aborted)setProgress({bookId:workflowBook.id,stages:data.stages})})
      .catch(error=>{if(!controller.signal.aborted){setProgress(null);setProgressError(error.message)}});
    return()=>controller.abort();
  },[workflowBook]);
  const stageChecks=workflow.map((step,index)=>{
    const saved=progress?.bookId===workflowBook?.id?progress?.stages[index]:workflowBook?.stageReadiness?.stages[index];
    return {name:step.name,complete:saved?.complete??false,available:saved?.available??(index===0),
      missing:saved?.missing.join(" ")??"Pilih buku untuk melanjutkan. Status tahap sedang diperiksa."};
  });
  function stageAllowed(index:number){return stageChecks[index].available}
  function openStage(index:number){if(!stageAllowed(index))return;const target=workflow[index].modules.find(m=>visibleNavigation.some(x=>x.label===m));if(target)navigateTo(target,workflowBook?.id)}
  const [active, setActive] = useState("Dasbor");
  // The authenticated studio preserves the active page across refresh/back/forward.
  function navigateTo(module:string,bookId?:string){
    if(!visibleNavigation.some(item=>item.label===module))return;
    setActive(module);
    if(bookId)setWorkflowBookId(bookId);
    const url=new URL(window.location.href);
    url.searchParams.set("module",module);
    if(bookId||workflowBookId)url.searchParams.set("bookId",bookId||workflowBookId);
    window.history.pushState({module},"",url.pathname+url.search+url.hash);
  }
  useEffect(()=>{
    const sync=()=>{
      const params=new URLSearchParams(window.location.search);
      setWorkflowBookId(params.get("bookId")||"");
      const requested=params.get("module");
      setActive(visibleNavigation.some(item=>item.label===requested)?requested!:"Dasbor");
    };
    sync();
    window.addEventListener("popstate",sync);
    return ()=>window.removeEventListener("popstate",sync);
  },[]);
  const [dark,setDark]=useState(false);
  useEffect(()=>{setDark(localStorage.getItem("bcstudio-theme")==="dark");},[]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("bcstudio-theme",dark?"dark":"light");window.dispatchEvent(new Event("bc-theme-change"));},[dark]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutBusy,setLogoutBusy]=useState(false);
  async function logout(){setLogoutBusy(true);try{const r=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});if(!r.ok)throw Error("Logout gagal");window.location.assign("/login");}catch{alert("Gagal keluar. Coba lagi.");setLogoutBusy(false);}}

  useEffect(() => {
    const navigate = (event: Event) => navigateTo((event as CustomEvent<string>).detail);
    window.addEventListener("bc-studio-navigate", navigate);
    return () => window.removeEventListener("bc-studio-navigate", navigate);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return <div className="shell min-h-dvh">
    <a className="skip-link" href="#main-content">Lewati navigasi</a>
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
    <nav id="studio-sidebar" aria-label="Menu studio" className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <button type="button" className="sidebar-close" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}>×</button>
      <div className="brand"><div className="brand-mark">BC</div><div><div className="brand-name">BOOK STUDIO</div><div className="brand-sub">Ekosistem Penerbitan Cerdas</div></div></div>
      <div><div className="nav-label">RUANG KERJA</div><div className="nav-list">{primaryNavigation.map(item=>{const Icon=item.icon;return <button key={item.label} className={`nav-item ${active===item.label?"active":""}`} onClick={()=>{navigateTo(item.label);setMobileOpen(false);}}><Icon size={16} strokeWidth={1.8}/>{item.title}</button>})}</div><button type="button" className="nav-item" aria-expanded={workflowOpen} onClick={()=>setWorkflowOpen(x=>!x)}><ChevronRight size={16}/> {workflowOpen?"Sembunyikan tahapan":"Lihat semua tahapan"}</button>{workflowOpen&&workflow.map(step=><div key={step.name} style={{marginTop:12}}><div className="nav-label">{step.name.toUpperCase()}</div><div className="nav-list">{step.modules.filter(m=>visibleNavigation.some(x=>x.label===m)).map(m=><button key={m} className={`nav-item ${active===m?"active":""}`} onClick={()=>{navigateTo(m);setMobileOpen(false)}}>{m}</button>)}</div></div>)}</div>
      <div className="sidebar-bottom"><strong><ShieldCheck size={13} style={{display:"inline",marginRight:5}}/>Alur dengan validasi</strong><p>Progres tersimpan pada buku. Review manusia dan bukti penerbitan diperlukan untuk rilis.</p></div>
    </nav>
    <main id="main-content" tabIndex={-1} className={active==="Tata Letak"?"main min-w-0 layout-main":"main min-w-0"}>
      <header className="topbar"><div style={{display:"flex",alignItems:"center",gap:10}}><button className="icon-button mobile-menu" aria-label="Buka menu" aria-expanded={mobileOpen} aria-controls="studio-sidebar" onClick={()=>setMobileOpen(!mobileOpen)}><Menu size={17}/></button><div className="crumb">BC Book Studio <ChevronRight size={12} style={{display:"inline",verticalAlign:"middle"}}/> {active}</div></div><div className="top-actions"><button type="button" className="secondary-button" onClick={()=>setDark(x=>!x)}>{dark?"Mode terang":"Mode gelap"}</button><button type="button" className="secondary-button" disabled={logoutBusy} onClick={()=>void logout()}>{logoutBusy?"Keluar?":"Keluar"}</button></div></header>
      {active!=="Review Naskah"&&active!=="Dasbor"&&active!=="Pengaturan"&&active!=="Buat Buku"&&active!=="Percetakan"&&active!=="Petunjuk Penggunaan"&&<section className={"panel studio-workflow"+(active==="Studio Penulisan"?" writing-workflow-summary":"")} aria-label="Tahapan pembuatan buku">
        <div className="panel-toolbar"><div><p className="form-hint">BUKU YANG SEDANG ANDA KERJAKAN</p><strong>{workflowBook?.title||"Mulai buku pertama Anda"}</strong><p className="panel-desc">Satu langkah setiap kali. Anda dapat kembali ke tahap sebelumnya untuk memperbaiki naskah.</p></div></div>
        {active==="Studio Penulisan"&&<p className="writing-workflow-status">Tahap 3 dari 5 · Menulis bab · Penyimpanan otomatis</p>}
        {workflowBook?.isOwner===false?<p>Anda ditugaskan sebagai peninjau. Buka Review & Persetujuan untuk memberikan masukan.</p>:<>
        <div className="studio-workflow-actions" role="group" aria-label="Urutan tahap">{workflow.map((step,i)=><button type="button" key={step.name}
          aria-current={step.modules.includes(active)?"step":undefined}
          className={step.modules.includes(active)?"primary-button":"secondary-button"} disabled={!stageAllowed(i)}
          title={!stageAllowed(i)?stageChecks[Math.max(0,i-1)].missing:undefined} onClick={()=>openStage(i)}>
          <span>{i+1}. {step.name}</span><small>{stageChecks[i].complete?"Selesai":step.modules.includes(active)?"Sedang dikerjakan":!stageAllowed(i)?"Belum tersedia":"Buka tahap"}</small>
        </button>)}</div>
        {progressError&&<p role="alert">Status tahap belum dapat dimuat. {progressError}</p>}
        {(()=>{const current=workflow.findIndex(step=>step.modules.includes(active));if(current<0)return null;return <p className="stage-guidance" role="status">{stageChecks[current].complete?"Tahap ini sudah lengkap. Anda tetap dapat membukanya untuk meninjau kembali.":stageChecks[current].missing}</p>})()}
        {workflow.find(step=>step.modules.includes(active))&&<details className="stage-tools"><summary>Alat bantu tahap ini</summary><div className="studio-workflow-actions studio-workflow-modules" role="group" aria-label="Modul tahap aktif">{workflow.find(step=>step.modules.includes(active))!.modules.filter(m=>visibleNavigation.some(x=>x.label===m)).map(m=><button type="button" className="secondary-button" key={m} disabled={m===active} onClick={()=>navigateTo(m,workflowBook?.id)}>{m}</button>)}</div></details>}
        </>}
      </section>}

      {active==="Percetakan"?<PrintingWorkspace books={books} initialBookId={workflowBookId}/>:active==="Petunjuk Penggunaan"?<StudioUserGuide navigate={navigateTo} bookId={workflowBook?.id} role={role}/>:active==="Review Naskah"?<ReviewerWorkspace initialBookId={workflowBookId} onSelectBook={id=>navigateTo("Review Naskah",id)} onNavigate={navigateTo}/>:active==="Buat Buku"?<><div style={{marginBottom:20}}><h1 className="page-title">Buat buku baru</h1><p className="page-sub">Mulai dari gagasan sederhana. Rincian buku dapat Anda lengkapi sambil berjalan.</p></div><BlankBookForm onCreated={created=>{setWorkflowBookId(created.id);void refresh();navigateTo("Proyek Buku",created.id);}}/></>:active==="Dasbor"?<>
        <div style={{marginBottom:21}}><h1 className="page-title">Selamat datang di ruang penerbitan</h1><p className="page-sub">Rancang, tulis, periksa, dan terbitkan buku dalam satu alur kerja.</p></div>
        <section className="welcome"><div><div className="eyebrow">PUSAT KENDALI PENERBITAN</div><h2>Dari gagasan menjadi karya bermutu.</h2><p>Kelola brief, kerangka, naskah, pemeriksaan editorial, tata letak, dan publikasi dengan jejak penyimpanan serta kendali editor manusia.</p></div><div className="welcome-mark">BC</div></section>
        <div className="stats">{[["Proyek buku",String(books.length),"Buku milik Anda",FolderOpen],["Sedang ditinjau",String(books.filter(b=>b.status==="REVIEW").length),"Buku menunggu keputusan reviewer",ShieldCheck],["Naskah disetujui",String(books.filter(b=>b.status==="APPROVED").length),"Persetujuan editorial",BookOpen],["Draf aktif",String(books.filter(b=>b.status==="DRAFT").length),"Proyek yang masih dapat diedit",PenLine]].map(([label,value,note,Icon])=>{const I=Icon as typeof Activity;return <div className="stat" key={label as string}><div className="stat-top"><span>{label as string}</span><span className="stat-icon"><I size={15}/></span></div><div className="stat-value" style={{fontSize:(value as string).length>5?17:24}}>{value as string}</div><div className="stat-note">{note as string}</div></div>;})}</div>
        <div className="section-head"><h3>Mulai atau lanjutkan buku</h3><span>5 tahap terarah</span></div><div className="module-grid">{workflow.map((step,i)=><button className="module-card" key={step.name} disabled={!stageAllowed(i)} title={!stageAllowed(i)?stageChecks[i-1]?.missing:undefined} onClick={()=>openStage(i)}><span className="module-symbol">{i+1}</span><strong>{step.name}</strong><p>{["Kembangkan gagasan buku","Tentukan struktur dan sasaran","Tulis bab, latihan, dan visual","Periksa mutu dan persetujuan","Atur layout dan ekspor"][i]}</p></button>)}</div><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}><button className="primary-button" onClick={()=>navigateTo("Buat Buku")}>+ Buat Buku Baru</button><button className="secondary-button" onClick={()=>navigateTo("Proyek Buku")}>Lanjutkan Buku Saya</button></div>
        <div className="section-head"><h3>Aktivitas ruang kerja</h3><span>{books.length} buku</span></div><div className="panel"><div style={{display:"flex",alignItems:"center",gap:12}}><Clock3 size={18} color="#8b95a5"/><div><div style={{fontSize:12,fontWeight:600}}>Buku terbaru: {books[0]?.title || "Belum ada buku"}</div><div style={{fontSize:11,color:"#536173",marginTop:4}}>Data diambil dari perpustakaan pribadi Anda.</div></div></div></div>
      </>:<>{active!=="Studio Penulisan"&&<div style={{marginBottom:20}}><h1 className="page-title">{active}</h1><p className="page-sub">Pilih buku dan lanjutkan pekerjaan yang tersimpan di database.</p></div>}{!["Proyek Buku","Rancang","Studio Penulisan","Penyuntingan","Tata Letak","Penerbitan","ISBN & Legalitas"].includes(active)&&<StudioWorkspace active={active}/>}{active==="ISBN & Legalitas"&&role==="ADMIN"&&<IsbnOfficeDashboard/>}</>}
      {active === "Tata Letak" && (
        <section className="panel" aria-labelledby="layout-prototype-title" style={{marginBottom:16}}>
          <h2 id="layout-prototype-title" className="panel-title">Ruang kerja Tata Letak</h2>
          <p>Pilih buku yang sudah disetujui untuk menyimpan tata letak.</p>
          <div className="layout-format-tabs" aria-label="Tampilan Tata Letak">
            <button type="button" className={layoutView==="editor"?"primary-button":"secondary-button"} aria-pressed={layoutView==="editor"} onClick={()=>setLayoutView("editor")}>Editor tata letak</button>
            <button type="button" className={layoutView==="formats"?"primary-button":"secondary-button"} aria-pressed={layoutView==="formats"} onClick={()=>setLayoutView("formats")}>Pratinjau format buku</button>
          </div>

          <p className="form-hint">Gunakan buku yang tersimpan untuk mengubah tata letak atau melihat hasil ekspor sebenarnya. Tidak ada editor contoh yang menyimpan data di browser.</p>
        </section>
      )}
      <div hidden={!["Proyek Buku","Rancang","Studio Penulisan","Penyuntingan","Tata Letak","Penerbitan"].includes(active)}><BetaWorkspace selectedBookId={workflowBookId} onSelected={bookId=>{
        setWorkflowBookId(bookId);
        const url=new URL(window.location.href);url.searchParams.set("bookId",bookId);
        window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
      }} active={active} layoutView={layoutView} onNavigate={(module,projectId)=>{if(projectId)setWorkflowBookId(projectId);navigateTo(module,projectId)}} onChanged={refresh} books={books} error={booksError} loading={loading}/></div><div className="footer-note">BC BOOK STUDIO · Ruang kerja penerbitan cerdas · Rilis awal</div>
    </main>
  </div>;
}
