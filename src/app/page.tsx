"use client";

import { useState } from "react";
import {
  Activity, BookOpen, Bot, Boxes, BrainCircuit, CheckCheck, ChevronRight,
  CircleHelp, Clock3, FileText, FlaskConical, FolderOpen, GraduationCap,
  Image, LayoutTemplate, Library, Lightbulb, Menu, MoreHorizontal,
  PenLine, Search, Settings2, ShieldCheck, Sparkles, SpellCheck,
  Users, WandSparkles, Bell
} from "lucide-react";

const navigation = [
  { label: "Dasbor", icon: Boxes, group: "UTAMA" },
  { label: "Proyek Buku", icon: FolderOpen, group: "UTAMA" },
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
  { title: "Laboratorium Ide", desc: "Temukan peluang dan rancang gagasan buku.", icon: Lightbulb },
  { title: "Laboratorium Kurikulum", desc: "Petakan capaian, tujuan, dan urutan belajar.", icon: GraduationCap },
  { title: "Studio Penulisan", desc: "Susun naskah bab demi bab.", icon: PenLine },
  { title: "Studio Latihan", desc: "Rancang soal, aktivitas, dan rubrik.", icon: FlaskConical },
  { title: "Studio Visual", desc: "Siapkan ilustrasi dan media pembelajaran.", icon: Image },
  { title: "Penyuntingan", desc: "Periksa bahasa, konsistensi, dan keterbacaan.", icon: SpellCheck },
  { title: "Tinjauan Pedagogis", desc: "Uji kesesuaian materi dengan peserta didik.", icon: ShieldCheck },
  { title: "Tata Letak & Terbit", desc: "Siapkan PDF, EPUB, dan edisi digital.", icon: BookOpen },
];

const agents = [
  ["Pemimpin Redaksi", "Mengatur alur dan keputusan editorial", "Siaga"],
  ["Riset & Referensi", "Menelusuri sumber dan kebutuhan pembaca", "Siaga"],
  ["Kurikulum", "Memetakan kompetensi dan jenjang", "Siaga"],
  ["Penulis", "Menyusun materi dan naskah", "Siaga"],
  ["Latihan & Asesmen", "Membuat soal dan rubrik", "Siaga"],
  ["Visual", "Merancang kebutuhan ilustrasi", "Siaga"],
  ["Penyunting Bahasa", "Memeriksa EYD dan keterbacaan", "Siaga"],
  ["Pedagogi", "Menilai kesesuaian pembelajaran", "Siaga"],
  ["Penjamin Mutu", "Memeriksa kelengkapan dan konsistensi", "Siaga"],
  ["Tata Letak", "Menyiapkan struktur halaman", "Siaga"],
  ["Penerbit", "Menyiapkan keluaran dan metadata", "Siaga"],
];

