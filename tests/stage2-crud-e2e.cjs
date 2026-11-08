"use strict";
const assert=require("node:assert/strict");
const {createHash,randomBytes}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const target=new URL(process.env.DATABASE_URL||"");
assert.equal(target.host+target.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),base="http://127.0.0.1:32979",users=[],books=[];
async function actor(role="EDITOR"){
 const user=await db.studioUser.create({data:{name:"Outline QA",email:randomBytes(12).toString("hex")+"@example.invalid",active:true,role}});users.push(user.id);
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 return {...user,token};
}
async function call(path,method,expected,user,data){
 const r=await fetch(base+path,{method,headers:{...(user?{cookie:"bcstudio_session="+user.token}:{}),...(data?{"content-type":"application/json"}:{})},body:data?JSON.stringify(data):undefined});
 const out=await r.json().catch(()=>({}));assert.equal(r.status,expected,method+" "+path+" expected "+expected+" got "+r.status+" "+JSON.stringify(out).slice(0,320));return out;
}
async function main(){
 const owner=await actor(),outsider=await actor();
 const {book}=await call("/api/books","POST",201,owner,{title:"QA Kerangka",grade:"7",subject:"IPA",genre:"TEXTBOOK",bookType:"NONFICTION"});books.push(book.id);
 const p="/api/books/"+book.id;
 let version=(await call(p,"GET",200,owner)).book.updatedAt;
 await call(p,"PATCH",200,owner,{expectedVersion:version,description:"Buku struktur konsep dan latihan IPA untuk siswa kelas VII.",targetAudience:"Siswa kelas VII",writingGoal:"Memahami konsep dan mengerjakan soal."});
 await call(p+"/workflow","POST",200,owner,{to:"OUTLINE"});
 const chapters=[];
 for(let i=1;i<=3;i++)chapters.push((await call(p+"/chapters","POST",201,owner,{title:"Bab "+i,outlineObjective:"Memahami konsep bagian "+i+" secara tepat."})).chapter);
 const ids=chapters.map(x=>x.id);
 await call(p+"/chapters/reorder","PATCH",428,owner,{ids:[ids[2],ids[0],ids[1]]});
 await call(p+"/chapters/reorder","PATCH",404,outsider,{ids:[ids[2],ids[0],ids[1]],expectedOrder:ids});
 await call(p+"/chapters/reorder","PATCH",400,owner,{ids:[ids[0],ids[0],ids[2]],expectedOrder:ids});
 await call(p+"/chapters/reorder","PATCH",200,owner,{ids:[ids[2],ids[0],ids[1]],expectedOrder:ids});
 await call(p+"/chapters/reorder","PATCH",409,owner,{ids:[ids[0],ids[1],ids[2]],expectedOrder:ids});
 const current=(await call(p,"GET",200,owner)).book.chapters;
 assert.deepEqual(current.map(c=>c.id),[ids[2],ids[0],ids[1]]);
 assert(current.map(c=>c.position).every((x,i)=>x===i+1));
 const old=chapters[1];
 await call(p+"/chapters/"+old.id,"DELETE",428,owner);
 await call(p+"/chapters/"+old.id,"DELETE",404,outsider,{expectedVersion:old.updatedAt});
 let fresh=(await call(p+"/chapters/"+old.id,"GET",200,owner)).chapter;
 await call(p+"/chapters/"+old.id,"PATCH",200,owner,{title:"Bab dua diperbarui",outlineObjective:"Tujuan revisi kerangka yang terbaru",expectedVersion:fresh.updatedAt});
 await call(p+"/chapters/"+old.id,"DELETE",409,owner,{expectedVersion:fresh.updatedAt});
 fresh=(await call(p+"/chapters/"+old.id,"GET",200,owner)).chapter;
 await call(p+"/chapters/"+old.id,"DELETE",200,owner,{expectedVersion:fresh.updatedAt});
 const archive=(await call(p+"/chapters","GET",200,owner)).archived;
 const archived=archive.find(x=>x.id===old.id);assert(archived,"Chapter missing from archive");
 await call(p+"/chapters/"+old.id,"GET",404,owner);
 await call(p+"/chapters/"+old.id,"PATCH",200,owner,{restoreArchived:true,expectedVersion:archived.updatedAt});
 const restored=(await call(p,"GET",200,owner)).book.chapters;
 assert.equal(restored.length,3);
 assert.equal(restored.at(-1).id,old.id);
 assert.equal(restored.at(-1).title,"Bab dua diperbarui");
 console.log("STAGE2_CRUD_API_PASS: ordered outline, versioned 409, owner isolation, 428 archive, restore and integrity");
}
main().catch(e=>{console.error("STAGE2_FAIL",e);process.exitCode=1}).finally(async()=>{for(const id of books)await db.book.deleteMany({where:{id}}).catch(()=>{});for(const id of users)await db.studioUser.deleteMany({where:{id}}).catch(()=>{});await db.$disconnect()});
