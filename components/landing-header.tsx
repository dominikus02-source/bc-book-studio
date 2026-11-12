"use client";

import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "@/components/theme-toggle";

const links = [
  ["#alur", "Alur"],
  ["#kerja", "Pekerjaan"],
  ["#ekspor", "Ekspor"],
  ["#penerbit", "Penerbit"],
] as const;

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="lp-header">
      <div className="lp-header-bar">
        <Link href="/" className="lp-brand" onClick={close}>
          <span className="lp-mark" aria-hidden="true">BC</span>
          <span>
            <strong>BC Book Studio</strong>
            <small>Bahasa Cerdas</small>
          </span>
        </Link>
        <div className="lp-tools">
          <ThemeToggle />
          <button
            type="button"
            className="lp-menu"
            aria-expanded={open}
            aria-controls="lp-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Tutup" : "Menu"}
          </button>
        </div>
        <nav id="lp-nav" className={open ? "lp-nav is-open" : "lp-nav"} aria-label="Utama">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={close}>{label}</a>
          ))}
          <Link href="/login" className="lp-login" onClick={close}>Masuk</Link>
          <Link href="/activate" className="lp-button" onClick={close}>Aktivasi akun</Link>
        </nav>
      </div>
    </header>
  );
}
