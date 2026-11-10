"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto");
const url=new URL(process.env.DATABASE_URL||"");assert.equal(url.host+url.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),base="http://127.0.0.1:32979",users=[],books=[];
async function actor(){
 const row=await db.studioUser.create({data:{name:"Bulk QA",email:randomBytes(11).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});users.push(row.id);
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:row.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 return {...row,token};
}
async function call(path,method,status,user,payload){
 const response=await fetch(base+path,{method,headers:{...(user?{cookie:"bcstudio_session="+user.token}:{}),...(payload?{"Content-Type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined});
 const content=await response.json().catch(()=>({}));assert.equal(response.status,status,method+" "+path+" expected "+status+" got "+response.status+" "+JSON.stringify(content).slice(0,480));return content;
}
function fixtures(){
 const chapters=["Aetheria","Musim Hujan","Mars 2087","Ekosistem Indonesia","Arsip Nomor Tujuh"],genres=["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"],tiers=["PUBLIC","PREMIUM","DRAFT"];
 return Array.from({length:25},(_,i)=>({chapterTitle:"Bab "+(Math.floor(i/5)+1)+": "+chapters[Math.floor(i/5)],subsectionTitle:"Bagian "+(i%5+1),sortOrder:i%5+1,
 content:"Paragraf utama menjelaskan perkembangan materi "+(i+1)+", dengan fakta atau konflik yang sesuai tema bab serta runtutan yang mudah diikuti.\n\n\"Apa langkah berikutnya?\" tanya tokoh. \"Periksa hasilnya dahulu!\" jawab rekannya. Dialog dan tanda baca ini sengaja menguji pembaca layar.",
 genreTarget:genres[Math.floor(i/5)],accessTier:tiers[i%3]}));
}
async function run(){
 const owner=await actor(),other=await actor();
 const book=await db.book.create({data:{ownerId:owner.id,title:"QA Impor Massal",grade:"7",subject:"Materi Uji",description:"Proyek pengujian 25 data dummy massal.",editorialStage:"OUTLINE"}});books.push(book.id);
 const root="/api/books/"+book.id+"/bulk-outline";
 await call(root,"GET",401);
 await call(root,"GET",404,other);
 const init=await call(root,"GET",200,owner);assert.equal(init.rows.length,0);assert.equal(init.version.length,64);
 const rows=fixtures();
 await call(root,"POST",404,other,{expectedVersion:init.version,rows});
 await call(root,"POST",400,owner,{expectedVersion:init.version,rows:[rows[0],rows[0]]});
 await call(root,"POST",400,owner,{expectedVersion:init.version,rows:[rows[0],{...rows[0],subsectionTitle:"Different"}]});
 await call(root,"POST",400,owner,{expectedVersion:init.version,rows:[{...rows[0],sortOrder:0}]});
 await call(root,"POST",400,owner,{expectedVersion:init.version,rows:[{...rows[0],content:"One paragraph only."}]});
 assert.equal(await db.chapter.count({where:{bookId:book.id}}),0);
 const imported=await call(root,"POST",200,owner,{expectedVersion:init.version,rows});
 assert.equal(imported.createdChapters,5);assert.equal(imported.createdSections,25);
 let data=await call(root,"GET",200,owner);assert.equal(data.rows.length,25);
 assert.deepEqual(new Set(data.rows.map(x=>x.genreTarget)),new Set(["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"]));
 assert.deepEqual(new Set(data.rows.map(x=>x.accessTier)),new Set(["PUBLIC","PREMIUM","DRAFT"]));
 assert.equal(await db.chapter.count({where:{bookId:book.id}}),5);
 assert.equal(await db.outlineSection.count({where:{bookId:book.id,archivedAt:null}}),25);
 await call(root,"POST",409,owner,{expectedVersion:init.version,rows});
 const repeat=await call(root,"POST",200,owner,{expectedVersion:data.version,rows});assert.equal(repeat.createdSections,0);assert.equal(repeat.updatedSections,0);assert.equal(repeat.unchanged,25);
 data=await call(root,"GET",200,owner);
 const revised=rows.map(r=>({...r}));revised[0].content+="\n\nTeks revisi digunakan untuk memeriksa operasi update.";
 const updated=await call(root,"POST",200,owner,{expectedVersion:data.version,rows:revised});
 assert.equal(updated.updatedSections,1);
 let item=(await call(root,"GET",200,owner)).rows[0];assert(item.content.includes("Teks revisi"));
 const revision=await db.outlineSectionRevision.findMany({where:{sectionId:item.id}});
 assert(revision.some(r=>r.action==="BULK_UPDATE"));
 const sectionUrl="/api/books/"+book.id+"/chapters/"+item.chapterId+"/sections/"+item.id;
 await call(sectionUrl,"PATCH",404,other,{expectedVersion:new Date(item.updatedAt).toISOString(),accessTier:"PREMIUM"});
 const individual=(await call(sectionUrl,"PATCH",200,owner,{expectedVersion:new Date(item.updatedAt).toISOString(),genreTarget:"SCI_FI",accessTier:"PREMIUM",content:item.content+"\\n\\nPerubahan individual pada konten untuk pengujian CRUD."})).section;
 assert.equal(individual.genreTarget,"SCI_FI");assert.equal(individual.accessTier,"PREMIUM");
 await call(sectionUrl,"PATCH",409,owner,{expectedVersion:new Date(item.updatedAt).toISOString(),accessTier:"DRAFT"});
 item=(await call(root,"GET",200,owner)).rows.find(x=>x.id===item.id);
 await call(sectionUrl,"DELETE",200,owner,{expectedVersion:new Date(item.updatedAt).toISOString()});
 data=await call(root,"GET",200,owner);assert.equal(data.rows.length,24);
 const archive=await db.outlineSection.findUniqueOrThrow({where:{id:item.id}});
 await call(sectionUrl,"PATCH",200,owner,{expectedVersion:archive.updatedAt.toISOString(),restore:true});
 assert.equal((await call(root,"GET",200,owner)).rows.length,25);
 console.log("BULK_25_API_PASS: 5 chapters/25 subsections, 5 genres, 3 tiers, RBAC, validation, atomic rollback, upsert, version conflict, history, archive/restore");
}
run().catch(e=>{console.error("BULK_25_FAIL",e);process.exitCode=1}).finally(async()=>{for(const id of books)await db.book.deleteMany({where:{id}}).catch(e=>console.error("CLEANUP",e.message));for(const id of users)await db.studioUser.deleteMany({where:{id}}).catch(()=>{});await db.$disconnect()});
