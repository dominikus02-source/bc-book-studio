import {z} from "zod";
import {db} from "./db";
import type {PaginationPart} from "./pagination-output";

const packageSchema=z.object({bookId:z.string(),enabled:z.boolean(),items:z.array(z.object({
 chapterId:z.string(),sourceDraftId:z.string(),activityCode:z.string().regex(/^[A-Z0-9-]{1,60}$/),
})).max(30)});
const draftSchema=z.object({questionObjective:z.string(),question:z.string().min(1),questionAnswer:z.string().min(1),questionExplanation:z.string().min(1)});
export const answerSection=/^#{2,4}\s+Kunci dan pembahasan[^\n]*\n([\s\S]*?)(?=^#{1,4}[ \t]|(?![\s\S]))/mi;

export async function worksheetPreviewProducts(book:{id:string;ownerId:string;title:string;chapters:{id:string;title:string;content:string}[]}){
 const row=await db.studioFormDraft.findFirst({where:{ownerId:book.ownerId,module:"WORKSHEET_PACKAGE:"+book.id},orderBy:{updatedAt:"desc"}});
 if(!row)return [];
 const payload=packageSchema.parse(row.payload);
 if(payload.bookId!==book.id)throw Error("LKPD merujuk ke buku berbeda.");
 if(!payload.enabled||!payload.items.length)return [];
 const ids=payload.items.map(item=>item.sourceDraftId);
 if(new Set(ids).size!==ids.length)throw Error("Draf LKPD duplikat.");
 const drafts=await db.studioFormDraft.findMany({where:{id:{in:ids},ownerId:book.ownerId,module:"Studio Latihan"}});
 const mapped=payload.items.map(item=>{
  const chapter=book.chapters.find(chapter=>chapter.id===item.chapterId);
  const draft=drafts.find(draft=>draft.id===item.sourceDraftId);
  if(!chapter||!draft)throw Error("Bab atau draf LKPD tidak ditemukan.");
  return {chapter,draft,item,content:draftSchema.parse(draft.payload)};
 });
 return [false,true].map(teacher=>{
  const label=teacher?"Panduan Guru":"LKPD Siswa";
  const title=label+" - "+book.title;
  const main=mapped.map(({chapter,draft,item,content},i)=>({
   kind:"chapter-"+(i+1),title:"Bab "+(i+1)+" - "+draft.title.replace(/^\[DUMMY ENERGY\]\s*LKPD\s+\d+\s*-\s*/,""),
   content:teacher?["## Kunci latihan buku",answerSection.exec(chapter.content)?.[1]?.trim()||"Kunci latihan buku belum ditandai.", "## Kunci dan rubrik LKPD",content.questionAnswer,content.questionExplanation].join("\n\n"):
    ["**Tujuan belajar**",content.questionObjective.split("\n")[0],content.question.replace(/_{8,}/g,"................................................................................"),"Kode aktivitas: "+item.activityCode].join("\n\n"),
  }));
  const parts:PaginationPart[]=[
   {kind:"frontCover",title:"Sampul Depan",content:"**"+title+"**\n\nDRAF - Pratinjau editorial"},
   {kind:"titlePage",title:"Keterangan Edisi",content:"Bahan pendamping "+book.title+". Edisi contoh."},
   {kind:"preface",title:"Kata Pengantar",content:teacher?"Panduan ini mendampingi penilaian latihan buku dan LKPD.":"Kerjakan LKPD setelah membaca bab yang terkait."},
   {kind:"contentsIntro",title:"Daftar Isi",content:main.map(part=>"**"+part.title+"**").join("\n\n")},
   {kind:"readerGuide",title:"Petunjuk Penggunaan",content:teacher?"Cocokkan jawaban dengan rubrik. Terima metode alternatif yang setara.":"Tunjukkan langkah pengerjaan dan tuliskan satuan yang sesuai."},
   ...main,
   {kind:"afterword",title:"Penutup",content:teacher?"Gunakan hasil penilaian untuk menentukan tindak lanjut.":"Catat satu konsep yang perlu kamu latih kembali."},
   {kind:"references",title:"Rujukan Pendamping",content:book.title+"."},
   {kind:"backCover",title:"Sampul Belakang",content:label+" untuk "+book.title+"."},
  ];
  return {prefix:teacher?"Panduan-Guru":"LKPD-Siswa",title,parts};
 });
}
