"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import ThemeControl from "./theme-control";

export default function PublicNavigation() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return <nav className="topbar public-topbar" aria-label="Navigasi utama" ref={nav}>
    <Link href="/" className="brand" aria-label="BC Book Studio — Beranda"><span className="brand-icon" aria-hidden="true">✦</span><span>BC <b>BOOK STUDIO</b><small>BY BAHASA CERDAS</small></span></Link>
    <div className="nav-actions"><ThemeControl /><Link className="nav-login" href="/login">Login</Link><Link className="btn btn-sm" href="/activate">Aktivasi Akun <span aria-hidden="true">↗</span></Link><button ref={toggle} type="button" className="public-menu-toggle" aria-label={open ? "Tutup menu" : "Buka menu"} aria-controls="public-links" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button></div>
    <div id="public-links" className={`nav-items public-links${open ? " is-open" : ""}`} onClick={() => setOpen(false)}><a href="#fitur">Fitur</a><a href="#alur">Cara kerja</a><a href="#tentang">Tentang</a><Link href="/progress">Progres Lokal</Link></div>
  </nav>;
}
