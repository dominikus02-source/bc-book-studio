"use client";

import { useEffect, useState } from "react";
import BetaWorkspace, { useBooks } from "@/components/beta-workspace";
import StudioWorkspace from "@/components/studio-workspace";
import IsbnOfficeDashboard from "@/components/isbn-office-dashboard";
import ReviewerWorkspace from "@/app/reviewer/reviewer-workspace";
import BlankBookForm from "@/components/blank-book-form";
import PrintingWorkspace from "@/components/printing-workspace";
import StudioUserGuide from "@/components/studio-user-guide";
import AccountManagement from "@/components/account-management";
import {
  bookWorkspaceAction, roleCaption, roleHomeCopy, stageOpenAllowed, studioPrimaryNav, STAGE_PATH,
  type StudioRole,
} from "@/lib/studio-home";
import {
  BookMarked, BookOpen, ChevronRight, FolderOpen, Menu, Settings2, ShieldCheck,
} from "lucide-react";

const knownModules = ["Dasbor","Proyek Buku","Buat Buku","Idea Lab","Rancang","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Review Naskah","Tinjauan Pedagogis","Tata Letak","Penerbitan","Pusat Agen","Pengaturan","ISBN & Legalitas","Percetakan","Petunjuk Penggunaan","Manajemen Akun"];
const bookModules = ["Proyek Buku","Rancang","Studio Penulisan","Penyuntingan","Tata Letak","Penerbitan"];
const workflow = [
  { name: "Ide", modules: ["Proyek Buku","Idea Lab"] },
  { name: "Rancang", modules: ["Rancang","Kurikulum"] },
  { name: "Tulis", modules: ["Studio Penulisan","Studio Latihan","Studio Visual"] },
  { name: "Review", modules: ["Review Naskah","Penyuntingan","Tinjauan Pedagogis"] },
  { name: "Terbit", modules: ["Tata Letak","Penerbitan","Percetakan"] },
];
const navIcon: Record<string, typeof BookOpen> = {
  "Dasbor": FolderOpen,
  "Proyek Buku": BookOpen,
  "Review Naskah": ShieldCheck,
  "ISBN & Legalitas": ShieldCheck,
  "Manajemen Akun": ShieldCheck,
  "Pengaturan": Settings2,
  "Petunjuk Penggunaan": BookMarked,
};

type Stage = { name: string; complete: boolean; available: boolean; missing: string[] };
type DeskBook = { id: string; title: string; status: string; isOwner?: boolean; editorialStage?: string; stageReadiness?: { stages: Stage[] } };

function waitingDecisions(books: DeskBook[], role: StudioRole) {
  return books.filter(book => book.isOwner === false && book.status === "REVIEW" && (role === "REVIEWER" || role === "ADMIN"));
}

