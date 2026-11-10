import {db} from "./db";
import {LETTER_KINDS,makeLetter} from "./isbn-office";
import {publishingDefaults} from "./publishing-package";
export const DRAFT_KINDS=[...LETTER_KINDS,"title_pages"] as const;
export async function dossierContext(id:string){
 return db.isbnApplication.findFirst({where:{id,archivedAt:null},include:{publisher:true,book:{include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}}}}}});
}
export async function documentDraft(applicationId:string,kind:string){
 const event=await db.isbnEvent.findFirst({where:{applicationId,action:"DOSSIER_DRAFT",detail:{path:["kind"],equals:kind}},orderBy:[{createdAt:"desc"},{id:"desc"}]});
 const detail=event?.detail as {text?:string;deleted?:boolean}|undefined;
 return {version:event?.id||null,text:detail?.deleted?null:detail?.text??null};
}
export function defaultDocument(app:NonNullable<Awaited<ReturnType<typeof dossierContext>>>,kind:typeof DRAFT_KINDS[number]){
 if(kind!=="title_pages")return makeLetter({kind,publisher:app.publisher,application:app}).join("\n");
 const pkg=publishingDefaults({...app.book,title:app.title,author:app.authorNames});
 return ["DRAF HALAMAN AWAL — TINJAU SEBELUM PENGAJUAN",pkg.titlePage,pkg.copyrightPage,pkg.preface,
 "Daftar isi\n"+app.book.chapters.map((c,i)=>(i+1)+". "+c.title).join("\n"),
 "Nomor halaman mengikuti naskah final. Penerbit: "+app.imprint].join("\n\n");
}
export async function stampDeclarations(applicationId:string){
 const events=await db.isbnEvent.findMany({where:{applicationId,action:"DOCUMENT_UPLOADED"},orderBy:{createdAt:"asc"}});
 const result:Record<string,{stampMode:string;attested:boolean}>={};
 for(const event of events){const v=event.detail as {documentId?:string;stampMode?:string;attested?:boolean};if(v.documentId)result[v.documentId]={stampMode:v.stampMode||"NONE",attested:v.attested===true}}
 return result;
}
