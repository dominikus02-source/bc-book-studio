"use strict";
const sharp=require("sharp"),path=require("node:path"),fs=require("node:fs"),crypto=require("node:crypto");
function escapeXml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function wrap(text,max=31){const words=String(text??"").split(/\s+/),lines=[];let line="";for(const word of words){if((line+" "+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+" "+word).trim()}if(line)lines.push(line);return lines}
function markdownSafe(x){return String(x??"").replace(/[\r\n]+/g," ").replace(/[\\*_~]/g,"").trim()}
function draftMatter(book,assetsDir){
 const title=markdownSafe(book.title),subject=markdownSafe(book.subject),author=markdownSafe(book.author),grade=markdownSafe(book.grade),goal=markdownSafe(book.writingGoal),audience=markdownSafe(book.targetAudience),description=markdownSafe(book.description);
 const userPurpose=goal||"Memberikan bahan pembelajaran dan eksplorasi sesuai tema buku.";
 const readers=audience||"Pembaca sesuai jenjang dan bidang yang dinyatakan dalam metadata buku.";
 const preface=[
  "Buku ini disusun untuk mendampingi pembaca memahami "+(subject||"topik utama")+" melalui penjelasan bertahap, contoh yang dekat dengan kehidupan sehari-hari, serta kegiatan refleksi dan latihan.",
  "Pembaca yang dituju adalah "+readers.replace(/\.$/,"")+". Tujuan penulisan yang tercatat: "+userPurpose.replace(/\.$/,"")+".",
  "Naskah pratinjau ini memuat tiga bab yang tersimpan dalam BC Book Studio. Setiap bab sebaiknya dibaca secara berurutan, dengan memperhatikan tujuan pembelajaran, contoh dan kegiatan yang relevan.",
  "Sebelum digunakan sebagai buku publikasi, naskah masih memerlukan penyuntingan substantif, verifikasi fakta dan sitasi, persetujuan hak cipta, serta pemeriksaan aksesibilitas dan format."
 ];
 const legal=[
  "Judul: **"+title+"**",
  "Penulis (sesuai metadata): **"+author+"**",
  "Subjek: **"+subject+"**"+(grade?"  \nJenjang: **"+grade+"**":""),
  "Genre: **"+book.genre+"**; jenis naskah: **"+book.bookType+"**",
  "Penyusun berkas pratinjau: **BC Book Studio** (aplikasi, bukan pernyataan identitas penerbit resmi).",
  "**Status editorial: DRAF — BELUM DISETUJUI.**",
  "Nama penerbit, alamat penerbit, pemegang hak cipta, penyunting, ilustrator, cetakan/edisi, dan tahun penerbitan resmi: **[PERLU DIISI DAN DIVERIFIKASI]**.",
  "ISBN: **[BELUM DITETAPKAN / PERLU VERIFIKASI PERPUSNAS]**.",
  "Hak reproduksi gambar dan kutipan, lisensi distribusi, serta izin seluruh kontributor harus diperiksa sebelum publikasi. Materi di sini tidak menyatakan izin komersial.",
  "Versi dokumen ini hanya pratinjau pembacaan dan pengujian format."
 ];
 const intro=[
  "### Tentang buku ini",
  description||"Sinopsis belum tersedia. Penulis perlu menambahkan ringkasan substansi dan manfaat buku sebelum penerbitan.",
  "### Cara menggunakan buku",
  "Mulai dari daftar isi dan tujuan pembelajaran. Bacalah bagian utama secara berurutan; cermati contoh, tabel, ilustrasi, dan pertanyaan evaluasi. Pada buku digital, gunakan tautan navigasi; pada dokumen cetak, gunakan daftar isi.",
  "### Bagi pembaca dengan kebutuhan akses berbeda",
  "Gunakan pembaca layar dan fitur perbesaran jika didukung oleh aplikasi pembaca. Deskripsi teks alternatif untuk ilustrasi ditambahkan sejauh tersedia; audit aksesibilitas dengan pembaca layar nyata tetap diperlukan."
 ];
 const references=[
  "Bagian ini disiapkan untuk menautkan setiap klaim ilmiah, tabel, ilustrasi, dan kutipan ke dokumen sumber yang dapat diperiksa.",
  "**[PERLU DILENGKAPI]** Saat ekspor, tidak ada daftar sumber eksternal yang terverifikasi dalam metadata dan naskah kedua buku. Sistem tidak membuat rujukan, pengarang, tahun, DOI, URL, atau ISBN secara fiktif.",
  "Sebelum publikasi, tambahkan sitasi per bab menggunakan sistem rujukan yang dipilih, periksa sumber primer, judul, pengarang, tahun, penerbit/URL/DOI, halaman kutipan, dan tanggal akses jika relevan.",
  "Klaim mengenai rumus, data eksperimen, perangkat ajar, dan gambar wajib ditelusuri ke sumber asli atau diberi keterangan karya orisinal terverifikasi."
 ];
 const bibliography=[
  "Bibliografi adalah daftar sumber utama dan bacaan lanjutan yang telah diperiksa penyunting, bukan daftar sumber yang diperkirakan relevan.",
  "**[BELUM ADA ENTRI TERVERIFIKASI]**. Lengkapi referensi dan bibliografi sebelum tahap persetujuan editorial; setiap entri wajib memiliki data bibliografis yang benar.",
  "Gaya penulisan yang disarankan untuk buku pendidikan: gunakan satu gaya konsisten (misalnya APA edisi terkini) sesuai kebijakan penerbit, tanpa mengarang data publikasi."
 ];
 return {title,subject,author,grade,description,preface,legal,intro,references,bibliography};
}
async function covers(book,assetsDir){
 fs.mkdirSync(assetsDir,{recursive:true});
 const matter=draftMatter(book,assetsDir);
 const frontLines=wrap(book.title,28).slice(0,6),subtitleLines=wrap(book.subject,36).slice(0,3);
 const backLines=(book.chapters||[]).flatMap((c,i)=>wrap(String(i+1)+". "+c.title,42)).slice(0,7);
 const make=(side)=>{
  const gold="#E8C77A",ink="#F2F7FF",accent=side==="front"?"#2DD4BF":"#89C2F7";
  const backdrop='<rect width="1200" height="1800" fill="#0B2140"/><path d="M0 1350C190 1210 430 1250 660 1100s390-210 540-140v840H0z" fill="#123D61"/><circle cx="1050" cy="290" r="320" fill="#173F62"/><circle cx="960" cy="370" r="238" fill="none" stroke="#2E6884" stroke-width="4"/><path d="M130 '+(side==='front'?1100:1280)+'h900" stroke="'+gold+'" stroke-width="3"/><path d="M130 '+(side==='front'?1150:1320)+'h700" stroke="'+accent+'" stroke-width="5"/>';
  const lines=side==="front"?frontLines:["Tentang Buku"];
  const initialY=side==="front"?445:460;
  const headlineSize=side==="front"?Math.min(60,Math.floor(1280/Math.max(...lines.map(x=>x.length),1))):72;
  const lineHeight=side==="front"?77:74;
  const headline=lines.map((x,i)=>'<text x="128" y="'+(initialY+i*lineHeight)+'" font-family="Georgia,serif" font-size="'+headlineSize+'" font-weight="bold" fill="'+ink+'">'+escapeXml(x)+'</text>').join("");
  const small=side==="front"?subtitleLines.map((x,i)=>'<text x="130" y="'+(initialY+lines.length*lineHeight+75+i*51)+'" font-family="Arial,sans-serif" font-size="38" fill="'+accent+'">'+escapeXml(x)+'</text>').join(""):(["Tiga bab utama:",...backLines]).map((x,i)=>'<text x="128" y="'+(610+i*67)+'" font-family="Arial,sans-serif" font-size="32" fill="'+ink+'">'+escapeXml(x)+'</text>').join("");
  const bottom=side==="front"?escapeXml(book.author):"BC Book Studio · Pratinjau kerja · Belum terbit";
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800">'+backdrop
   +'<text x="128" y="170" font-family="Arial,sans-serif" font-size="32" letter-spacing="6" font-weight="bold" fill="'+gold+'">BC BOOK STUDIO</text>'
   +'<text x="128" y="244" font-family="Arial,sans-serif" font-size="24" letter-spacing="4" fill="#AFC7DE">'+(side==="front"?"BUKU AJAR • DRAF PRATINJAU":"SAMPUL BELAKANG • DRAF")+'</text>'
   +headline+small
   +'<rect x="125" y="1450" width="950" height="95" rx="17" fill="#193C58"/><text x="155" y="1511" font-family="Arial,sans-serif" font-size="27" font-weight="bold" fill="#FFE6AA">DRAF — BELUM DISETUJUI</text>'
   +'<text x="130" y="1640" font-family="Arial,sans-serif" font-size="26" fill="#E3EFF9">'+bottom+'</text>'
   +'<text x="130" y="1693" font-family="Arial,sans-serif" font-size="22" fill="#AFC7DE">ISBN / PENERBIT RESMI: PERLU VERIFIKASI</text>'
   +'</svg>';
 };
 const out={};
 for(const side of ["front","back"]){const name=side+"-cover.png",target=path.join(assetsDir,name);await sharp(Buffer.from(make(side))).png().toFile(target);out[side]="assets/"+name}
 return out;
}
function markdownParts(book,covers){
 const m=draftMatter(book);
 const parts=[
  {title:"Sampul Depan",id:"front-cover",content:"!["+m.title+" — desain sampul depan draf]("+covers.front+"){width=80%}"},
  {title:"Halaman Judul",id:"title-page",content:"**"+m.title+"**\n\n"+m.subject+"\n\n**Penulis:** "+m.author+"\n\n**Status: DRAF — BELUM DISETUJUI**"},
  {title:"Halaman Identitas dan Hak Cipta",id:"copyright-page",content:m.legal.join("\n\n")},
  {title:"Kata Pengantar",id:"preface",content:m.preface.join("\n\n")},
  {title:"Petunjuk Pembaca",id:"reading-guide",content:m.intro.join("\n\n")},
  {title:"Referensi dan Sumber",id:"references",content:m.references.join("\n\n")},
  {title:"Daftar Pustaka dan Bibliografi",id:"bibliography",content:m.bibliography.join("\n\n")},
  {title:"Sampul Belakang",id:"back-cover",content:"!["+m.title+" — desain sampul belakang draf]("+covers.back+"){width=80%}\n\n"+book.chapters.map(c=>c.title).join("; ")+"\n\n**DRAF — BELUM DISETUJUI.**"}
 ];
 return {front:parts.slice(0,5),back:parts.slice(5)};
}
module.exports={draftMatter,covers,markdownParts,wrap};
