"use client";

import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Mode = "login" | "activate" | "forgot-password" | "reset-password";

export default function AuthPanel({mode}: {mode: Mode}) {
  const params = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const token = params.get("token") || "";
  const titles = {
    login: "Selamat datang kembali",
    activate: token ? "Aktifkan akun Anda" : "Aktivasi akun",
    "forgot-password": "Pulihkan akses akun",
    "reset-password": "Buat kata sandi baru",
  };
  const descriptions = {
    login: "Masuk untuk melanjutkan pekerjaan Anda di BC Book Studio.",
    activate: token ? "Tetapkan kata sandi minimal 12 karakter." : "Masukkan alamat email yang telah diundang oleh pengelola studio.",
    "forgot-password": "Masukkan alamat email terdaftar untuk menerima tautan pemulihan.",
    "reset-password": "Gunakan kata sandi baru minimal 12 karakter.",
  };
  const endpoint = mode === "activate" && !token ? "request-activation" : mode;
  const requiresEmail = mode === "login" || mode === "forgot-password" || (mode === "activate" && !token);
  const requiresPass = mode === "login" || mode === "reset-password" || (mode === "activate" && !!token);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "");
    const password = String(fields.get("password") ?? "");
    const payload = mode === "login" ? {email, password} : requiresEmail ? {email} : {token, password};
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/" + endpoint, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw Error("Layanan akun sementara tidak tersedia. Coba kembali nanti.");
      }
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Terjadi kesalahan.");
      if (mode === "login") {
        if (data.redirect === "/reviewer") {
          window.location.assign("/reviewer");
          return;
        }
        const requested = params.get("module");
        const allowed = ["Dasbor", "Proyek Buku", "Buat Buku", "Idea Lab", "Kurikulum", "Studio Penulisan", "Studio Latihan", "Studio Visual", "Penyuntingan", "Tinjauan Pedagogis", "Tata Letak", "Penerbitan", "Pusat Agen", "Pengaturan", "Manajemen Akun"];
        window.location.assign(requested && allowed.includes(requested) ? "/studio?module=" + encodeURIComponent(requested) : "/studio");
        return;
      }
      setMessage(data.message || "Jika email terdaftar, instruksi akan dikirim.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses permintaan.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <Link className="auth-logo" href="/"><span className="logo-mark">✦</span> BC <b>Book Studio</b></Link>
    <div className="auth-card">
      <span className="eyebrow">BAHASA CERDAS · BOOK STUDIO</span>
      <h1>{titles[mode]}</h1><p>{descriptions[mode]}</p>
      <form onSubmit={submit} autoComplete="on">
        {requiresEmail && <label>Alamat email<input name="email" type="email" required autoComplete={mode === "login" ? "username" : "email"} placeholder="nama@sekolah.sch.id" /></label>}
        {requiresPass && <div className="auth-password-field">
          <label htmlFor="account-password">Kata sandi</label>
          <div className="auth-password-input">
            <input id="account-password" name="password" type={visible ? "text" : "password"} minLength={mode === "login" ? 1 : 12} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button type="button" className="auth-password-toggle" aria-label={visible ? "Sembunyikan kata sandi" : "Lihat kata sandi"} aria-controls="account-password" onClick={() => setVisible(previous => !previous)}>
              {visible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
            </button>
          </div>
        </div>}
        <button disabled={busy} type="submit">{busy ? "Memproses…" : mode === "login" ? "Masuk ke Studio" : mode === "activate" ? (token ? "Aktifkan sekarang" : "Kirim email aktivasi") : mode === "forgot-password" ? "Kirim tautan pemulihan" : "Simpan kata sandi"}</button>
        {mode === "login" && <p className="auth-autofill-hint">Gunakan pengelola kata sandi browser untuk menyimpan dan mengisi akun secara otomatis.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
      </form>
      <div className="auth-links"><Link href="/login">Login</Link><Link href="/activate">Aktivasi</Link><Link href="/forgot-password">Lupa password?</Link></div>
    </div>
    <p className="auth-bottom">Terhubung dengan ekosistem <strong>Bahasa Cerdas</strong></p>
  </main>;
}
