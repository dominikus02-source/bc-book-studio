"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AuthPanel({mode}:{mode:"login"|"activate"|"forgot-password"|"reset-password"}){
 const params=useSearchParams();
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const token=params.get("token")||"";
 const titles={
  login:"Masuk ke studio",
  activate:token?"Buat kata sandi":"Aktivasi akun",
  "forgot-password":"Lupa kata sandi",
  "reset-password":token?"Kata sandi baru":"Tautan belum ada",
 };
 const descriptions={
  login:"Akun dibuka lewat undangan pengelola studio. Halaman ini tidak menyediakan pendaftaran umum.",
  activate:token?"Kata sandi minimal 12 karakter dan paling banyak 128. Tautan aktivasi berlaku 30 menit dan hanya sekali.":"Masukkan email yang diundang pengelola studio. Jika akun itu ada dan belum aktif, tautan aktivasi dikirim. Tautan berlaku 30 menit.",
  "forgot-password":"Untuk akun yang sudah aktif, tautan pengaturan ulang dikirim ke email. Tautan berlaku 30 menit dan hanya sekali. Akun yang belum aktif memakai halaman aktivasi.",
  "reset-password":token?"Minimal 12 karakter. Setelah kata sandi disimpan, sesi lama pada akun ini berakhir. Lanjutkan dari halaman Masuk.":"Buka tautan dari email pemulihan, atau minta tautan baru. Studio tidak menampilkan apakah sebuah email terdaftar.",
 };
 const endpoint=mode==="activate"&&!token?"request-activation":mode;
 async function submit(e:FormEvent){
  e.preventDefault();
  setBusy(true);setError("");setMessage("");
  try{
   const payload=mode==="login"?{email,password}:mode==="forgot-password"||(mode==="activate"&&!token)?{email}:{token,password};
   const r=await fetch("/api/auth/"+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   if (!r.headers.get("content-type")?.includes("application/json")) throw Error("Layanan akun sementara tidak tersedia. Coba kembali nanti.");
   const d=await r.json();
   if(!r.ok)throw Error(d.error||"Terjadi kesalahan.");
   if(mode==="login"){
    if(d.redirect==="/reviewer"){window.location.assign("/reviewer");return;}
    const requested=params.get("module");
    const allowed=["Dasbor","Proyek Buku","Buat Buku","Idea Lab","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Tinjauan Pedagogis","Tata Letak","Penerbitan","Pusat Agen","Pengaturan"];
    window.location.assign(requested&&allowed.includes(requested)?"/studio?module="+encodeURIComponent(requested):"/studio");
    return;
   }
   setMessage(d.message||"Jika alamat email terdaftar, instruksi akan dikirim.");
  }catch(err){
   setError(err instanceof Error?err.message:"Gagal memproses permintaan.");
  }finally{
   setBusy(false);
  }
 }
 const requiresEmail=mode==="login"||mode==="forgot-password"||(mode==="activate"&&!token);
 const requiresPass=mode==="login"||mode==="reset-password"||(mode==="activate"&&!!token);
 const missingResetToken=mode==="reset-password"&&!token;
 const passwordSaved=Boolean(message)&&(mode==="reset-password"||(mode==="activate"&&!!token));
 const submitLabel=busy?"Memproses...":mode==="login"?"Masuk ke studio":mode==="activate"?(token?"Simpan kata sandi":"Kirim email aktivasi"):mode==="forgot-password"?"Kirim tautan pemulihan":"Simpan kata sandi";
 return <main className="lp-auth">
  <p className="lp-kicker">PT Bahasa Cerdas Indonesia</p>
  <h1>{titles[mode]}</h1>
  <p className="lp-lede">{descriptions[mode]}</p>
  {missingResetToken?<div className="lp-auth-card"><p>Halaman ini menunggu tautan dari email. Tanpa tautan, kata sandi tidak dapat diubah dari sini.</p><div className="lp-auth-links"><Link href="/forgot-password">Minta tautan pemulihan</Link><Link href="/login">Masuk</Link></div></div>:<form className="lp-auth-card lp-form" onSubmit={submit}>
   {requiresEmail&&<div className="lp-field"><label htmlFor="lp-email">Alamat email</label><input id="lp-email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} aria-invalid={error?true:undefined}/></div>}
   {requiresPass&&<div className="lp-field"><label htmlFor="lp-password">Kata sandi</label><div className="lp-pass"><input id="lp-password" type={showPassword?"text":"password"} minLength={mode==="login"?1:12} maxLength={128} required autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} aria-invalid={error?true:undefined}/><button type="button" className="lp-reveal" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?"Sembunyikan":"Tampilkan"}</button></div></div>}
   <button className="lp-button" disabled={busy||(mode==="activate"&&!!token&&!password)} type="submit">{submitLabel}</button>
   {error&&<p className="lp-form-error" role="alert">{error}</p>}
   {message&&<p className="lp-form-success" role="status">{message}</p>}
   {passwordSaved&&<div className="lp-auth-links"><Link href="/login">Masuk ke studio</Link></div>}
   {!passwordSaved&&(mode==="forgot-password"||(mode==="activate"&&!token))&&<p className="lp-note">Jika alamat itu tidak memenuhi syarat, studio tetap menampilkan jawaban yang sama dan tidak memberitahu apakah email terdaftar.</p>}
  </form>}
  <nav className="lp-auth-links" aria-label="Halaman akun lain">
   {mode!=="login"&&<Link href="/login">Masuk</Link>}
   {mode!=="activate"&&<Link href="/activate">Aktivasi akun</Link>}
   {mode!=="forgot-password"&&<Link href="/forgot-password">Lupa kata sandi</Link>}
   <Link href="/syarat-ketentuan">Syarat dan Ketentuan</Link>
   <Link href="/">Beranda</Link>
  </nav>
 </main>;
}
