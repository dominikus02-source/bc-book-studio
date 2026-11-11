import {bookLanguage} from "./book-language";

export const audienceChoices = [
 {id:"sd",grade:"4" as const,idLabel:"Siswa sekolah dasar",enLabel:"Primary-school students"},
 {id:"smp",grade:"8" as const,idLabel:"Siswa sekolah menengah pertama",enLabel:"Junior-secondary students"},
 {id:"sma",grade:"11" as const,idLabel:"Siswa sekolah menengah atas",enLabel:"Senior-secondary students"},
 {id:"guru",grade:"Referensi" as const,idLabel:"Guru dan pendidik",enLabel:"Teachers and educators"},
 {id:"umum",grade:"Referensi" as const,idLabel:"Pembaca umum",enLabel:"General readers"},
 {id:"internasional",grade:"Referensi" as const,idLabel:"Pembaca lintas negara",enLabel:"International readers"},
] as const;
export const bookKinds = [
 {id:"nonfiction" as const,bookType:"NONFICTION" as const,genre:"REFERENCE" as const,pageSize:"A4" as const,idLabel:"Nonfiksi",enLabel:"Nonfiction"},
 {id:"fiction" as const,bookType:"FICTION" as const,genre:"NOVEL" as const,pageSize:"A5" as const,idLabel:"Fiksi",enLabel:"Fiction"},
 {id:"textbook" as const,bookType:"NONFICTION" as const,genre:"TEXTBOOK" as const,pageSize:"A4" as const,idLabel:"Buku ajar",enLabel:"Textbook"},
] as const;
export type AudienceId = typeof audienceChoices[number]["id"];
export type BookKindId = typeof bookKinds[number]["id"];
export type GuidedBookInput = {
 title:string;
 author:string;
 language:"id"|"en";
 audience:AudienceId;
 kind:BookKindId;
 subject?:string;
 goal?:string;
};

const defaultGoal = {
 id:"Menyusun draf yang akan ditinjau dan disempurnakan penulis.",
 en:"Draft a manuscript the author will review and revise.",
};

export function guidedBookInput(input:GuidedBookInput){
 const language = bookLanguage(input.language);
 const audience = audienceChoices.find(item=>item.id===input.audience);
 const kind = bookKinds.find(item=>item.id===input.kind);
 if(!audience||!kind)throw Error("Pilihan pembaca atau jenis buku tidak dikenal.");
 const title = input.title.trim();
 const author = input.author.trim();
 if(title.length<3||title.length>180)throw Error("Judul minimal 3 karakter.");
 if(author.length<2||author.length>180)throw Error("Nama penulis minimal 2 karakter.");
 const audienceLabel = language==="en"?audience.enLabel:audience.idLabel;
 const subjectDefault = kind.id==="textbook"?(language==="en"?"Learning":"Pembelajaran"):kind.id==="fiction"?(language==="en"?"Fiction":"Fiksi"):(language==="en"?"General":"Umum");
 const subject = (input.subject?.trim()||subjectDefault).slice(0,100);
 if(subject.length<2)throw Error("Kategori minimal 2 karakter.");
 const goal = (input.goal?.trim()||defaultGoal[language]).slice(0,1500);
 const description = (language==="en"
  ?`Draft of "${title}" for ${audienceLabel}. ${goal}`
  :`Draf "${title}" untuk ${audienceLabel}. ${goal}`).slice(0,12000);
 return {
  title,author,language,subject,grade:audience.grade,bookType:kind.bookType,genre:kind.genre,
  pageSize:kind.pageSize,targetAudience:audienceLabel,writingGoal:goal,description,
 };
}

export function starterChapter(language:"id"|"en"){
 if(bookLanguage(language)==="en")return {
  title:"Chapter 1",
  outlineObjective:"Introduce the subject and the question this chapter answers.",
  content:"## Opening\n\nWrite the main idea of this chapter in your own words. Tell the reader what they will understand or experience, then add one example you can verify.\n",
 };
 return {
  title:"Bab 1",
  outlineObjective:"Memperkenalkan pokok bahasan dan pertanyaan yang dijawab bab ini.",
  content:"## Pembuka\n\nTuliskan gagasan utama bab ini dengan kata-kata Anda. Jelaskan apa yang akan pembaca pahami atau alami, lalu tambahkan satu contoh yang dapat Anda periksa.\n",
 };
}
