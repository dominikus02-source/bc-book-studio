import Link from "next/link";

export const metadata={title:"Syarat dan Ketentuan | BC Book Studio",robots:{index:false,follow:false}};

const sections=[
 ["Layanan dan ruang lingkup","BC Book Studio membantu tim menyiapkan, meninjau, dan mengekspor buku, LKPD/LKS, dan panduan guru. Ketentuan ini berlaku bagi anggota tim dan reviewer yang diberi akses oleh PT Bahasa Cerdas Indonesia. Pada lingkungan staging, gunakan data dummy atau materi yang diizinkan untuk pengujian."],
 ["Akun dan kewenangan","Gunakan akun sendiri dan jaga kerahasiaan akses. Pemilik proyek bertanggung jawab atas pemberian akses. Reviewer hanya boleh mengakses proyek yang menjadi kewenangannya dan wajib menjaga kerahasiaan naskah serta kunci jawaban."],
 ["Hak atas naskah dan aset","Hak atas materi tetap pada pemegang haknya. Pengguna memberi izin terbatas kepada pengelola untuk menyimpan, memproses, menampilkan kepada pihak berwenang, dan mengekspor materi sesuai tindakan pengguna. Pastikan izin mencakup gambar, font, kutipan, video, dan penggunaan yang direncanakan."],
 ["Penggunaan AI dan mode suara","Pengguna memilih kapan mengirim konteks ke penyedia AI. Hasil AI adalah usulan yang perlu diperiksa, khususnya fakta, sumber, perhitungan, dan hak penggunaan. Mode suara memerlukan aktivasi. Dikte dapat diproses oleh layanan browser sesuai perangkat dan pengaturannya."],
 ["Data dan kerahasiaan","Unggah hanya data yang diperlukan. Gunakan data sintetis untuk murid dan hindari memasukkan informasi pribadi atau rahasia ke prompt. Ikuti kebijakan internal tim untuk penggunaan penyedia AI, penyimpanan berkas, dan permintaan terkait data. Hubungi administrator Studio jika ada data yang perlu dikoreksi atau dihapus."],
 ["Review, ekspor, dan publikasi","Draf dan pratinjau digunakan untuk pemeriksaan. Tim penerbit memverifikasi izin, kunci jawaban, versi produk, aksesibilitas, dan proof sebelum rilis. Ekspor Studio tidak merupakan penerbitan ISBN, sertifikasi PDF, atau persetujuan percetakan."],
 ["QR dan layanan eksternal","Periksa tujuan QR dan tautan sebelum mencetak. Video, penyedia AI, serta layanan eksternal dapat memiliki ketentuan, pengaturan privasi, dan ketersediaan tersendiri."],
 ["Penggunaan yang dilarang","Dilarang mengakses proyek tanpa izin, menyebarkan kunci atau naskah terbatas, mengunggah materi yang melanggar hak pihak lain, atau mengganggu keamanan layanan. Akses dapat dibatasi untuk melindungi pengguna dan data, sesuai hukum yang berlaku."],
 ["Perubahan, pengaduan, dan hak pengguna","Perubahan material perlu diumumkan melalui kanal yang dapat diakses pengguna. Pengaduan hak cipta, privasi, akses, dan koreksi dapat disampaikan kepada administrator BC Book Studio melalui kanal internal tim. Ketentuan ini tidak mengurangi hak yang diberikan oleh hukum yang berlaku."],
] as const;

export default function TermsPage(){
 return <main style={{maxWidth:800,margin:"0 auto",padding:"clamp(16px,4vw,40px)",overflowWrap:"anywhere"}}>
  <Link href="/">Kembali ke Beranda</Link>
  <h1>Syarat dan Ketentuan BC Book Studio</h1>
  <p><strong>Penggunaan internal PT Bahasa Cerdas Indonesia.</strong> Akses diberikan kepada anggota tim dan reviewer yang ditugaskan.</p>
  {sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}
 </main>;
}
