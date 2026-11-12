"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/theme-toggle";

const links = [
  ["/", "Beranda"],
  ["/login", "Masuk"],
  ["/activate", "Aktivasi"],
  ["/forgot-password", "Lupa kata sandi"],
  ["/syarat-ketentuan", "Syarat dan Ketentuan"],
] as const;

export default function PublicHeader() {
  const pathname = usePathname();
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
            aria-controls="lp-public-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Tutup" : "Menu"}
          </button>
        </div>
        <nav id="lp-public-nav" className={open ? "lp-nav is-open" : "lp-nav"} aria-label="Halaman publik">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={close}>{label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
