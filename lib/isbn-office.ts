import JSZip from "jszip";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {validIsbn13} from "./publishing-readiness";

export const ISBN_FORMS=["PRINT","EPUB","PDF_EBOOK","AUDIOBOOK","OTHER_EBOOK"] as const;
export const ISBN_RIGHTS=["ORIGINAL","TRANSLATION","TRANSFER","PUBLIC_DOMAIN"] as const;
export const ISBN_STATUSES=["DRAFT","DOCUMENTS_READY","SUBMITTED_EXTERNAL","CORRECTION_REQUIRED","ISSUED","PUBLISHED","REJECTED","CANCELLED"] as const;
export const ISBN_DOCUMENTS=[
 ["membership_letter","Surat pernyataan menjadi anggota ISBN Perpusnas"],
 ["legal_certificate","Pengesahan badan hukum PT"],
 ["nib","NIB dengan KBLI kegiatan penerbitan"],
 ["application_letter","Surat permohonan ISBN berkop dan stempel"],
 ["title_pages","Halaman judul, verso, kata pengantar, daftar isi"],
 ["watermarked_manuscript","Naskah akhir PDF dengan watermark"],
 ["authenticity","SPKK bermeterai untuk karya asli atau dialihkan"],
 ["translation_permission","Izin penerjemahan dari pemilik hak cipta"],
 ["transfer_letter","Pengalihan hak penerbitan"],
 ["public_domain_statement","Surat keterangan karya domain publik"],
 ["isbn_result","Bukti penetapan ISBN dari Perpusnas"],
 ["kdt_result","Bukti KDT resmi"],
 ["barcode_result","Berkas barcode resmi"],
] as const;
export type DocKind=typeof ISBN_DOCUMENTS[number][0];
export const LETTER_KINDS=["membership_letter","application_letter","authenticity","translation_permission","transfer_letter","public_domain_statement"] as const;
export function requiredForBasis(basis:string):DocKind[]{
 const core:DocKind[]=["application_letter","title_pages","watermarked_manuscript"];
 if(basis==="ORIGINAL")return [...core,"authenticity"];
 if(basis==="TRANSLATION")return [...core,"translation_permission"];
 if(basis==="TRANSFER")return [...core,"authenticity","transfer_letter"];
 if(basis==="PUBLIC_DOMAIN")return [...core,"public_domain_statement"];
 return core;
}
export function sanitizeIsbn(value:string){return value.replace(/[\s-]/g,"")}
export function isbnValid(value:string){return validIsbn13(value)}
export function safeExternalUrl(value:string){if(!value)return true;try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!["localhost","127.0.0.1","0.0.0.0"].includes(u.hostname)}catch{return false}}
export function isPerpusnasEvidence(value:string){try{const u=new URL(value);return u.protocol==="https:"&&u.hostname==="isbn.perpusnas.go.id"}catch{return false}}
type LetterInput={kind:typeof LETTER_KINDS[number];publisher:{legalName:string;directorName:string;legalAddress:string;email:string;officialWebsite:string};application?:{title:string;authorNames:string;format:string;language:string;editionNumber:number;rightsBasis:string;catalogUrl:string}};
export function makeLetter({kind,publisher:p,application:a}:LetterInput){
 const name=p.legalName||"PT Bahasa Cerdas Indonesia";
 const title=a?.title||"[JUDUL BUKU]";
 const author=a?.authorNames||"[NAMA PENULIS]";
 const signer=p.directorName||"[NAMA DIREKTUR]";
 const lines=[
  "DRAF ADMINISTRASI — PERIKSA DAN SESUAIKAN DENGAN FORMAT RESMI PERPUSNAS",
  name.toUpperCase(),
  [p.legalAddress,p.email,p.officialWebsite].filter(Boolean).join(" | ")||"[ALAMAT / KONTAK / WEBSITE RESMI]",
  "",
  kind==="membership_letter"?"SURAT PERNYATAAN PENDAFTARAN PEMOHON ISBN":
  kind==="application_letter"?"SURAT PERMOHONAN ISBN":
  kind==="authenticity"?"SURAT PERNYATAAN KEASLIAN KARYA":
  kind==="translation_permission"?"SURAT IZIN PENERJEMAHAN":
  kind==="transfer_letter"?"SURAT PENGALIHAN PENERBITAN / PUBLIKASI":"SURAT KETERANGAN KARYA DOMAIN PUBLIK",
  "Nomor: [NOMOR SURAT]","Tanggal: [TANGGAL]", ""
 ];
 if(kind==="membership_letter")lines.push("Saya yang bertanda tangan di bawah ini, mewakili "+name+", mengajukan pendaftaran pemohon ISBN Perpustakaan Nasional RI.", "Identitas dan dokumen legalitas yang disampaikan harus sama dengan dokumen pendirian, NIB dan KBLI penerbitan yang sah.", "Website dan katalog penerbit perlu dapat diakses publik.");
 if(kind==="application_letter")lines.push("Kepada Tim Layanan ISBN Perpustakaan Nasional Republik Indonesia", "Dengan hormat, kami mengajukan permohonan ISBN untuk edisi berikut:", "Judul: "+title,"Penulis: "+author,"Format: "+(a?.format||"[FORMAT]"),"Edisi: "+(a?.editionNumber||1),"Bahasa: "+(a?.language||"id"),"Tautan katalog judul: "+(a?.catalogUrl||"[URL KATALOG SPESIFIK]"),"Berkas halaman awal dan naskah akhir bertanda watermark dilampirkan secara terpisah.");
 if(kind==="authenticity")lines.push("Saya, "+author+", menyatakan naskah berjudul “"+title+"” adalah karya yang keaslian serta hak penerbitannya saya pertanggungjawabkan sesuai bukti yang dilampirkan.", "Apabila terdapat materi pihak ketiga, izin dan kredit sumber wajib dilampirkan.", "Pernyataan ini harus ditandatangani pihak yang berwenang sesuai jenis karya, serta dibubuhi meterai sesuai ketentuan.");
 if(kind==="translation_permission")lines.push("Pemilik hak cipta: [NAMA PEMEGANG HAK]", "Judul karya asli: [JUDUL / SUMBER / TAHUN]", "Dengan ini memberi izin tertulis kepada "+name+" untuk menerjemahkan dan menerbitkan karya berjudul "+title+" berdasarkan perjanjian lisensi [NOMOR / TANGGAL / WILAYAH / DURASI].", "Dokumen hanya sah setelah ditandatangani pemegang hak yang benar.");
 if(kind==="transfer_letter")lines.push("Penerbit sebelumnya: [NAMA DAN LEGALITAS]", "Penerbit penerima: "+name, "Judul: "+title,"Pihak yang berhak menyatakan pengalihan hak penerbitan berdasarkan perjanjian tertulis [NOMOR/TANGGAL/LINGKUP].", "Lampirkan persetujuan pemegang hak cipta apabila diperlukan.");
 if(kind==="public_domain_statement")lines.push("Judul: "+title,"Karya asli/sumber: [REFERENSI BIBLIOGRAFIS]", "Dasar status domain publik: [DASAR HUKUM DAN PERHITUNGAN MASA PERLINDUNGAN]", "Pernyataan ini harus disertai bukti bahwa karya benar-benar telah masuk domain publik di wilayah yang relevan.");
 lines.push("", "Tempat dan tanggal: [KOTA, TANGGAL]", "Penandatangan berwenang:",kind==="authenticity"?"[PENULIS/PIHAK YANG DITENTUKAN PERATURAN]":kind==="translation_permission"?"[PEMILIK HAK CIPTA / KUASA SAH]":kind==="transfer_letter"?"[PIHAK PENGALIH & PENERIMA]":signer,"[TANDA TANGAN BASAH / DIGITAL SAH]",kind==="authenticity"?"[METERAI SESUAI KETENTUAN]":"[STEMPEL PERUSAHAAN BILA DIPERSYARATKAN]","", "Dokumen ini baru merupakan template draf; belum disahkan/ditandatangani, belum dikirim dan bukan bukti ISBN.","Rujukan: Peraturan Perpusnas No. 11 Tahun 2025, lampiran format resmi harus diperiksa sebelum digunakan.");
 return lines;
}
const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export async function letterDocx(lines:string[]){
 const zip=new JSZip();
 zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
 zip.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
 const paragraphs=lines.map((line,i)=>`<w:p><w:pPr><w:spacing w:after="150"/></w:pPr><w:r>${i<5?"<w:rPr><w:b/></w:rPr>":""}<w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join("");
 zip.file("word/document.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1100" w:right="1100" w:bottom="1100" w:left="1100"/></w:sectPr></w:body></w:document>`);
 return Buffer.from(await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
}
export async function letterPdf(lines:string[]){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 let page=pdf.addPage([595.28,841.89]),y=790;
 function plain(t:string){return t.normalize("NFKD").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[—–]/g,"-").replace(/[^\x20-\x7e\xA0-\xFF]/g,"?")}
 for(const [i,line] of lines.entries()){
  const text=plain(line),fontSize=i<5?10:10.5,maxWidth=475;let current="";
  const parts=text.split(" ");
  const rows:string[]=[];
  for(const part of parts){const next=current?current+" "+part:part;if(font.widthOfTextAtSize(next,fontSize)>maxWidth&&current){rows.push(current);current=part}else current=next}
  if(current)rows.push(current);if(!rows.length)rows.push("");
  for(const row of rows){if(y<75){page=pdf.addPage([595.28,841.89]);y=790}
   page.drawText(row,{x:60,y,size:fontSize,font:i<5?bold:font,color:rgb(0.12,0.18,0.29)});y-=15;
  }y-=5;
 }
 return Buffer.from(await pdf.save());
}
