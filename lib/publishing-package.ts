import {z} from "zod";
import {automaticBookLists} from "./book-index";
export const publishingFields=["frontCover","titlePage","copyrightPage","preface","contentsIntro","readerGuide","afterword","glossary","references","bibliography","backCover"] as const;
export type PublishingField=typeof publishingFields[number];
export const packageSchema=z.object(Object.fromEntries(publishingFields.map(field=>[field,z.string().max(12000)])) as Record<PublishingField,z.ZodString>).strict();
export type PublishingPackage=z.infer<typeof packageSchema>;
type ContextBook={title:string;author?:string|null;subject:string;grade:string;genre?:string;bookType?:string;targetAudience?:string;writingGoal?:string;description?:string;chapters?:{title:string;content?:string;outlineObjective?:string}[]};
const marker="[PERLU DILENGKAPI DAN DIVERIFIKASI]";
const clean=(text:string|undefined|null,max=280)=>String(text||"").replace(/[\x00-\x1f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
const isAuthoringCommand=(text:string)=>/PERINTAH INDUK|PROMPT MASTER|KONSTITUSI PROYEK|Anda adalah (agen|AI)|instruksi untuk AI/i.test(text);
function contextualSummary(b:ContextBook){
 const desc=clean(b.description,400);
 if(desc&&!isAuthoringCommand(desc))return desc;
 const audience=clean(b.targetAudience,150)||"pembaca sesuai konteks buku";
 const goal=clean(b.writingGoal,320);
 return "Buku "+clean(b.subject,110)+" untuk "+audience+". "+(!goal||isAuthoringCommand(goal)?"Isi dan manfaat buku masih memerlukan ringkasan editorial yang ditinjau penulis.":"Tujuan penulisan: "+goal);
}
export function publishingDefaults(b:ContextBook):PublishingPackage{
 const title=clean(b.title,240),author=clean(b.author,150)||"[Nama penulis perlu dikonfirmasi]";
 const subject=clean(b.subject,110),audience=clean(b.targetAudience,200)||"pembaca sasaran yang ditetapkan penulis";
 const goal=clean(b.writingGoal,400),chapters=b.chapters||[];
 const chapterLines=chapters.map((c,i)=>String(i+1)+". "+clean(c.title,150)).join("\n")||"[Bab belum tersedia]";
 const genre=b.genre||"REFERENCE";
 const study=/TEXTBOOK|WORKBOOK/.test(genre);
 const p=study?"Untuk buku ajar, gunakan tujuan pembelajaran, contoh kontekstual, kegiatan, dan evaluasi yang sesuai jenjang.":"Untuk buku ini, jaga alur, ketepatan substansi, dan kebutuhan pembaca sesuai genre.";
 const description=contextualSummary(b);
 return {
 frontCover:"# "+title+"\n\n"+subject+" · Kelas "+clean(b.grade,20)+"\n\nPenulis: "+author+"\n\nDRAF — BELUM DISETUJUI",
 titlePage:"# "+title+"\n\n"+subject+"\n\nPenulis: "+author+"\n\nPenerbit, tempat dan tahun penerbitan resmi: "+marker+"\n\nStatus: Pratinjau draf",
 copyrightPage:"Judul: "+title+"\nPenulis: "+author+"\nGenre: "+genre+"\n\nPemegang hak cipta dan lisensi seluruh ilustrasi/kutipan: "+marker+"\nPenerbit dan alamat penerbit: "+marker+"\nPenyunting, editor dan ilustrator: "+marker+"\nISBN masing-masing edisi/format: BELUM DITETAPKAN. Tidak boleh dicantumkan sebelum diverifikasi Perpusnas.\nKDT dan keterangan cetakan: "+marker+"\n\nIni adalah naskah draf, bukan pernyataan hak resmi.",
 preface:"Kata Pengantar\n\nBuku berjudul \""+title+"\" disusun untuk "+audience+". Buku ini mengajak pembaca mempelajari "+subject+" melalui penjelasan dan contoh yang disusun berdasarkan kebutuhan pembaca.\n\n"+(goal&&!isAuthoringCommand(goal)?"Tujuan penulisan: "+goal.replace(/[.!?]+$/,"")+".\n\n":"")+p+"\n\nNaskah masih harus diperiksa secara editorial, ilmiah, bahasa, hak cipta, dan aksesibilitas sebelum diterbitkan.\n\nPenulis: "+author+" (draf, belum ditandatangani).",
 contentsIntro:"Daftar Isi (otomatis dari struktur naskah Stage 2 dan Stage 3; nomor halaman harus dihitung ulang oleh renderer akhir)\n\n"+chapterLines+"\n\nPenutup\nGlosarium\nReferensi dan Sumber\nDaftar Pustaka dan Bibliografi",
 readerGuide:"Petunjuk Pembaca\n\n"+description+"\n\nBaca bab sesuai urutan pada daftar isi. Gunakan tujuan dan contoh pada tiap bab untuk membangun pemahaman. "+p+"\n\nVersi digital menggunakan navigasi heading semantis, alternatif teks gambar, dan mode baca yang tersedia pada perangkat. Pengujian pembaca layar dan perangkat sentuh nyata belum dilakukan.",
 afterword:"Penutup\n\nBuku \""+title+"\" membahas "+subject+" melalui "+chapters.length+" bab berikut:\n"+chapterLines+"\n\n"+(goal&&!isAuthoringCommand(goal)?"Tujuan utama buku: "+goal.replace(/[.!?]+$/,"")+".\n\n":"")+"Periksa kembali pemahaman, keterkaitan antarbab, dan penerapannya. Bagian ini perlu ditinjau penulis agar menjadi kesimpulan yang benar-benar sesuai isi naskah.",
 glossary:"Glosarium\n\n"+marker+" — istilah dan definisi harus diambil dari isi naskah Stage 3, diverifikasi konteks dan ketepatan ilmiahnya. Jangan menambah definisi atau istilah yang tidak didukung sumber.",
 references:"Referensi dan Sumber\n\n"+marker+" — cantumkan hanya sumber yang benar-benar digunakan untuk klaim, data, tabel, ilustrasi, dan kutipan. Cantumkan sumber primer beserta halaman/DOI/URL yang dapat diverifikasi. Tidak ada sumber yang boleh dikarang oleh AI.",
 bibliography:"Daftar Pustaka dan Bibliografi\n\n"+marker+" — gunakan entri bibliografis yang telah diperiksa editor; nama penulis, tahun, judul, penerbit, DOI dan URL harus cocok dengan sumber aslinya. Tentukan satu gaya sitasi konsisten.",
 backCover:"Tentang Buku\n\n"+description+"\n\nGambaran isi:\n"+chapterLines+"\n\nDRAF — BELUM DISETUJUI. Area ISBN/barcode resmi tetap kosong sampai diverifikasi."
 };
}
export function resolvedPublishingPackage(book:ContextBook,payload:unknown):PublishingPackage{
 const defaults=publishingDefaults(book);
 const parsed=packageSchema.partial().safeParse(payload);
 return packageSchema.parse(Object.fromEntries(publishingFields.map(field=>[field,parsed.success?parsed.data[field]??defaults[field]:defaults[field]])));
}
export function publishingSequence(pkg:PublishingPackage,chapters:{title:string;content:string}[]){
 const generated=automaticBookLists(chapters);
 const notes=pkg.contentsIntro.startsWith("Daftar Isi (otomatis dari struktur")?"":pkg.contentsIntro.trim();
 const contents=[generated.contents,notes?"## Catatan penulis\n\n"+notes:""].filter(Boolean).join("\n\n");
 return [
 {kind:"frontCover",title:"Sampul Depan",content:pkg.frontCover},
 {kind:"titlePage",title:"Halaman Judul",content:pkg.titlePage},
 {kind:"copyrightPage",title:"Balik Halaman Judul dan Hak Cipta",content:pkg.copyrightPage},
 {kind:"preface",title:"Kata Pengantar",content:pkg.preface},
 {kind:"contentsIntro",title:"Daftar Isi",content:contents},
 ...generated.lists,
 {kind:"readerGuide",title:"Petunjuk Pembaca",content:pkg.readerGuide},
 ...chapters.map((chapter,i)=>({kind:"chapter-"+(i+1),title:chapter.title,content:chapter.content})),
 {kind:"afterword",title:"Penutup",content:pkg.afterword},
 {kind:"glossary",title:"Glosarium",content:pkg.glossary},
 {kind:"references",title:"Referensi dan Sumber",content:pkg.references},
 {kind:"bibliography",title:"Daftar Pustaka dan Bibliografi",content:pkg.bibliography},
 {kind:"backCover",title:"Sampul Belakang",content:pkg.backCover}
 ].filter(item=>item.content.trim());
}
