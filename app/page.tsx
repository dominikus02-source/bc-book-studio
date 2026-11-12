import type { Metadata } from "next";
import Link from "next/link";
import LandingHeader from "@/components/landing-header";
import "./landing.css";

export const metadata: Metadata = {
  title: "BC Book Studio — Ruang kerja naskah PT Bahasa Cerdas Indonesia",
  description:
    "Studio internal untuk menyusun, meninjau, dan menyiapkan berkas buku pelajaran. Lima tahap: Ide, Rancang, Tulis, Review, dan Terbit. PDF, DOCX, EPUB, HTML, dan flipbook. Aplikasi ini tidak menerbitkan ISBN.",
};

const stages = [
  {
    name: "Ide",
    detail: "Catat judul, bidang, jenjang, penulis, pembaca sasaran, dan tujuan. Brief tersimpan pada proyek buku yang sama.",
  },
  {
    name: "Rancang",
    detail: "Susun urutan bab dan tujuan belajar. Kerangka bisa diubah, diurutkan, lalu dibuka kembali sebelum naskah diisi.",
  },
  {
    name: "Tulis",
    detail: "Isi bab di studio penulisan. Latihan, rubrik, dan aset visual punya tempatnya. Bantuan AI, bila dipakai, hanya usulan yang harus diperiksa manusia.",
  },
  {
    name: "Review",
    detail: "Reviewer yang ditugaskan menulis catatan, lalu menyetujui atau mengembalikan naskah. Pemilik buku tidak menyetujui naskahnya sendiri.",
  },
  {
    name: "Terbit",
    detail: "Atur tata letak dan siapkan berkas. Sebelum ada persetujuan, unduhan adalah pratinjau draf. Setelah disetujui, ekspor memakai snapshot persetujuan.",
  },
];

const audiences = [
  {
    title: "Editor dan penulis naskah",
    text: "Brief, kerangka, bab, dan status simpan ada di satu proyek. Tahap berikutnya menyebut apa yang masih kurang, bukan hanya tombol lanjut.",
  },
  {
    title: "Reviewer yang ditugaskan",
    text: "Catatan, naskah, dan riwayat keputusan tersedia untuk buku yang menjadi tugas. Keputusan setuju atau kembalikan tercatat, bukan tanda selesai yang bisa dihapus diam-diam.",
  },
  {
    title: "Pengelola penerbit",
    text: "Admin menyiapkan daftar periksa ISBN dan catatan percetakan. Pengiriman ke portal Perpusnas dan ke vendor cetak tetap dilakukan di luar studio.",
  },
];

const formats = [
  { name: "PDF", text: "Mengikuti ukuran kertas yang dipilih, termasuk A4, A5, B5, 14×21 cm, dan 15×23 cm." },
  { name: "DOCX", text: "Naskah yang masih bisa disunting di pengolah kata, dengan judul dan isi bab." },
  { name: "EPUB", text: "Buku digital yang disusun ulang mengikuti layar pembaca, bukan halaman cetak yang dikunci." },
  { name: "HTML", text: "Bacaan di peramban, dengan struktur bab dari naskah yang sama." },
  { name: "Flipbook", text: "Tampilan baca HTML interaktif. Ini bukan pengganti PDF cetak." },
];

