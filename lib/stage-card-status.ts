export type CardColor="green"|"yellow"|"red";
export type StageEvaluation={name:string;complete:boolean;available:boolean;missing:string[]};
export type StageBook={editorialStage?:string;status:string;title:string;description:string;targetAudience:string;writingGoal:string;chapters:Array<{id:string;title:string;outlineObjective:string;content:string}>;stageReadiness?:{stages:StageEvaluation[]}};
export type StageCard={color:CardColor;label:string;hint:string};
const label:Record<CardColor,string>={green:"Lengkap",yellow:"Dalam proses",red:"Belum lengkap"};
const outcome=(color:CardColor,hint:string):StageCard=>({color,label:label[color],hint});
export function stageCard(book:StageBook,index:number):StageCard{
 const item=book.stageReadiness?.stages[index];
 if(!item)return outcome("red","Status backend belum tersedia");
 if(item.complete)return outcome("green","Tahap sudah melewati validasi backend.");
 const missing=item.missing.filter(m=>!/(siap\.|naskah tersimpan|simpan ide, lalu|periksa isinya)/i.test(m));
 const hint=missing.slice(0,2).join("; ")||"Tahap sedang dilengkapi.";
 if(!item.available)return outcome("red","Selesaikan tahap sebelumnya dahulu.");
 if(index===0){
  const started=Boolean(book.description.trim()||book.targetAudience.trim()||book.writingGoal.trim());
  return outcome(started?"yellow":"red",hint);
 }
 if(index===1)return outcome(book.chapters.length?"yellow":"red",hint);
 if(index===2)return outcome(book.chapters.some(c=>c.content.trim())?"yellow":"red",hint);
 return outcome("yellow",hint);
}
export function currentBookCard(book:StageBook):StageCard{
 const stage=book.status==="APPROVED"?4:book.status==="REVIEW"?3:book.editorialStage==="BRIEF"?0:book.editorialStage==="OUTLINE"?1:2;
 return stageCard(book,stage);
}
export function chapterCard(chapter:{title:string;outlineObjective:string;content:string},stage:"outline"|"writing"):StageCard{
 if(stage==="outline"){
  if(chapter.title.trim().length>=2&&chapter.outlineObjective.trim().length>=2)return outcome("green","Judul dan tujuan bab tersimpan.");
  return outcome(chapter.title.trim().length>=2?"yellow":"red","Lengkapi judul dan tujuan bab.");
 }
 if(chapter.content.trim().length>=20)return outcome("green","Naskah bab tersimpan, minimal 20 karakter.");
 return outcome(chapter.content.trim().length?"yellow":"red","Tambahkan isi naskah dan simpan.");
}
export function sectionCard(section:{title:string;objective:string;content?:string},requireContent=false):StageCard{
 if(section.title.trim().length>=2&&section.objective.trim().length>=2&&(!requireContent||section.content?.trim().length))return outcome("green","Isi wajib tersimpan.");
 if(section.title.trim().length>=2)return outcome("yellow","Lengkapi tujuan atau isi subbagian.");
 return outcome("red","Nama subbagian belum lengkap.");
}