export default function Home({ role, name }: { role: StudioRole; name: string }) {
  const { books, error: booksError, loading, refresh } = useBooks();
  const primaryNavigation = studioPrimaryNav(role);
  const homeCopy = roleHomeCopy(role);
  function moduleAllowed(module: string) {
    if (!knownModules.includes(module)) return false;
    if (module === "Manajemen Akun") return role === "SUPERADMIN";
    if (module === "ISBN & Legalitas") return role === "ADMIN" || role === "SUPERADMIN";
    return true;
  }
  const [layoutView, setLayoutView] = useState<"editor" | "formats">("formats");
  const [workflowBookId, setWorkflowBookId] = useState("");
  const workflowBook = books.find(b => b.id === workflowBookId) || books.find(b => b.isOwner !== false) || books[0];
  const [progress, setProgress] = useState<{ bookId: string; stages: Stage[] } | null>(null);
  const [progressError, setProgressError] = useState("");
  useEffect(() => {
    if (!workflowBook || workflowBook.isOwner === false) { setProgress(null); return; }
    const controller = new AbortController();
    setProgressError("");
    fetch("/api/books/" + workflowBook.id + "/workflow", { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error); return data; })
      .then(data => { if (!controller.signal.aborted) setProgress({ bookId: workflowBook.id, stages: data.stages }); })
      .catch(error => { if (!controller.signal.aborted) { setProgress(null); setProgressError(error instanceof Error ? error.message : "Gagal memuat"); } });
    return () => controller.abort();
  }, [workflowBook]);
  const stageChecks = workflow.map((step, index) => {
    const saved = progress?.bookId === workflowBook?.id ? progress?.stages[index] : workflowBook?.stageReadiness?.stages[index];
    return {
      name: step.name,
      complete: saved?.complete ?? false,
      available: saved?.available ?? index === 0,
      missing: saved?.missing?.join(" ") || "Pilih buku untuk melanjutkan.",
    };
  });
  function stageAllowed(index: number) { return stageOpenAllowed(stageChecks, index); }
  const [active, setActive] = useState("Dasbor");
  function navigateTo(module: string, bookId?: string) {
    if (!moduleAllowed(module)) return;
    setActive(module);
    if (bookId) setWorkflowBookId(bookId);
    const url = new URL(window.location.href);
    url.searchParams.set("module", module);
    if (bookId || workflowBookId) url.searchParams.set("bookId", bookId || workflowBookId);
    window.history.pushState({ module }, "", url.pathname + url.search + url.hash);
  }
  function openStage(index: number) {
    if (!stageAllowed(index)) return;
    const target = workflow[index].modules.find(module => moduleAllowed(module)) || STAGE_PATH[index].module;
    navigateTo(target, workflowBook?.id);
  }
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setWorkflowBookId(params.get("bookId") || "");
      const requested = params.get("module");
      setActive(requested && moduleAllowed(requested) ? requested : "Dasbor");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [role]);
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("bcstudio-theme");
    const mode = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(mode);
    setThemeReady(true);
  }, []);
  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("bcstudio-theme", dark ? "dark" : "light");
    window.dispatchEvent(new Event("bc-theme-change"));
  }, [dark, themeReady]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  async function logout() {
    setLogoutBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw Error("Logout gagal");
      window.location.assign("/login");
    } catch {
      alert("Gagal keluar. Coba lagi.");
      setLogoutBusy(false);
    }
  }
  useEffect(() => {
    const navigate = (event: Event) => navigateTo((event as CustomEvent<string>).detail);
    window.addEventListener("bc-studio-navigate", navigate);
    return () => window.removeEventListener("bc-studio-navigate", navigate);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const showWorkflow = !["Review Naskah","Dasbor","Pengaturan","Buat Buku","ISBN & Legalitas","Percetakan","Petunjuk Penggunaan","Manajemen Akun"].includes(active);
  const decisions = waitingDecisions(books, role);
  const ownedDraft = books.find(book => book.isOwner !== false && book.status === "DRAFT");
  const focusBook = role === "REVIEWER" && decisions[0] ? decisions[0] : (ownedDraft || books.find(book => book.isOwner !== false) || books[0]);
  const focusAction = focusBook ? bookWorkspaceAction(role, focusBook) : null;

  return <div className="shell studio-app min-h-dvh">
    <a className="skip-link" href="#main-content">Lewati navigasi</a>
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
    <nav id="studio-sidebar" aria-label="Menu studio" className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <button type="button" className="sidebar-close" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}>×</button>
      <div className="brand"><div className="brand-mark">BC</div><div><div className="brand-name">BOOK STUDIO</div><div className="brand-sub">Bahasa Cerdas</div></div></div>
      <div>
        <div className="nav-label">RUANG KERJA</div>
        <div className="nav-list">{primaryNavigation.map(item => {
          const Icon = navIcon[item.label] || BookOpen;
          return <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => { navigateTo(item.label); setMobileOpen(false); }}><Icon size={16} strokeWidth={1.8} />{item.title}</button>;
        })}</div>
      </div>
      <div className="studio-identity"><strong>{name}</strong><span>{roleCaption(role)}</span></div>
    </nav>
    <main id="main-content" tabIndex={-1} className={active === "Tata Letak" ? "main min-w-0 layout-main" : active === "ISBN & Legalitas" ? "main min-w-0 isbn-page-main" : "main min-w-0"}>
      <header className="topbar">
        <div><button className="icon-button mobile-menu" aria-label="Buka menu" aria-expanded={mobileOpen} aria-controls="studio-sidebar" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={17} /></button><div className="crumb">BC Book Studio <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }} /> {active === "Studio Penulisan" ? "Tulis" : active === "Proyek Buku" ? "Ide" : active === "Review Naskah" ? "Review" : active === "Tata Letak" || active === "Penerbitan" ? "Terbit" : active}</div></div>
        <div className="top-actions">
          <button type="button" className="studio-theme-switch" aria-pressed={dark} aria-label={dark ? "Mode terang" : "Mode gelap"} onClick={() => setDark(value => !value)}>{dark ? "Terang" : "Gelap"}</button>
          <button type="button" className="secondary-button" disabled={logoutBusy} onClick={() => void logout()}>{logoutBusy ? "Keluar…" : "Keluar"}</button>
        </div>
      </header>

      {showWorkflow && <section className={"panel studio-workflow" + (active === "Studio Penulisan" ? " writing-workflow-summary" : "")} aria-label="Tahapan pembuatan buku">
        <div className="panel-toolbar"><div><p className="form-hint">{active === "Studio Penulisan" ? "SEDANG DITULIS" : "BUKU YANG DIKERJAKAN"}</p><strong>{workflowBook?.title || "Mulai dari Ide"}</strong></div></div>
        {workflowBook?.isOwner === false ? <p>Anda membaca sebagai peninjau. Keputusan ada di Review.</p> : active === "Studio Penulisan" ? (() => {
          const current = workflow.findIndex(step => step.modules.includes(active));
          return <div className="writing-stage-navigation">{current < 4 && <button type="button" className="secondary-button" disabled={!stageAllowed(current + 1)} onClick={() => openStage(current + 1)}>Berikutnya: {workflow[current + 1].name}</button>}</div>;
        })() : <>
          <nav className="studio-workflow-actions" aria-label="Urutan tahap">{workflow.map((step, index) => <button type="button" key={step.name}
            aria-current={step.modules.includes(active) ? "step" : undefined}
            className={step.modules.includes(active) ? "primary-button" : "secondary-button"}
            disabled={!stageAllowed(index)}
            title={!stageAllowed(index) ? stageChecks[Math.max(0, index - 1)].missing : undefined}
            onClick={() => openStage(index)}>
            <span>{index + 1}. {step.name}</span><small>{stageChecks[index].complete ? "Selesai" : step.modules.includes(active) ? "Sedang dikerjakan" : !stageAllowed(index) ? "Nanti" : "Siap"}</small>
          </button>)}</nav>
          {progressError && <p role="alert">Status tahap belum dapat dimuat. {progressError}</p>}
          {(() => {
            const current = workflow.findIndex(step => step.modules.includes(active));
            if (current < 0 || !workflowBook) return null;
            return <div className="writing-stage-navigation">
              <p className="stage-guidance" role="status">{stageChecks[current].missing}</p>
              {current < 4 && <button type="button" className="primary-button" disabled={!stageAllowed(current + 1)} onClick={() => openStage(current + 1)}>Berikutnya: {workflow[current + 1].name}</button>}
              {current < 4 && !stageAllowed(current + 1) && <p className="form-hint">Selesaikan tahap ini dulu. Urutannya Ide, lalu Rancang, lalu Tulis.</p>}
            </div>;
          })()}
        </>}
      </section>}

      {active === "Manajemen Akun" && role === "SUPERADMIN" ? <AccountManagement /> : active === "Percetakan" ? <PrintingWorkspace key={workflowBookId} initialBookId={workflowBookId} /> : active === "Petunjuk Penggunaan" ? <StudioUserGuide navigate={navigateTo} bookId={workflowBook?.id} role={role} /> : active === "Review Naskah" ? <ReviewerWorkspace initialBookId={workflowBookId} onSelectBook={id => navigateTo("Review Naskah", id)} onNavigate={navigateTo} /> : active === "Buat Buku" ? <><div className="studio-page-intro"><h1 className="page-title">Buat buku baru</h1><p className="page-sub">Judul dan bidang cukup untuk memulai. Gagasan lengkapnya menyusul di Ide.</p></div><BlankBookForm onCreated={created => { setWorkflowBookId(created.id); void refresh(); navigateTo("Proyek Buku", created.id); }} /></> : active === "Dasbor" ? <section className="studio-home" aria-label="Beranda studio">
        <header className="studio-masthead">
          <div>
            <p className="studio-kicker">Bahasa Cerdas · {roleCaption(role)}</p>
            <h1 className="page-title">{homeCopy.title}</h1>
            <p className="page-sub">{homeCopy.lead}</p>
          </div>
          <div className="studio-office-links">
            <button type="button" className="primary-button" onClick={() => navigateTo("Buat Buku")}>Buat Buku Baru</button>
            {role === "SUPERADMIN" && <button type="button" className="secondary-button" onClick={() => navigateTo("Manajemen Akun")}>Kelola akun</button>}
            {(role === "ADMIN" || role === "SUPERADMIN") && <button type="button" className="secondary-button" onClick={() => navigateTo("ISBN & Legalitas")}>Kantor penerbit</button>}
            {(role === "REVIEWER" || role === "ADMIN") && <button type="button" className="secondary-button" onClick={() => navigateTo("Review Naskah")}>Antrean review</button>}
          </div>
        </header>
        {focusBook && focusAction && <article className="studio-hero">
          <p className="studio-kicker">Sekarang</p>
          <h2>{focusBook.title}</h2>
          <ol className="studio-rail" aria-label="Tahap naskah">{STAGE_PATH.map((step, index) => <li key={step.name} className={index === focusAction.stageIndex ? "is-current" : index < focusAction.stageIndex ? "is-done" : "is-ahead"} aria-current={index === focusAction.stageIndex ? "step" : undefined}>{step.name}</li>)}</ol>
          <p>{focusAction.detail}</p>
          <button type="button" className="primary-button" onClick={() => navigateTo(focusAction.module, focusBook.id)}>{focusAction.label}</button>
        </article>}
        {decisions.length > 0 && role !== "REVIEWER" && <section className="studio-queue" aria-label="Keputusan yang menunggu"><h2>Menunggu keputusan Anda</h2><div className="studio-book-list">{decisions.map(book => <button key={book.id} type="button" className="secondary-button" onClick={() => navigateTo("Review Naskah", book.id)}>{book.title}</button>)}</div></section>}
        <div className="section-head"><h2>Di meja Anda</h2><span>{loading ? "Memuat…" : books.length + " naskah"}</span></div>
        {booksError && <p role="alert">{booksError}</p>}
        {!loading && !books.length && <p className="panel studio-empty">Belum ada naskah. Kalimat pertama dimulai dari sebuah judul.</p>}
        <div className="studio-book-list">{books.map(book => {
          const action = bookWorkspaceAction(role, book);
          const stageName = STAGE_PATH[action.stageIndex]?.name || "Ide";
          return <article key={book.id} className="panel studio-book-row"><div><span className="studio-stage-pill">{stageName}</span><strong>{book.title}</strong><p>{book.isOwner === false ? "Penugasan" : "Milik Anda"} · {book.status === "DRAFT" ? "Draf" : book.status === "REVIEW" ? "Sedang ditinjau" : "Disetujui"}</p><p>{action.detail}</p></div><button type="button" className="secondary-button" onClick={() => navigateTo(action.module, book.id)}>{action.label}</button></article>;
        })}</div>
      </section> : <>
        {active === "ISBN & Legalitas" && (role === "ADMIN" || role === "SUPERADMIN") && <IsbnOfficeDashboard />}
        {!bookModules.includes(active) && active !== "ISBN & Legalitas" && <><div className="studio-page-intro"><h1 className="page-title">{active}</h1><p className="page-sub">Catatan tahap ini tersimpan terpisah. Naskah buku ada di Ide, Rancang, dan Tulis.</p></div><StudioWorkspace active={active} /></>}
      </>}

      {active === "Tata Letak" && <section className="panel" aria-labelledby="layout-work-title">
        <h2 id="layout-work-title" className="panel-title">Tata letak</h2>
        <p>Editor tata letak terbuka setelah naskah disetujui. Sebelum itu, pratinjau format tetap bertanda draf.</p>
        <div className="layout-format-tabs" aria-label="Tampilan Tata Letak">
          <button type="button" className={layoutView === "editor" ? "primary-button" : "secondary-button"} aria-pressed={layoutView === "editor"} onClick={() => setLayoutView("editor")}>Editor tata letak</button>
          <button type="button" className={layoutView === "formats" ? "primary-button" : "secondary-button"} aria-pressed={layoutView === "formats"} onClick={() => setLayoutView("formats")}>Pratinjau format</button>
        </div>
      </section>}
      <div hidden={!bookModules.includes(active)}><BetaWorkspace actorRole={role} selectedBookId={workflowBookId} onSelected={bookId => {
        setWorkflowBookId(bookId);
        const url = new URL(window.location.href);
        url.searchParams.set("bookId", bookId);
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }} active={active} layoutView={layoutView} onNavigate={(module, projectId) => { if (projectId) setWorkflowBookId(projectId); navigateTo(module, projectId); }} onChanged={refresh} books={books} error={booksError} loading={loading} /></div>
    </main>
  </div>;
}
