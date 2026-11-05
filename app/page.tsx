"use client";
import {useRef,type MouseEvent} from "react";
const features=[
 {icon:"✦",title:"Ruang menulis terpadu",desc:"Susun buku, atur bab, dan kembangkan naskah dalam ruang editorial yang fokus."},
 {icon:"◈",title:"Asisten pembuatan draf",desc:"Mulai dari topik dan tujuan pembelajaran, lalu tinjau serta sunting hasilnya."},
 {icon:"✓",title:"Alur editorial tertata",desc:"Kirim naskah untuk review, lakukan persetujuan, dan kelola revisi secara jelas."},
 {icon:"▤",title:"Ekspor untuk penerbitan",desc:"Siapkan keluaran PDF dan EPUB setelah naskah melewati tahap persetujuan."},
 {icon:"☼",title:"Light & dark menyeluruh",desc:"Preferensi tampilan tersimpan dan diterapkan konsisten pada seluruh halaman."},
 {icon:"◇",title:"Akses yang terkontrol",desc:"Area studio dilindungi autentikasi, dengan persetujuan editorial tersendiri."},
];
function TiltCard({icon,title,desc}:{icon:string;title:string;desc:string}){
 const node=useRef<HTMLElement>(null);
 function move(event:MouseEvent<HTMLElement>){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const box=event.currentTarget.getBoundingClientRect(),x=(event.clientX-box.left)/box.width-.5,y=(event.clientY-box.top)/box.height-.5;
  event.currentTarget.style.setProperty("--rx",String(-y*8)+"deg");
  event.currentTarget.style.setProperty("--ry",String(x*8)+"deg");
 }
 function reset(){node.current?.style.setProperty("--rx","0deg");node.current?.style.setProperty("--ry","0deg")}
 return <article ref={node} className="tilt-card" onMouseMove={move} onMouseLeave={reset}><div className="feature-icon" aria-hidden="true">{icon}</div><h3>{title}</h3><p>{desc}</p></article>;
}
export default function LandingPage(){return <main className="landing">
 <div className="landing-container">
  <nav className="landing-nav" aria-label="Navigasi utama"><a className="brand" href="/" style={{textDecoration:"none"}}><span className="brand-mark">B</span>BC Book Studio</a><div className="landing-links"><a href="#fitur">Fitur</a><a href="/login">Login</a><a href="/studio">Studio</a></div></nav>
  <section className="hero" aria-labelledby="hero-title">
   <div><span className="eyebrow">Bahasa Cerdas · Digital Publishing Workspace</span><h1 id="hero-title">Buku hebat dimulai dari <span className="gradient-text">ide yang berani.</span></h1><p className="lead">Satu ruang kreatif untuk menulis, mengembangkan, meninjau, dan menyiapkan buku berkualitas. Dirancang untuk tim pendidikan dan penerbitan modern.</p><div className="actions"><a className="action-primary" href="/studio">Buka Studio →</a><a className="action-secondary" href="#fitur">Jelajahi fitur</a></div></div>
   <div className="book-scene" aria-label="Ilustrasi buku tiga dimensi interaktif"><div className="book-art"><div className="orbit"/><div className="book-spine"/><div className="book-cover"><p>BC Book Studio</p><h2>Ideas into<br/>Impact.</h2><p>Create · Review · Publish</p></div><span className="spark spark-one">✦ Creative Space</span><span className="spark spark-two">✓ Editorial Ready</span></div></div>
  </section>
  <section className="features" id="fitur" aria-labelledby="features-title"><h2 className="section-title" id="features-title">Semua alat dalam satu studio.</h2><p className="section-intro">Dari halaman pertama hingga manuskrip siap diterbitkan, bekerja lebih terstruktur dalam suasana yang inspiratif.</p><div className="feature-grid">{features.map(x=><TiltCard key={x.title} {...x}/>)}</div></section>
 </div><footer className="landing-footer">© {new Date().getFullYear()} Bahasa Cerdas · BC Book Studio · Dibangun untuk kreativitas dan pendidikan.</footer>
 </main>;}
