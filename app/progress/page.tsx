import Link from "next/link";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import styles from "./page.module.css";

export const metadata = { title: "Progres Terverifikasi | BC Book Studio" };
export const dynamic = "force-dynamic";

type Stage = { title: string; state: "PASS" | "PARTIAL" | "HOLD"; done: string; todo: string; evidence: string };
const stages: Stage[] = [
  { title: "Ide", state: "PASS", done: "CRUD metadata/brief, arsip/pulihkan, konflik versi 409, impor XLSX/MD, prompt AI, status kelengkapan dan autosave telah diuji pada QA lokal.", todo: "Matriks seluruh genre/peran, validasi menyeluruh dan bukti legal penerbitan masih perlu dilengkapi.", evidence: "docs/STAGE1_STAGE2_CRUD_QA_20261108.md" },
  { title: "Rancang", state: "PASS", done: "CRUD bab dan subbagian, pengurutan, arsip/pulihkan, impor 25 baris serta sinkronisasi database/browser tercatat PASS pada skenario QA lokal.", todo: "Uji manual perangkat sentuh dan pembaca layar, serta seluruh variasi genre dan role.", evidence: "docs/BULK_CHAPTER_SUBSECTION_CRUD_QA_20261108.md" },
  { title: "Tulis", state: "PASS", done: "Editor blok, aset, revisi, autosave, pemulihan, impor dan pengisian dari kerangka telah memiliki bukti QA lokal.", todo: "Pengujian seluruh kombinasi hak akses, sitasi tepercaya, aksesibilitas nyata, dan round-trip dokumen.", evidence: "docs/DRAFT_CANVAS_RECOVERY_QA.md" },
  { title: "Review Naskah", state: "PARTIAL", done: "Alur reviewer independen, catatan, dan snapshot approval pernah diuji dalam cakupan QA terbatas.", todo: "Lengkapi verifikasi peran end-to-end, invalidasi approval saat konten berubah, dan persetujuan manusia untuk kedua buku draf.", evidence: "docs/WORKFLOW_RBAC_UX_QA.md" },
  { title: "Penerbitan", state: "PARTIAL", done: "Paket 11 field kontekstual dari tahap sebelumnya, XLSX/MD, impor, autosave dan AI terproteksi lulus QA lokal. Dua buku draf menghasilkan PDF, DOCX, EPUB3, HTML dan Flipbook (10 berkas). Kedua EPUB lulus EPUBCheck 5.4.0 tanpa error/warning.", todo: "Pipeline umum produksi belum terbukti setara; perlu validator lengkap per format, uji Word/reader fisik, aksesibilitas, preflight cetak, bibliografi asli, approval dan bukti ISBN/Perpusnas yang sah.", evidence: "docs/TWO_BOOKS_FULL_BOOK_MATTER_QA_20261108.md" }
];

function repoState() {
  try {
    const cwd = process.cwd();
    const git = (args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", timeout: 2500, windowsHide: true }).trim();
    const branch = git(["branch", "--show-current"]);
    const sha = git(["rev-parse", "--short", "HEAD"]);
    const changes = git(["status", "--porcelain"]).split("\n").filter(Boolean).length;
    return { branch, sha, changes, live: true };
  } catch { return { branch: "tidak terverifikasi", sha: "—", changes: -1, live: false }; }
}
function evidenceInfo(relative: string) {
  try {
    const file = path.join(process.cwd(), relative);
    if (!existsSync(file)) return "Dokumen bukti belum ditemukan di runtime ini";
    return "Dokumen QA tersedia · diubah " + new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(statSync(file).mtime);
  } catch { return "Waktu bukti tidak dapat dibaca"; }
}

export default function ProgressPage() {
  const repo = repoState();
  const observed = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date());
  return <main className={styles.main}>
    <header className={styles.hero}><div><small>BC BOOK STUDIO / BUKTI QA LOKAL</small><h1>Progres aktual lima tahap</h1><p>Dipantau {observed} WIB. Status berdasarkan catatan tes 8 November 2026, keberadaan bukti QA, dan kondisi Git runtime; bukan persentase buatan atau sertifikasi penerbitan.</p></div><nav aria-label="Navigasi"><Link href="/">Beranda</Link><Link href="/studio">Buka Studio</Link></nav></header>
    <aside className={styles.notice} role="status"><strong>PRODUKSI: HOLD / BELUM GO</strong><span>QA lokal: 3 tahap CRUD lulus untuk skenario teruji, 2 tahap parsial. Kelulusan QA fitur tidak sama dengan kelulusan seluruh release gate.</span><span>Git runtime: {repo.branch} · {repo.sha} · {repo.changes < 0 ? "status perubahan tidak tersedia" : repo.changes + " perubahan belum di-commit"} {repo.live ? "(dibaca langsung saat halaman dimuat)" : "(belum terverifikasi)"}.</span></aside>
    <section className={styles.grid} aria-label="Status tiap tahap">{stages.map((s,i) => <article className={[styles.card,s.state==="PASS"?styles.complete:s.state==="PARTIAL"?styles.progress:styles.incomplete].join(" ")} key={s.title}><div className={styles.meta}><span>TAHAP {i+1}/5</span><strong>{s.state==="PASS"?"CRUD QA LOKAL PASS":s.state==="PARTIAL"?"QA PARSIAL":"HOLD"}</strong></div><h2>{s.title}</h2><h3>Sudah ada bukti</h3><p>{s.done}</p><h3>Belum terverifikasi / wajib lanjut</h3><p>{s.todo}</p><h3>Jejak bukti</h3><p><code>{s.evidence}</code></p><p>{evidenceInfo(s.evidence)}</p></article>)}</section>
    <footer className={styles.footer}><h2>Keputusan rilis: NO-GO sampai seluruh gate lulus</h2><p><strong>Yang benar-benar terbukti:</strong> 10 artefak draf untuk 2 buku, pemeriksaan struktur/unduhan dan EPUBCheck kedua EPUB PASS. Ini adalah sampel QA lokal, bukan jaminan semua buku atau ekspor worker produksi otomatis berhasil.</p><p><strong>Yang masih terbuka:</strong> kesetaraan ekspor lokal/produksi, pengujian format dan ukuran cetak lengkap, Word round-trip, pembaca layar/perangkat nyata, sitasi dan lisensi, snapshot approval reviewer, ISBN resmi jika berlaku, distribusi, CI serta deploy terkendali.</p><p>AI langsung juga memerlukan provider/model aktif; keberhasilan prompt atau tombol saja bukan bukti model telah menghasilkan konten. Catatan validator yang berstatus NOT_RUN tidak boleh diinterpretasikan sebagai PASS.</p><p>Git dan waktu pemeriksaan diperbarui saat halaman dimuat ulang; bukti QA berbasis dokumen hasil pengujian, bukan menjalankan ulang tes setiap kali halaman dibuka.</p><a href="https://github.com/dominikus02-source/bc-book-studio" target="_blank" rel="noopener noreferrer">Repository BC Book Studio</a></footer>
  </main>;
}
