import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, BookOpen, ClipboardCheck, LayoutList, Lightbulb, PenLine, Printer, ShieldCheck } from "lucide-react";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "BC Book Studio | Dari Ide hingga Terbit",
  description: "Kelola proyek buku dalam lima tahap: Ide, Rancang, Tulis, Review, dan Terbit.",
};

const stages = [
  { name: "Ide", icon: Lightbulb, modules: "Proyek Buku · Idea Lab", description: "Tentukan pembaca sasaran, tujuan penulisan, dan sinopsis sebagai dasar proyek buku." },
  { name: "Rancang", icon: LayoutList, modules: "Rancang · Kurikulum", description: "Susun urutan bab dan tujuan tiap bab. Untuk buku pembelajaran, petakan materi ke kurikulum yang digunakan." },
  { name: "Tulis", icon: PenLine, modules: "Studio Penulisan · Studio Latihan · Studio Visual", description: "Kembangkan isi bab, latihan, dan ilustrasi. Gunakan bantuan AI bila diperlukan, lalu periksa dan sunting hasilnya." },
  { name: "Review", icon: ClipboardCheck, modules: "Penyuntingan · Review Naskah", description: "Sunting naskah, lengkapi pemeriksaan editorial, dan ajukan naskah kepada peninjau yang berbeda dari penulis." },
  { name: "Terbit", icon: BookOpen, modules: "Tata Letak · Penerbitan", description: "Setelah naskah disetujui, atur tata letak, periksa pratinjau, lalu siapkan ekspor atau publikasi." },
];

function Brand() {
  return <Link className={styles.brand} href="/"><span><BookOpen size={22} aria-hidden="true" /></span>BC Book Studio</Link>;
}

export default function Home() {
  return (
    <div className={styles.site}>
      <a className={styles.skip} href="#konten">Lewati ke konten</a>
      <header className={styles.header}>
        <div className={styles.navbar}>
          <Brand />
          <nav aria-label="Navigasi utama">
            <a href="#alur">Alur kerja</a>
            <a href="#produksi">Produksi buku</a>
            <Link href="/login">Masuk <ArrowRight size={16} aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="konten" tabIndex={-1} className={styles.main}>
        <section className={styles.hero} aria-labelledby="judul">
          <div>
            <p className={styles.kicker}>Studio editorial Bahasa Cerdas</p>
            <h1 id="judul">Dari ide hingga <em>buku terbit.</em></h1>
            <p className={styles.intro}>Kelola naskah, peninjauan editorial, dan persiapan penerbitan dalam satu proyek buku. Dirancang untuk penulis, pendidik, dan tim penerbitan.</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/login">Masuk ke Studio <ArrowRight size={18} aria-hidden="true" /></Link>
              <a className={styles.secondary} href="#alur">Lihat alur kerja <ArrowDown size={17} aria-hidden="true" /></a>
            </div>
          </div>

          <div className={styles.scene} aria-hidden="true">
            <div className={styles.spread}>
              <div className={styles.cover}>
                <span>BC BOOK STUDIO</span>
                <div className={styles.coverLines}><i /><i /><i /></div>
                <strong>Proyek<br />Buku</strong>
                <BookOpen size={24} strokeWidth={1.5} />
              </div>
              <div className={styles.proof}>
                <span>ALUR EDITORIAL</span>
                {stages.map(({ name, icon: Icon }) => <div key={name}><Icon size={17} strokeWidth={1.7} />{name}</div>)}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="alur" aria-labelledby="judul-alur">
          <div className={styles.sectionHeading}>
            <h2 id="judul-alur">Lima tahap dalam satu proyek</h2>
          </div>
          <ol className={styles.timeline}>
            {stages.map(({ name, icon: Icon, modules, description }, index) => (
              <li key={name}>
                <span className={styles.stepIcon}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <h3><span className={styles.number} aria-hidden="true">{index + 1}.</span> {name}</h3>
                <p className={styles.modules}>{modules}</p>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} id="produksi" aria-labelledby="judul-produksi">
          <div className={styles.sectionHeading}>
            <h2 id="judul-produksi">Persiapan produksi dan penerbitan</h2>
            <p>Gunakan modul pendukung sesuai kebutuhan buku dan hak akses tim Anda.</p>
          </div>
          <div className={styles.production}>
            <article>
              <Printer size={26} strokeWidth={1.7} aria-hidden="true" />
              <h3>Percetakan</h3>
              <p>Catat spesifikasi cetak, penawaran mitra, estimasi biaya, dan progres produksi. Unduh spesifikasi untuk dibagikan kepada percetakan.</p>
            </article>
            <article>
              <ShieldCheck size={26} strokeWidth={1.7} aria-hidden="true" />
              <h3>ISBN &amp; Legalitas</h3>
              <p>Administrator penerbit dapat menyiapkan dokumen per edisi dan mencatat status pengajuan ISBN ke Perpusnas.</p>
            </article>
          </div>
        </section>

        <section className={styles.callout} aria-labelledby="judul-akses">
          <div>
            <h2 id="judul-akses">Siap membuka ruang kerja?</h2>
            <p>Masuk dengan akun studio, atau gunakan undangan untuk mengaktifkan akun Anda.</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/login">Masuk ke Studio <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className={styles.secondary} href="/activate">Aktivasi Akun</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Brand />
        <nav aria-label="Tautan bantuan">
          <Link href="/forgot-password">Lupa kata sandi</Link>
          <Link href="/syarat-ketentuan">Syarat dan Ketentuan</Link>
          <a href="https://www.bahasacerdas.com/">Bahasa Cerdas</a>
        </nav>
      </footer>
    </div>
  );
}