export default function Home() {
  return (
    <div className="lp">
      <a className="skip-link" href="#isi">Langsung ke isi</a>
      <LandingHeader />
      <main id="isi">
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-hero-copy">
            <p className="lp-kicker">PT Bahasa Cerdas Indonesia</p>
            <h1 id="lp-hero-title">Naskah buku pelajaran, dari ide sampai berkas yang siap diperiksa.</h1>
            <p className="lp-lede">
              BC Book Studio adalah meja kerja editor, penulis, dan reviewer. Satu buku berjalan lewat lima tahap—Ide, Rancang, Tulis, Review, dan Terbit—lalu disiapkan sebagai PDF, DOCX, EPUB, HTML, atau flipbook.
            </p>
            <div className="lp-actions">
              <Link href="/login" className="lp-button">Masuk ke studio</Link>
              <Link href="/activate" className="lp-button lp-button-quiet">Aktivasi akun</Link>
            </div>
            <p className="lp-note">Akun dibuka lewat undangan pengelola studio. Halaman ini tidak menyediakan pendaftaran umum.</p>
          </div>
          <figure className="lp-folio">
            <figcaption>Contoh susunan kerja di studio, bukan sampul buku yang diterbitkan.</figcaption>
            <p className="lp-folio-label">Lembar kerja</p>
            <ol>
              {stages.map((stage, index) => (
                <li key={stage.name}>
                  <span>0{index + 1}</span>
                  <strong>{stage.name}</strong>
                </li>
              ))}
            </ol>
            <div className="lp-slip">
              <p>Catatan reviewer</p>
              <strong>Menunggu keputusan</strong>
              <small>Setuju atau kembalikan dicatat oleh peninjau yang ditugaskan.</small>
            </div>
          </figure>
        </section>

        <section className="lp-band" aria-label="Siapa yang memakai studio">
          <p>Dipakai tim internal penerbit</p>
          <ul>
            <li>Editor naskah</li>
            <li>Penulis</li>
            <li>Reviewer</li>
            <li>Pengelola penerbit</li>
          </ul>
        </section>

        <section className="lp-section" id="kerja" aria-labelledby="lp-kerja-title">
          <div className="lp-section-head">
            <p className="lp-kicker">Pekerjaan harian</p>
            <h2 id="lp-kerja-title">Yang berpindah dari meja sunting ke dalam studio</h2>
            <p>Bukan janji buku jadi dalam satu klik. Studio menyimpan pekerjaan yang selama ini tersebar di berkas, catatan, dan utas pesan.</p>
          </div>
          <div className="lp-cards">
            {audiences.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="alur" aria-labelledby="lp-alur-title">
          <div className="lp-section-head">
            <p className="lp-kicker">Alur yang sama di dalam studio</p>
            <h2 id="lp-alur-title">Lima tahap, satu buku</h2>
            <p>Nama tahap di halaman ini sama dengan yang dipakai editor setelah masuk: Ide, Rancang, Tulis, Review, dan Terbit.</p>
          </div>
          <ol className="lp-stages">
            {stages.map((stage, index) => (
              <li key={stage.name}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{stage.name}</h3>
                  <p>{stage.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" id="ekspor" aria-labelledby="lp-ekspor-title">
          <div className="lp-section-head">
            <p className="lp-kicker">Berkas dari naskah yang sama</p>
            <h2 id="lp-ekspor-title">Lima bentuk unduhan, dengan batas yang jelas</h2>
            <p>Sebelum buku disetujui, berkas ditandai pratinjau draf. Setelah persetujuan, ekspor membaca snapshot yang disetujui, bukan naskah yang masih berubah di editor.</p>
          </div>
          <div className="lp-formats">
            {formats.map((format) => (
              <article key={format.name}>
                <h3>{format.name}</h3>
                <p>{format.text}</p>
              </article>
            ))}
          </div>
          <p className="lp-aside">Studio dapat menyiapkan berkas ini. Halaman ini tidak menyatakan bahwa setiap unduhan sudah lulus EPUBCheck, PDF/UA, atau pemeriksaan percetakan.</p>
        </section>

        <section className="lp-section lp-section-alt" id="penerbit" aria-labelledby="lp-penerbit-title">
          <div className="lp-section-head">
            <p className="lp-kicker">Perpusnas, edisi lain, dan cetak</p>
            <h2 id="lp-penerbit-title">Siapkan berkas. Jangan menganggap nomornya sudah terbit.</h2>
          </div>
          <div className="lp-split">
            <article>
              <h3>Daftar periksa ISBN untuk admin</h3>
              <p>Pengelola yang berwenang dapat menyimpan profil penerbit, daftar periksa Peraturan Perpusnas Nomor 11 Tahun 2025, draf surat, dan nomor yang benar-benar sudah terbit. Studio tidak membuat ISBN, barcode, atau Katalog Dalam Terbitan, dan tidak mengirim permohonan ke portal Perpusnas.</p>
            </article>
            <article>
              <h3>Edisi bahasa atau format lain</h3>
              <p>Untuk edisi lain, catat bahasa, hak wilayah, dan izin terjemahan. Penerbit yang berkedudukan di Indonesia tetap mengajukan ISBN melalui Perpusnas. Ini pencatatan di studio, bukan distribusi ke toko luar negeri.</p>
            </article>
            <article>
              <h3>Catatan percetakan</h3>
              <p>Mitra, spesifikasi, dan status pesanan bisa dicatat setelah berkas disiapkan. Pengiriman ke vendor dilakukan terpisah. Catatan di studio bukan bukti bahwa percetakan sudah menerima atau menyetujui berkas.</p>
            </article>
          </div>
          <ul className="lp-limits">
            <li>Tidak menerbitkan ISBN, barcode, atau KDT.</li>
            <li>Tidak mengirim pengajuan ke isbn.perpusnas.go.id.</li>
            <li>Tidak menandai pratinjau draf sebagai terbitan resmi.</li>
            <li>Tidak menggantikan keputusan reviewer atau pemeriksaan fakta.</li>
          </ul>
        </section>

        <section className="lp-close" aria-labelledby="lp-close-title">
          <p className="lp-kicker">Lanjutkan di studio</p>
          <h2 id="lp-close-title">Naskah yang sedang dikerjakan tetap di akun Anda.</h2>
          <p>Masuk bila akun sudah aktif. Minta aktivasi bila pengelola studio sudah mengundang email Anda.</p>
          <div className="lp-actions">
            <Link href="/login" className="lp-button lp-button-light">Masuk ke studio</Link>
            <Link href="/activate" className="lp-button lp-button-ghost">Aktivasi akun</Link>
          </div>
        </section>
      </main>
      <footer className="lp-footer">
        <div>
          <strong>BC Book Studio</strong>
          <p>Ruang kerja naskah PT Bahasa Cerdas Indonesia.</p>
        </div>
        <nav aria-label="Tautan kaki">
          <Link href="/login">Masuk</Link>
          <Link href="/activate">Aktivasi</Link>
          <Link href="/forgot-password">Lupa kata sandi</Link>
          <Link href="/syarat-ketentuan">Syarat dan Ketentuan</Link>
          <Link href="/progress">Catatan progres internal</Link>
          <a href="https://bahasacerdas.com/">Bahasa Cerdas</a>
        </nav>
        <small>© 2026 PT Bahasa Cerdas Indonesia</small>
      </footer>
    </div>
  );
}
