import { db } from "./db";
import type { Prisma } from "@prisma/client";
import {briefGenreIssues} from "./genre-policy";

const briefSelect = {
 id:true, approvedAt:true, status:true, editorialStage:true, title:true, subject:true, description:true,
 targetAudience:true, writingGoal:true, author:true, genre:true, bookType:true, pageSize:true, updatedAt:true,
 publication:{select:{unpublishedAt:true}}, approvalSnapshots:{select:{approvedAt:true}},
 chapters:{where:{archivedAt:null},orderBy:{position:"asc"},select:{title:true,outlineObjective:true,content:true}},
} satisfies Prisma.BookSelect;
type Brief = Prisma.BookGetPayload<{select:typeof briefSelect}>;

export function briefMissing(book:{title:string;subject:string;targetAudience:string;writingGoal:string;description:string;author:string;genre:string;bookType:string;pageSize:string}){
 const missing:string[]=[];
 if(book.title.trim().length<3)missing.push("Judul buku (minimal 3 karakter)");
 if(book.subject.trim().length<2)missing.push("Bidang buku");
 if(!book.targetAudience.trim())missing.push("Pembaca sasaran");
 if(!book.writingGoal.trim())missing.push("Tujuan penulisan");
 if(book.description.trim().length<20)missing.push("Sinopsis (minimal 20 karakter)");
 missing.push(...briefGenreIssues(book));
 return missing;
}
export function stageReadiness(book:Brief){
 const brief=briefMissing(book);
 const outline=book.chapters.length?book.chapters.filter(c=>!c.outlineObjective.trim()).map(c=>"Isi tujuan bab: "+c.title):["Tambahkan sedikitnya satu bab."];
 const writing=book.chapters.length?book.chapters.filter(c=>c.content.trim().length<20).map(c=>"Lengkapi isi bab: "+c.title):["Tambahkan bab melalui Rancang."];
 const reachedOutline=book.editorialStage!=="BRIEF"||book.status!=="DRAFT";
 const reachedWriting=["WRITING","EDITING","REVIEW","LAYOUT"].includes(book.editorialStage)||book.status!=="DRAFT";
 const approved=book.status==="APPROVED"&&book.approvedAt!==null&&book.approvalSnapshots.some(snapshot=>snapshot.approvedAt.getTime()===book.approvedAt!.getTime());
 const published=Boolean(book.publication&&!book.publication.unpublishedAt);
 const stages=[
  {name:"Ide",complete:reachedOutline&&!brief.length,available:true,missing:brief.length?brief:["Simpan ide, lalu pilih Lanjut ke Rancang."]},
  {name:"Rancang",complete:reachedWriting&&!outline.length,available:reachedOutline,missing:outline.length?outline:["Kerangka siap. Lanjutkan menulis isi setiap bab."]},
  {name:"Tulis",complete:reachedWriting&&!writing.length,available:reachedWriting,missing:writing.length?writing:["Naskah tersimpan. Periksa isinya sebelum mengajukan review."]},
  {name:"Review",complete:approved,available:book.status!=="DRAFT"||(reachedWriting&&!brief.length&&!outline.length&&!writing.length),missing:[book.status==="REVIEW"?"Naskah sedang diperiksa peninjau. Anda dapat membacanya sambil menunggu.":"Lengkapi pemeriksaan dan pilih peninjau yang berbeda dari penulis."]},
  {name:"Terbit",complete:published,available:approved,missing:[published?"Buku telah dipublikasikan.":"Atur tata letak, periksa hasil, lalu konfirmasikan publikasi."]},
 ];
 const missing=book.editorialStage==="OUTLINE"?[...brief,...outline]:book.editorialStage==="BRIEF"?brief:writing;
 return {stage:book.editorialStage,ready:book.status==="DRAFT"&&["BRIEF","OUTLINE"].includes(book.editorialStage)&&missing.length===0,missing,stages};
}

function findOwnedBook(tx:Prisma.TransactionClient,bookId:string,actorId:string){
 return tx.book.findFirst({where:{id:bookId,ownerId:actorId,archivedAt:null},select:briefSelect});
}

export async function workflowReadiness(bookId:string,actorId:string){
 const book=await findOwnedBook(db,bookId,actorId);
 return book ? stageReadiness(book) : null;
}

export async function transition(bookId:string,to:"OUTLINE"|"WRITING",actor:{id:string}){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${bookId} AND "ownerId" = ${actor.id} FOR UPDATE`;
  const book=await findOwnedBook(tx,bookId,actor.id);
  if(!book)return {status:404,body:{error:"Buku tidak ditemukan."}};
  const state=stageReadiness(book);
  const from=to==="OUTLINE"?"BRIEF":"OUTLINE";
  if(!state.ready||state.stage!==from)return {status:409,body:{...state,error:"Tahap ini belum dapat dilanjutkan."}};
  const updated=await tx.book.updateMany({
   where:{id:bookId,ownerId:actor.id,status:"DRAFT",editorialStage:from,updatedAt:book.updatedAt},
   data:{editorialStage:to},
  });
  if(!updated.count)return {status:409,body:{error:"Buku berubah. Muat ulang sebelum melanjutkan."}};
  await tx.review.create({data:{bookId,decision:"stage:"+from+":"+to,note:"Actor: "+actor.id}});
  return {status:200,body:{stage:to}};
 });
}