export default function Home() {
  const [active, setActive] = useState("Dasbor");
  const [query, setQuery] = useState("");
  const isDashboard = active === "Dasbor";
  const filteredAgents = agents.filter(([name, detail]) => (name + detail).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BC</div>
          <div><div className="brand-name">BOOK STUDIO</div><div className="brand-sub">Ekosistem Penerbitan Cerdas</div></div>
        </div>
        <div>
          {["UTAMA", "PRODUKSI", "MUTU & TERBIT", "PENGELOLAAN"].map(group => (
            <div key={group} style={{ marginBottom: 19 }}>
              <div className="nav-label">{group}</div>
              <div className="nav-list">
                {navigation.filter(item => item.group === group).map(item => {
                  const Icon = item.icon;
                  return <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => setActive(item.label)}><Icon size={16} strokeWidth={1.8}/>{item.label}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar-bottom"><strong><Sparkles size={13} style={{ display: "inline", marginRight: 5 }}/> Ruang kerja cerdas</strong><p>Setiap naskah melewati pemeriksaan dan persetujuan editor sebelum diterbitkan.</p></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="icon-button mobile-menu" aria-label="Buka menu"><Menu size={17}/></button>
            <div className="crumb">BC Book Studio <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }}/> {active}</div>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Pemberitahuan"><Bell size={16}/></button>
            <div className="avatar">DW</div>
          </div>
        </header>

        <div style={{ marginBottom: 21 }}>
          <h1 className="page-title">{isDashboard ? "Selamat datang di ruang penerbitan" : active}</h1>
          <p className="page-sub">{isDashboard ? "Rancang, tulis, periksa, dan terbitkan buku dalam satu alur kerja." : "Ruang kerja BC Book Studio. Layanan produksi akan diaktifkan setelah backend tersedia."}</p>
        </div>

        {isDashboard ? <>
          <section className="welcome">
            <div><div className="eyebrow">PUSAT KENDALI PENERBITAN</div><h2>Dari gagasan menjadi karya bermutu.</h2><p>Kelola seluruh proses penerbitan buku pendidikan, literasi, sastra, dan referensi dengan alur kerja berbantuan agen AI serta kendali editor manusia.</p></div>
            <div className="welcome-mark">BC</div>
          </section>

          <div className="stats">
            {[
              ["Proyek buku", "0", "Belum ada proyek", FolderOpen],
              ["Agen terdefinisi", "11", "Peran inti siap dikonfigurasi", BrainCircuit],
              ["Naskah diterbitkan", "0", "Menunggu alur produksi", BookOpen],
              ["Layanan AI", "Belum aktif", "Menunggu konfigurasi backend", Activity],
            ].map(([label, value, note, Icon]) => {
              const I = Icon as typeof Activity;
              return <div className="stat" key={label as string}><div className="stat-top"><span>{label as string}</span><span className="stat-icon"><I size={15}/></span></div><div className="stat-value" style={{ fontSize: (value as string).length > 5 ? 17 : 24 }}>{value as string}</div><div className="stat-note">{note as string}</div></div>;
            })}
          </div>

          <div className="section-head"><h3>Ruang produksi</h3><span>8 modul utama</span></div>
          <div className="module-grid">
            {modules.map(({ title, desc, icon: Icon }) => <button className="module-card" key={title} onClick={() => setActive(title === "Laboratorium Ide" ? "Idea Lab" : title === "Laboratorium Kurikulum" ? "Kurikulum" : title === "Studio Penulisan" ? "Studio Penulisan" : title === "Studio Latihan" ? "Studio Latihan" : title === "Studio Visual" ? "Studio Visual" : title === "Penyuntingan" ? "Penyuntingan" : title === "Tinjauan Pedagogis" ? "Tinjauan Pedagogis" : "Tata Letak")}><span className="module-symbol"><Icon size={17}/></span><strong>{title}</strong><p>{desc}</p></button>)}
          </div>

          <div className="section-head"><h3>Aktivitas ruang kerja</h3><span>Belum ada aktivitas</span></div>
          <div className="panel"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><Clock3 size={18} color="#8b95a5"/><div><div style={{ fontSize: 12, fontWeight: 600 }}>Ruang kerja siap disiapkan</div><div style={{ fontSize: 11, color: "#7b8491", marginTop: 4 }}>Aktivitas produksi akan tercatat setelah layanan backend diaktifkan.</div></div></div></div>
        </> : active === "Pusat Agen" ? <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><h3 className="panel-title">Susunan 11 agen inti</h3><p className="panel-desc">Definisi peran awal. Status siaga bukan berarti agen sudah berjalan.</p></div><span className="status">Konfigurasi awal</span></div>
            <div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "#929baa" }}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari agen..." style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8ebef", borderRadius: 10, outline: "none", fontSize: 12 }}/></div>
            {filteredAgents.map(([name, detail]) => <div className="agent-row" key={name}><span className="agent-dot idle"/><span className="agent-name">{name}</span><span className="agent-state">{detail}</span><span className="status">{ "Siaga" }</span></div>)}
          </section>
          <section className="panel"><h3 className="panel-title">Prinsip kendali agen</h3><p className="panel-desc">Agen bekerja berdasarkan peran, spesialisasi, jenjang, dan tahap produksi.</p><div className="agent-row"><CheckCheck size={16} color="#2b8a62"/><span className="agent-name">Persetujuan manusia wajib sebelum penerbitan</span></div><div className="agent-row"><ShieldCheck size={16} color="#2b8a62"/><span className="agent-name">Agen tidak boleh mengarang sumber atau ISBN</span></div><div className="agent-row"><CircleHelp size={16} color="#2b8a62"/><span className="agent-name">Kegagalan satu tahap tidak mengulang seluruh buku</span></div></section>
        </> : <>
          <section className="panel"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div className="module-symbol"><WandSparkles size={18}/></div><div><h3 className="panel-title">{active}</h3><p className="panel-desc" style={{ marginBottom: 0 }}>Tampilan ruang kerja awal sedang disiapkan. Fungsi penyimpanan, pemrosesan, dan koneksi agen menunggu backend.</p></div></div><div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "#f7f8fa", color: "#687386", fontSize: 12, lineHeight: 1.7 }}>Tahap hari ini berfokus pada fondasi antarmuka dan definisi agen. Tidak ada data produksi yang dibuat atau dikirim ke penyedia AI pada tahap ini.</div></section>
        </>}

        <div className="footer-note">BC BOOK STUDIO · Ruang kerja penerbitan cerdas · Pratinjau fondasi antarmuka</div>
      </main>
    </div>
  );
}