import {briefGenreIssues,genreGuide} from "./genre-policy";

export const RELEASE_FORMATS=["DOCX","PDF","EPUB","HTML","FLIPBOOK"] as const;
export type ReleaseFormat=typeof RELEASE_FORMATS[number];
export const PUBLISHING_EVIDENCE_KINDS=["RIGHTS","ISBN","PUBLISHER","KDT","BARCODE","CATALOG","DISTRIBUTION_PLAN","ACCESSIBILITY","CITATIONS","RELEASE_SIGNOFF","DISTRIBUTION_RECEIPT","DEPOSIT_RECEIPT",...RELEASE_FORMATS.map(f=>"FORMAT_"+f)] as const;
export type EvidenceKind=typeof PUBLISHING_EVIDENCE_KINDS[number];
type SourceBook={id:string;title:string;author:string;bookType:string;genre:string;pageSize:string;subject:string;targetAudience:string;writingGoal:string;description:string;status:string;approvedAt:Date|null;chapters:{title:string;outlineObjective:string;content:string;archivedAt?:Date|null}[]};
export type EvidenceRow={id:string;kind:string;status:string;approvedAt:Date;layoutVersion:number;createdAt:Date;referenceUrl:string|null;checksum:string|null;isbn:string|null;validator:string|null;validatorVersion:string|null;artifactBytes:number|null;actorId:string;note:string};
type LayoutInfo={saved:boolean;version:number};
const profile:Record<ReleaseFormat,{validator:string;proof:string;implemented:boolean}>={
 DOCX:{validator:"Paket OOXML + buka Word/LibreOffice",proof:"Simpan SHA-256, ukuran, uji buka, heading, tabel, gambar, metadata, dan pemeriksaan manusia.",implemented:true},
 PDF:{validator:"Preflight PDF + veraPDF pada profil yang benar",proof:"Simpan hash, font, Unicode, pembagian halaman, bukti preflight, dan pemeriksaan cetak/aksesibilitas.",implemented:true},
 EPUB:{validator:"EPUBCheck + Ace by DAISY",proof:"Simpan hash, log EPUBCheck, metadata aksesibilitas, navigasi, dan pembacaan di aplikasi e-reader.",implemented:true},
 HTML:{validator:"Nu HTML Checker + axe-core + pemeriksaan keyboard",proof:"Simpan hash, hasil validator, tautan internal, hierarki heading dan responsivitas.",implemented:true},
 FLIPBOOK:{validator:"Regresi browser interaktif + audit keyboard, touch dan screen reader",proof:"Lampirkan SHA-256, hasil E2E navigasi/zoom/tema, audit screen reader, dan inspeksi manusia.",implemented:true}
};
export function validIsbn13(value:string):boolean{
 const text=value.replace(/[ -]/g,"");
 if(!/^(978|979)\d{10}$/.test(text))return false;
 let sum=0;for(let i=0;i<12;i++)sum+=Number(text[i])*(i%2?3:1);
 return (10-(sum%10))%10===Number(text[12]);
}
export function evidenceCurrent(row:EvidenceRow,approvedAt:Date|null,layoutVersion:number){
 return Boolean(approvedAt&&row.approvedAt.getTime()===approvedAt.getTime()&&row.layoutVersion===layoutVersion);
}
export function publicationReadiness(book:SourceBook,layout:LayoutInfo,hasSnapshot:boolean,evidence:EvidenceRow[]){
 const required=["RIGHTS","ISBN","PUBLISHER","KDT","BARCODE","CATALOG","DISTRIBUTION_PLAN","ACCESSIBILITY","CITATIONS","RELEASE_SIGNOFF",...RELEASE_FORMATS.map(f=>"FORMAT_"+f)];
 const postrelease=["DISTRIBUTION_RECEIPT","DEPOSIT_RECEIPT"];
 const auditKinds=[...required,...postrelease];
 const current=evidence.filter(r=>evidenceCurrent(r,book.approvedAt,layout.version));
 const latest=Object.fromEntries(auditKinds.map(kind=>[kind,current.filter(e=>e.kind===kind).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.id.localeCompare(a.id))[0]??null])) as Record<string,EvidenceRow|null>;
 const genre=genreGuide(book.genre);
 const problems:string[]=[];
 if(book.status!=="APPROVED"||!book.approvedAt||!hasSnapshot)problems.push("Persetujuan naskah dan snapshot editorial yang sah belum tersedia.");
 if(!layout.saved)problems.push("Tata letak terbaru belum tersimpan dan ditinjau.");
 problems.push(...briefGenreIssues(book));
 if(book.chapters.filter(c=>!c.archivedAt).some(c=>c.content.trim().length<20||!c.outlineObjective.trim()))problems.push("Masih terdapat bab yang belum memiliki isi/tujuan yang memadai.");
 const checks=auditKinds.map(kind=>{
  const item=latest[kind],isIsbn=kind==="ISBN",format=kind.startsWith("FORMAT_")?kind.slice(7) as ReleaseFormat:null;
  const supported=!format||profile[format].implemented;
  const ok=supported&&Boolean(item&&(item.status==="VERIFIED"||(isIsbn&&item.status==="NOT_APPLICABLE")));
  const isbnOfficial=latest.ISBN?.status==="VERIFIED";
  const conditional=kind==="KDT"||kind==="BARCODE";
  const prePublish=!postrelease.includes(kind)&&(!conditional||isbnOfficial);
  const label=format?format:({RIGHTS:"Hak cipta dan lisensi",ISBN:"ISBN / kelayakan Perpusnas",PUBLISHER:"Status penerbit dan legalitas",KDT:"KDT / katalog dalam terbitan",BARCODE:"Barcode ISBN untuk edisi cetak",CATALOG:"Katalog penerbit",DISTRIBUTION_PLAN:"Rencana distribusi",DISTRIBUTION_RECEIPT:"Bukti buku tersedia/disalurkan",DEPOSIT_RECEIPT:"Tanda terima serah simpan",ACCESSIBILITY:"Aksesibilitas dan pembaca berbeda kemampuan",CITATIONS:"Rujukan dan klaim faktual",RELEASE_SIGNOFF:"Persetujuan rilis independen"} as Record<string,string>)[kind];
  const reason=!supported?"Belum tersedia sebagai artefak yang bisa diverifikasi.":!item?"Bukti belum diajukan dan diperiksa.":!ok?"Bukti masih "+item.status.toLowerCase()+".":"Ada catatan verifikasi manusia untuk versi ini.";
  return {kind,label,requiredBeforePublish:prePublish,status:ok?"EVIDENCE_REVIEWED":item?.status??"NOT_SUBMITTED",satisfied:ok,supported,reason,validator:format?profile[format].validator:null,expectedProof:format?profile[format].proof:null,evidenceId:item?.id??null};
 });
 const incomplete=checks.filter(c=>c.requiredBeforePublish&&!c.satisfied);
 const historical=evidence.filter(e=>!evidenceCurrent(e,book.approvedAt,layout.version)).length;
 const suggestions=[
  "Pertahankan lima format eksplisit: DOCX, PDF, EPUB, HTML, Flipbook. Setiap format memerlukan checksum artefak, log validator dan inspeksi manusia.",
  genre?.outline??"Periksa struktur dan urutan bab sesuai genre.",
  genre?.proof??"Periksa hak, keaslian, dan bukti penyuntingan.",
  book.genre==="TEXTBOOK"||book.genre==="WORKBOOK"?"Tautkan tujuan belajar dengan materi, contoh, latihan, dan kunci jawaban yang ditinjau.":book.bookType==="FICTION"?"Periksa kesinambungan tokoh, alur, suara naratif, hak dan kontribusi penulis.":"Cocokkan klaim dan daftar pustaka dengan rujukan yang dapat dilacak.",
  "Untuk ISBN Indonesia, siapkan surat permohonan, halaman judul/verso, kata pengantar dan daftar isi bila relevan, naskah akhir bertanda watermark, SPKK atau surat izin yang tepat, serta tautan katalog penerbit.",
  "ISBN harus dibuktikan melalui penerbit dan Perpusnas; angka yang lolos checksum belum berarti sudah terdaftar. Untuk penggunaan yang tidak memerlukan ISBN, minta tinjauan penerapan aturan beserta alasan.",
  "Sesudah terbit, catat bukti terbit dan tautan ketersediaan publik yang permanen, tanda terima distribusi, dan tanda terima serah simpan bila berlaku menurut aturan Perpusnas 11/2025 serta UU 13/2018.",
  historical?"Terdapat "+historical+" catatan bukti versi lama. Sesudah perubahan persetujuan/tata letak, kirim ulang bukti untuk versi baru.":"Bukti yang masuk harus mengacu pada snapshot persetujuan dan versi tata letak yang sama."
 ];
 return {decision:problems.length||incomplete.length?"NO_GO":"EVIDENCE_REVIEWED_PENDING_INDEPENDENT_RELEASE",genre:genre?{name:genre.name,type:genre.type}:null,problems,checks,suggestions,formats:RELEASE_FORMATS.map(f=>({format:f,...profile[f],evidence:checks.find(c=>c.kind==="FORMAT_"+f)})),historicalEvidenceCount:historical,approvedAt:book.approvedAt?.toISOString()??null,layoutVersion:layout.version};
}
