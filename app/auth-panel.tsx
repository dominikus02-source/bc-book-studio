"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./auth-panel.module.css";

const REMEMBERED_EMAIL = "bcstudio.login.email";
export default function AuthPanel({mode}:{mode:"login"|"activate"|"forgot-password"|"reset-password"}){
 const params=useSearchParams();
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [showPassword,setShowPassword]=useState(false),[rememberEmail,setRememberEmail]=useState(false);
 useEffect(()=>{
  setShowPassword(false);
  if(mode!=="login")return;
  try{
   const remembered=localStorage.getItem(REMEMBERED_EMAIL);
   if(remembered){setEmail(remembered);setRememberEmail(true);}
  }catch{/* Browser storage can be disabled. Login remains available. */}
 },[mode]);
 const token=params.get("token")||"";
 const titles={login:"Selamat datang kembali",activate:token?"Aktifkan akunmu":"Mulai dengan aktivasi akun","forgot-password":"Pulihkan akses akun","reset-password":"Buat kata sandi baru"};
 const descriptions={login:"Masuk dan lanjutkan perjalanan kreatifmu di BC Book Studio.",activate:token?"Satu langkah lagi untuk membuka ruang berkaryamu.":"Masukkan email akun yang diundang oleh pengelola studio.","forgot-password":"Kami akan mengirimkan tautan pemulihan ke email terdaftarmu.","reset-password":"Gunakan kata sandi baru minimal 12 karakter."};
 const endpoint=mode==="activate"&&!token?"request-activation":mode;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  // Read actual form values so browser/password-manager autofill is included.
  const fields=new FormData(e.currentTarget);
  const submittedEmail=String(fields.get("email")||"").trim();
  const submittedPassword=String(fields.get("password")||"");
  try{
   const payload=mode==="login"?{email:submittedEmail,password:submittedPassword}:mode==="forgot-password"||(mode==="activate"&&!token)?{email:submittedEmail}:{token,password:submittedPassword};
   const r=await fetch("/api/auth/"+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Terjadi kesalahan.");
   if(mode==="login"){
    try{
     if(rememberEmail)localStorage.setItem(REMEMBERED_EMAIL,submittedEmail);
     else localStorage.removeItem(REMEMBERED_EMAIL);
    }catch{/* Passwords are saved only by the browser password manager. */}
    window.location.replace("/studio");return;
   }
   setPassword("");setShowPassword(false);
   setMessage(d.message||"Jika email terdaftar, instruksi akan dikirim.");
  }catch(err){setShowPassword(false);setError(err instanceof Error?err.message:"Gagal memproses permintaan.");}finally{setBusy(false);}
 }
 const requiresEmail=mode==="login"||mode==="forgot-password"||(mode==="activate"&&!token);
 const requiresPass=mode==="login"||mode==="reset-password"||(mode==="activate"&&!!token);
 return <main className="auth-screen">
  <Link className="auth-logo" href="/"><span className="logo-mark">✦</span> BC <b>Book Studio</b></Link>
  <div className="auth-card">
   <span className="eyebrow">BAHASA CERDAS • BOOK STUDIO</span>
   <h1>{titles[mode]}</h1><p>{descriptions[mode]}</p>
   <form onSubmit={submit} method="post" autoComplete="on">
    {requiresEmail&&<label htmlFor="account-email">Alamat email
     <input id="account-email" name="email" type="email" inputMode="email" required autoComplete={mode==="login"?"username":"email"} autoCapitalize="none" spellCheck={false} placeholder="nama@sekolah.sch.id" value={email} onChange={e=>setEmail(e.target.value)}/>
    </label>}
    {requiresPass&&<div className={styles.passwordGroup}>
     <label htmlFor="account-password">Kata sandi</label>
     <div className={styles.passwordField}>
      <input id="account-password" name="password" type={showPassword?"text":"password"} minLength={mode==="login"?1:12} required autoComplete={mode==="login"?"current-password":"new-password"} placeholder="••••••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
      <button className={styles.toggle} type="button" aria-label={showPassword?"Sembunyikan kata sandi":"Tampilkan kata sandi"} aria-pressed={showPassword} aria-controls="account-password" title={showPassword?"Sembunyikan kata sandi":"Tampilkan kata sandi"} onClick={()=>setShowPassword(v=>!v)}>
       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {showPassword?<><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3 4M6.5 6.5A17 17 0 0 0 2 12s3 7 10 7a11 11 0 0 0 5.5-1.5"/></>:<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>}
       </svg>
      </button>
     </div>
    </div>}
    {mode==="login"&&<div className={styles.rememberGroup}>
     <label className={styles.remember} htmlFor="remember-email">
      <input id="remember-email" name="rememberEmail" type="checkbox" checked={rememberEmail} onChange={e=>{setRememberEmail(e.target.checked);if(!e.target.checked){try{localStorage.removeItem(REMEMBERED_EMAIL);}catch{}}}}/>
      <span>Ingat email saya di perangkat ini</span>
     </label>
     <p className={styles.hint}>Untuk menyimpan email dan kata sandi, pilih “Simpan” pada pengelola sandi browser setelah berhasil masuk. Gunakan hanya di perangkat pribadi.</p>
    </div>}
    <button disabled={busy||(mode==="activate"&&!!token&&!password)} type="submit">{busy?"Memproses...":mode==="login"?"Masuk ke Studio":mode==="activate"?(token?"Aktifkan sekarang":"Kirim email aktivasi"):mode==="forgot-password"?"Kirim tautan pemulihan":"Simpan kata sandi"} <span>→</span></button>
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-success" role="status">{message}</p>}
   </form>
   <div className="auth-links"><Link href="/login">Login</Link><Link href="/activate">Aktivasi</Link><Link href="/forgot-password">Lupa password?</Link></div>
  </div>
  <p className="auth-bottom">Terhubung dengan ekosistem <strong>Bahasa Cerdas</strong> • Akun dilindungi</p>
 </main>;
}
