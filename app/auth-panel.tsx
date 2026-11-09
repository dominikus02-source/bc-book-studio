"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
export default function AuthPanel({mode}:{mode:"login"|"activate"|"forgot-password"|"reset-password"}){
 const params=useSearchParams();
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const token=params.get("token")||"";
 const titles={login:"Selamat datang kembali",activate:token?"Aktifkan akunmu":"Mulai dengan aktivasi akun","forgot-password":"Pulihkan akses akun","reset-password":"Buat kata sandi baru"};
 const descriptions={login:"Masuk dan lanjutkan perjalanan kreatifmu di BC Book Studio.",activate:token?"Satu langkah lagi untuk membuka ruang berkaryamu.":"Masukkan email akun yang diundang oleh pengelola studio.","forgot-password":"Kami akan mengirimkan tautan pemulihan ke email terdaftarmu.","reset-password":"Gunakan kata sandi baru minimal 12 karakter."};
 const endpoint=mode==="activate"&&!token?"request-activation":mode;
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");
  try{const payload=mode==="login"?{email,password}:mode==="forgot-password"||(mode==="activate"&&!token)?{email}:{token,password};
   const r=await fetch("/api/auth/"+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Terjadi kesalahan.");
   if(mode==="login"){
    const requested=params.get("module");
    const allowed=["Dasbor","Proyek Buku","Buat Buku","Idea Lab","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Tinjauan Pedagogis","Tata Letak","Penerbitan","Pusat Agen","Pengaturan"];
    window.location.assign(requested&&allowed.includes(requested)?"/studio?module="+encodeURIComponent(requested):"/studio");
    return;
   }
   setMessage(d.message||"Jika email terdaftar, instruksi akan dikirim.");
  }catch(err){setError(err instanceof Error?err.message:"Gagal memproses permintaan.");}finally{setBusy(false);}
 }
 const requiresEmail=mode==="login"||mode==="forgot-password"||(mode==="activate"&&!token);
 const requiresPass=mode==="login"||mode==="reset-password"||(mode==="activate"&&!!token);
 return <main className="auth-screen"><Link className="auth-logo" href="/"><span className="logo-mark">✦</span> BC <b>Book Studio</b></Link><div className="auth-card"><span className="eyebrow">BAHASA CERDAS • BOOK STUDIO</span><h1>{titles[mode]}</h1><p>{descriptions[mode]}</p><form onSubmit={submit} aria-busy={busy} aria-describedby={error?"auth-error":message?"auth-success":undefined}>{requiresEmail&&<label>Alamat email<input type="email" required autoComplete="email" placeholder="nama@sekolah.sch.id" value={email} onChange={e=>setEmail(e.target.value)}/></label>}{requiresPass&&<div className="auth-password-group"><label htmlFor="auth-password">Kata sandi</label><div className="password-field"><input id="auth-password" type={showPassword?"text":"password"} minLength={mode==="login"?1:12} required autoComplete={mode==="login"?"current-password":"new-password"} placeholder="••••••••••••" value={password} onChange={e=>setPassword(e.target.value)}/><button className="password-toggle" type="button" aria-controls="auth-password" aria-label={showPassword?"Sembunyikan kata sandi":"Tampilkan kata sandi"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?"Sembunyikan":"Tampilkan"}</button></div></div>}<button disabled={busy||(mode==="activate"&&!!token&&!password)} type="submit">{busy?"Memproses...":mode==="login"?"Masuk ke Studio":mode==="activate"?(token?"Aktifkan sekarang":"Kirim email aktivasi"):mode==="forgot-password"?"Kirim tautan pemulihan":"Simpan kata sandi"} <span>→</span></button>{error&&<p id="auth-error" className="form-error" role="alert">{error}</p>}{message&&<p id="auth-success" className="form-success" role="status">{message}</p>}</form><div className="auth-links"><Link href="/login">Login</Link><Link href="/activate">Aktivasi</Link><Link href="/forgot-password">Lupa password?</Link></div></div><p className="auth-bottom">Terhubung dengan ekosistem <strong>Bahasa Cerdas</strong> • Akun dilindungi</p></main>;
}
