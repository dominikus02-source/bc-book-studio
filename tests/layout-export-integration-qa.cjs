"use strict";
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client");
const {randomBytes,createHash}=require("node:crypto");
const JSZip=require("jszip");
const fs=require("node:fs");const path=require("node:path");
const db=new PrismaClient();
const origin="http://127.0.0.1:32979";
let bookId,userId,reviewerId,token;
async function call(path,method="GET",body){
 const res=await fetch(origin+path,{method,headers:{cookie:"bcstudio_session="+token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 return res;
}
async function main(){
 const target=new URL(process.env.DATABASE_URL||"");
 assert.equal(target.host+target.pathname,"127.0.0.1:55999/bookstudio_import_qa","QA database required");
 const editor=await db.studioUser.create({data:{name:"Layout Export QA",role:"EDITOR",email:randomBytes(12).toString("hex")+"@example.invalid",active:true}});
 userId=editor.id;token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+900000)}});
 const reviewer=await db.studioUser.create({data:{name:"Reviewer QA",role:"REVIEWER",email:randomBytes(12).toString("hex")+"@example.invalid",active:true}});reviewerId=reviewer.id;
 const title="QA Layout "+randomBytes(4).toString("hex");
 const at=new Date();
 const manuscript={title,author:"Penulis QA",subject:"IPA",grade:"7",description:"Deskripsi untuk QA",bookType:"NONFICTION",genre:"TEXTBOOK",pageSize:"A4",chapters:[{position:1,title:"Bab pertama",content:"## Subjudul penting\n\nParagraf pertama yang harus menjadi baris sendiri.\n\n- Butir hijau\n- Butir biru\n\n1. Langkah pertama\n2. Langkah kedua\n\n| Istilah | Arti |\n|---|---|\n| Biotik | Makhluk hidup |\n\n> Kutipan pembelajaran"},{position:2,title:"Bab kedua",content:"Isi kedua dengan teks unik."}],assets:[]};
 const book=await db.book.create({data:{ownerId:userId,title,author:manuscript.author,subject:manuscript.subject,grade:"7",description:manuscript.description,status:"DRAFT",chapters:{create:manuscript.chapters}}}); bookId=book.id;
 for(const fmt of ["pdf","docx","epub","html"]){
  const blocked=await call("/api/books/"+bookId+"/export?format="+fmt);
  assert.equal(blocked.status,409,"Draft final must be blocked "+fmt);
  const res=await call("/api/books/"+bookId+"/export?format="+fmt+"&preview=1");
  assert.equal(res.status,200,fmt+" preview status "+res.status+" "+(await res.clone().text()).slice(0,120));
  const bytes=Buffer.from(await res.arrayBuffer());assert(bytes.length>100,fmt+" empty");
  if(fmt==="pdf")assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
  if(fmt==="docx"){const z=await JSZip.loadAsync(bytes);const xml=await z.file("word/document.xml").async("string");assert(z.file("word/styles.xml"));assert(xml.includes('w:pStyle w:val="Heading2"'));assert(xml.includes("<w:tbl>"));assert(xml.includes("Butir hijau"));assert(!xml.includes("## Subjudul penting"));}
  if(fmt==="epub"){const z=await JSZip.loadAsync(bytes);assert.equal(await z.file("mimetype").async("string"),"application/epub+zip");const docs=await Promise.all(Object.keys(z.files).filter(name=>name.endsWith(".xhtml")).map(name=>z.file(name).async("string")));const chapter=docs.find(x=>x.includes("Subjudul penting")&&x.includes("Butir hijau"));assert(chapter,"EPUB must include the formatted chapter");assert(/<h[1-6]\b[^>]*>/.test(chapter));assert(chapter.includes("<ul"));assert(chapter.includes("<table"));assert(!chapter.includes("## Subjudul penting"));}
  if(fmt==="html"){const html=bytes.toString();assert(html.includes("DRAF - PRATINJAU"));assert(html.includes("<h2>Subjudul penting</h2>"));assert(html.includes("<ul>"));assert(html.includes("<table>"));assert(!html.includes("## Subjudul penting"));}
  console.log("DRAFT_PREVIEW_PASS",fmt,bytes.length);
 }
 await db.book.update({where:{id:bookId},data:{status:"APPROVED",approvedAt:at,editorialStage:"LAYOUT"}});
 await db.bookApprovalSnapshot.create({data:{bookId,approvedAt:at,reviewerId,manuscript}});
 const base="/api/books/"+bookId+"/layout";
 let r=await call(base);assert.equal(r.status,200);let current=await r.json();assert.equal(current.saved,false);
 r=await call(base,"PATCH",{snapshot:current.snapshot,expectedVersion:current.version,settings:{pageSize:"A5",order:[2,1]}});assert.equal(r.status,200,await r.text());
 r=await call(base);current=await r.json();assert.deepEqual(current.settings.order,[2,1]);assert.equal(current.settings.pageSize,"A5");assert.equal(current.saved,true);
 r=await call(base,"PATCH",{snapshot:current.snapshot,expectedVersion:0,settings:{pageSize:"A4",order:[1,2]}});assert.equal(r.status,409);
 r=await call(base,"PATCH",{snapshot:current.snapshot,expectedVersion:current.version,settings:{pageSize:"A4",order:[1,1]}});assert.equal(r.status,400);
 console.log("LAYOUT_CRUD_VALIDATION_PASS");
 for(const fmt of ["pdf","docx","epub","html"]){
  const res=await call("/api/books/"+bookId+"/export?format="+fmt);
  assert.equal(res.status,200,fmt+" final status "+res.status);
  const bytes=Buffer.from(await res.arrayBuffer());assert(bytes.length>100);
  const qaPath=path.join(process.cwd(),"artifacts","structured-format-qa","api-final");fs.mkdirSync(qaPath,{recursive:true});fs.writeFileSync(path.join(qaPath,"structured-book."+fmt),bytes);
  if(fmt==="html"){const html=bytes.toString();assert(html.indexOf("Bab kedua")<html.indexOf("Bab pertama"));}
  if(fmt==="docx"){const zip=await JSZip.loadAsync(bytes);const xml=await zip.file("word/document.xml").async("string");assert(xml.indexOf("Bab kedua")<xml.indexOf("Bab pertama"));}
  if(fmt==="epub"){const zip=await JSZip.loadAsync(bytes);const pages=await Promise.all(Object.keys(zip.files).filter(x=>/\.(xhtml|ncx)$/.test(x)).map(x=>zip.file(x).async("string")));assert(pages.some(x=>x.includes("Bab kedua")));assert(pages.some(x=>x.includes("Bab pertama")));const nav=pages.find(x=>x.includes("Bab kedua")&&x.includes("Bab pertama"));if(nav)assert(nav.indexOf("Bab kedua")<nav.indexOf("Bab pertama"));}
  console.log("APPROVED_EXPORT_PASS",fmt,bytes.length);
 }
 r=await call(base,"PATCH",{snapshot:current.snapshot,expectedVersion:current.version,settings:null});assert.equal(r.status,200);
 r=await call(base);current=await r.json();assert.equal(current.saved,false);assert.deepEqual(current.settings.order,[1,2]);
 console.log("LAYOUT_ARCHIVE_PASS");
}
main().catch(e=>{console.error("LAYOUT_EXPORT_QA_FAIL",e);process.exitCode=1}).finally(async()=>{
 if(bookId){await db.bookLayout.deleteMany({where:{bookId}});await db.bookApprovalSnapshot.deleteMany({where:{bookId}});await db.review.deleteMany({where:{bookId}});await db.chapter.deleteMany({where:{bookId}});await db.book.delete({where:{id:bookId}}).catch(e=>console.error("cleanup book",e.message))}
 if(userId)await db.studioUser.delete({where:{id:userId}}).catch(e=>console.error("cleanup editor",e.message));
 if(reviewerId)await db.studioUser.delete({where:{id:reviewerId}}).catch(e=>console.error("cleanup reviewer",e.message));
 await db.$disconnect();
});
