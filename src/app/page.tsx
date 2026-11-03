"use client";

import { useEffect, useState } from "react";
import StudioWorkspace from "@/components/studio-workspace";
import BookCommandForm from "@/components/book-command-form";
import {
  Activity, BookOpen, Bot, Boxes, BrainCircuit, ChevronRight, Clock3,
  FlaskConical, FolderOpen, GraduationCap, Image, LayoutTemplate, Library,
  Lightbulb, Menu, PenLine, Settings2, ShieldCheck, Sparkles, SpellCheck, Bell
} from "lucide-react";

const navigation = [
  { label: "Dasbor", icon: Boxes, group: "UTAMA" },
  { label: "Proyek Buku", icon: FolderOpen, group: "UTAMA" },
  { label: "Buat Buku", icon: BookOpen, group: "UTAMA" },
  { label: "Idea Lab", icon: Lightbulb, group: "PRODUKSI" },
  { label: "Kurikulum", icon: GraduationCap, group: "PRODUKSI" },
  { label: "Studio Penulisan", icon: PenLine, group: "PRODUKSI" },
  { label: "Studio Latihan", icon: FlaskConical, group: "PRODUKSI" },
  { label: "Studio Visual", icon: Image, group: "PRODUKSI" },
  { label: "Penyuntingan", icon: SpellCheck, group: "MUTU & TERBIT" },
  { label: "Tinjauan Pedagogis", icon: ShieldCheck, group: "MUTU & TERBIT" },
  { label: "Tata Letak", icon: LayoutTemplate, group: "MUTU & TERBIT" },
  { label: "Penerbitan", icon: Library, group: "MUTU & TERBIT" },
  { label: "Pusat Agen", icon: Bot, group: "PENGELOLAAN" },
  { label: "Pengaturan", icon: Settings2, group: "PENGELOLAAN" },
];

const modules = [
  { title: "Laboratorium Ide", desc: "Temukan peluang dan rancang gagasan buku.", icon: Lightbulb, target: "Idea Lab" },
  { title: "Laboratorium Kurikulum", desc: "Petakan capaian, tujuan, dan urutan belajar.", icon: GraduationCap, target: "Kurikulum" },
  { title: "Studio Penulisan", desc: "Susun naskah bab demi bab.", icon: PenLine, target: "Studio Penulisan" },
  { title: "Studio Latihan", desc: "Rancang soal, aktivitas, dan rubrik.", icon: FlaskConical, target: "Studio Latihan" },
  { title: "Studio Visual", desc: "Siapkan ilustrasi dan media pembelajaran.", icon: Image, target: "Studio Visual" },
  { title: "Penyuntingan", desc: "Periksa bahasa, konsistensi, dan keterbacaan.", icon: SpellCheck, target: "Penyuntingan" },
  { title: "Tinjauan Pedagogis", desc: "Uji kesesuaian materi dengan peserta didik.", icon: ShieldCheck, target: "Tinjauan Pedagogis" },
  { title: "Tata Letak & Terbit", desc: "Siapkan PDF, EPUB, dan edisi digital.", icon: BookOpen, target: "Tata Letak" },
];

export default function Home() {
  const [active, setActive] = useState("Dasbor");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const navigate = (event: Event) => setActive((event as CustomEvent<string>).detail);
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
      <div>{["UTAMA","PRODUKSI","MUTU & TERBIT","PENGELOLAAN"].map(group=><div key={group} style={{marginBottom:19}}><div className="nav-label">{group}</div><div className="nav-list">{navigation.filter(item=>item.group===group).map(item=>{const Icon=item.icon;return <button key={item.label} className={`nav-item ${active===item.label?"active":""}`} onClick={()=>{setActive(item.label);setMobileOpen(false);}}><Icon size={16} strokeWidth={1.8}/>{item.label}</button>;})}</div></div>)}</div>
      <div className="sidebar-bottom"><strong><Sparkles size={13} style={{display:"inline",marginRight:5}}/>Ruang kerja cerdas</strong><p>Setiap naskah melewati pemeriksaan dan persetujuan editor sebelum diterbitkan.</p></div>
    </nav>
    <main id="main-content" tabIndex={-1} className="main min-w-0">
      <header className="topbar"><div style={{display:"flex",alignItems:"center",gap:10}}><button className="icon-button mobile-menu" aria-label="Buka menu" aria-expanded={mobileOpen} aria-controls="studio-sidebar" onClick={()=>setMobileOpen(!mobileOpen)}><Menu size={17}/></button><div className="crumb">BC Book Studio <ChevronRight size={12} style={{display:"inline",verticalAlign:"middle"}}/> {active}</div></div><div className="top-actions"><button className="icon-button" aria-label="Pemberitahuan"><Bell size={16}/></button><div className="avatar">DW</div></div></header>
      {active==="Buat Buku"?<><div style={{marginBottom:20}}><h1 className="page-title">Buat buku baru</h1><p className="page-sub">Satu formulir perintah untuk seluruh proses produksi.</p></div><BookCommandForm/></>:active==="Dasbor"?<>
        <div style={{marginBottom:21}}><h1 className="page-title">Selamat datang di ruang penerbitan</h1><p className="page-sub">Rancang, tulis, periksa, dan terbitkan buku dalam satu alur kerja.</p></div>
        <section className="welcome"><div><div className="eyebrow">PUSAT KENDALI PENERBITAN</div><h2>Dari gagasan menjadi karya bermutu.</h2><p>Kelola proses penerbitan buku pendidikan, literasi, sastra, dan referensi dengan bantuan agen AI serta kendali editor manusia.</p></div><div className="welcome-mark">BC</div></section>
        <div className="stats">{[["Proyek buku","0","Belum ada proyek",FolderOpen],["Agen terdefinisi","11","Peran inti siap dikonfigurasi",BrainCircuit],["Naskah diterbitkan","0","Menunggu alur produksi",BookOpen],["Layanan AI","Belum aktif","Menunggu konfigurasi backend",Activity]].map(([label,value,note,Icon])=>{const I=Icon as typeof Activity;return <div className="stat" key={label as string}><div className="stat-top"><span>{label as string}</span><span className="stat-icon"><I size={15}/></span></div><div className="stat-value" style={{fontSize:(value as string).length>5?17:24}}>{value as string}</div><div className="stat-note">{note as string}</div></div>;})}</div>
        <div className="section-head"><h3>Ruang produksi</h3><span>8 modul utama</span></div><div className="module-grid">{modules.map(({title,desc,icon:Icon,target})=><button className="module-card" key={title} onClick={()=>setActive(target)}><span className="module-symbol"><Icon size={17}/></span><strong>{title}</strong><p>{desc}</p></button>)}</div>
        <div className="section-head"><h3>Aktivitas ruang kerja</h3><span>Belum ada aktivitas</span></div><div className="panel"><div style={{display:"flex",alignItems:"center",gap:12}}><Clock3 size={18} color="#8b95a5"/><div><div style={{fontSize:12,fontWeight:600}}>Ruang kerja siap disiapkan</div><div style={{fontSize:11,color:"#536173",marginTop:4}}>Aktivitas produksi akan tercatat setelah layanan backend diaktifkan.</div></div></div></div>
      </>:<><div style={{marginBottom:20}}><h1 className="page-title">{active}</h1><p className="page-sub">Ruang kerja BC Book Studio · layanan produksi menunggu backend.</p></div><StudioWorkspace active={active}/></>}
      <div className="footer-note">BC BOOK STUDIO · Ruang kerja penerbitan cerdas · Pratinjau fondasi antarmuka</div>
    </main>
  </div>;
}
