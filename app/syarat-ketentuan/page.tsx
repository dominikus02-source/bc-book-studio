import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/public-header";

export const metadata: Metadata = {
  title: "Syarat dan Ketentuan | BC Book Studio",
  robots: { index: false, follow: false },
};

const sections = [
  ["Layanan dan ruang lingkup", "BC Book Studio membantu tim internal PT Bahasa Cerdas Indonesia menyiapkan, meninjau, dan mengekspor naskah. Lima tahap di studio adalah Ide, Rancang, Tulis, Review, dan Terbit. Berkas yang dapat disiapkan: PDF, DOCX, EPUB, HTML, dan flipbook. Ketentuan ini berlaku bagi anggota tim dan reviewer yang diberi akses. Pada lingkungan percobaan, gunakan data dummy atau materi yang diizinkan untuk pengujian."],
  ["Akun dan kewenangan", "Tidak ada pendaftaran umum. Akun dibuka lewat undangan pengelola studio. Gunakan akun sendiri dan jaga kerahasiaan kata sandi. Tautan aktivasi dan pemulihan berlaku 30 menit dan sekali pakai. Pemilik proyek bertanggung jawab atas pemberian akses. Reviewer hanya boleh mengakses proyek yang menjadi tugasnya dan wajib menjaga kerahasiaan naskah."],
  ["Hak atas naskah dan aset", "Hak atas materi tetap pada pemegang haknya. Pengguna memberi izin terbatas kepada pengelola untuk menyimpan, memproses, menampilkan kepada pihak yang berwenang, dan mengekspor materi sesuai tindakan pengguna. Pastikan izin mencakup gambar, font, kutipan, dan penggunaan yang direncanakan."],
  ["Penggunaan AI", "Bantuan AI, bila dipakai, hanya usulan yang harus diperiksa manusia, khususnya fakta, sumber, perhitungan, dan hak penggunaan. Studio tidak menggantikan keputusan reviewer."],
  ["Data dan kerahasiaan", "Unggah hanya data yang diperlukan. Hindari memasukkan informasi pribadi yang tidak dibutuhkan ke naskah atau permintaan AI. Ikuti kebijakan internal tim untuk penyedia AI, penyimpanan berkas, dan permintaan terkait data. Hubungi administrator studio jika ada data yang perlu dikoreksi."],
  ["Review, ekspor, dan publikasi", "Sebelum ada persetujuan, unduhan adalah pratinjau draf. Setelah disetujui, ekspor memakai snapshot persetujuan. Studio tidak membuat ISBN, barcode, atau Katalog Dalam Terbitan, dan tidak mengirim permohonan ke portal Perpusnas. Ekspor tidak berarti berkas sudah lulus EPUBCheck, PDF/UA, atau pemeriksaan percetakan."],
  ["Tautan dan layanan eksternal", "Periksa tujuan tautan sebelum dibagikan atau dicetak. Penyedia AI dan layanan di luar studio dapat memiliki ketentuan dan ketersediaan tersendiri."],
  ["Penggunaan yang dilarang", "Dilarang mengakses proyek tanpa izin, menyebarkan naskah terbatas, mengunggah materi yang melanggar hak pihak lain, atau mengganggu keamanan layanan. Akses dapat dibatasi untuk melindungi pengguna dan data."],
  ["Perubahan dan pengaduan", "Perubahan material perlu disampaikan lewat kanal yang dapat diakses pengguna. Pengaduan hak cipta, privasi, dan koreksi dapat disampaikan kepada administrator BC Book Studio melalui kanal internal tim. Halaman ini tidak mengurangi hak yang diberikan oleh hukum yang berlaku, dan bukan pengganti telaah hukum atas badan hukum penerbit."],
] as const;

export default function TermsPage() {
  return (
    <div className="lp">
      <PublicHeader />
      <main className="lp-terms">
        <p className="lp-kicker">PT Bahasa Cerdas Indonesia</p>
        <h1>Syarat dan Ketentuan</h1>
        <p className="lp-lede">Penggunaan internal studio. Akses diberikan kepada anggota tim dan reviewer yang ditugaskan, bukan kepada pendaftar umum.</p>
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <nav className="lp-terms-links" aria-label="Halaman terkait">
          <Link href="/">Beranda</Link>
          <Link href="/login">Masuk</Link>
          <Link href="/activate">Aktivasi akun</Link>
          <Link href="/forgot-password">Lupa kata sandi</Link>
        </nav>
      </main>
    </div>
  );
}
