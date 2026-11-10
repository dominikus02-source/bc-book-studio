"use strict";
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client"),{createHash,randomBytes}=require("node:crypto");
const target=new URL(process.env.DATABASE_URL||"");
assert.equal(target.host+target.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),base="http://127.0.0.1:32979",users=[],books=[];
async function user(role="EDITOR"){
 const row=await db.studioUser.create({data:{role,name:"Hierarchy QA",active:true,email:randomBytes(12).toString("hex")+"@example.invalid"}});users.push(row.id);
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:row.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 return {...row,token};
}
async function call(path,method,expected,who,body){
 const response=await fetch(base+path,{method,headers:{...(who?{cookie:"bcstudio_session="+who.token}:{}),...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const content=await response.json().catch(()=>({}));
 assert.equal(response.status,expected,method+" "+path+" expected "+expected+" got "+response.status+": "+JSON.stringify(content).slice(0,300));
 return content;
}
async function main(){
 const owner=await user(),other=await user();
 const book=(await call("/api/books","POST",201,owner,{title:"Hierarchy QA",grade:"7",subject:"Fisika",genre:"TEXTBOOK",bookType:"NONFICTION"})).book;books.push(book.id);
 let b=(await call("/api/books/"+book.id,"GET",200,owner)).book;
 await call("/api/books/"+book.id,"PATCH",200,owner,{expectedVersion:b.updatedAt,description:"Buku konsep dan struktur ilmiah untuk kelas tujuh.",targetAudience:"Siswa",writingGoal:"Membangun konsep dan keterampilan."});
 await call("/api/books/"+book.id+"/workflow","POST",200,owner,{to:"OUTLINE"});
 const chapter=(await call("/api/books/"+book.id+"/chapters","POST",201,owner,{title:"Bab Energi",outlineObjective:"Menjelaskan perubahan energi"})).chapter;
 const root="/api/books/"+book.id+"/chapters/"+chapter.id+"/sections";
 await call(root,"GET",401);
 await call(root,"GET",404,other);
 const a=(await call(root,"POST",201,owner,{title:"Energi kinetik",objective:"Jelaskan prinsip energi kinetik"})).section;
 const b2=(await call(root,"POST",201,owner,{title:"Energi potensial",objective:"Jelaskan prinsip energi potensial"})).section;
 const child=(await call(root,"POST",201,owner,{title:"Perhitungan energi",objective:"Hitung energi dengan satuan benar",parentId:a.id})).section;
 await call(root,"POST",400,owner,{title:"Induk asing",objective:"Tidak sah",parentId:"bad-id"});
 await call(root+"/"+a.id,"DELETE",409,owner,{expectedVersion:a.updatedAt});
 await call(root+"/"+child.id,"PATCH",404,other,{title:"Dilarang",expectedVersion:child.updatedAt});
 const edited=(await call(root+"/"+child.id,"PATCH",200,owner,{title:"Perhitungan energi dalam SI",objective:"Hitung energi dengan satuan joule",expectedVersion:child.updatedAt})).section;
 await call(root+"/"+child.id,"PATCH",409,owner,{title:"Tab lama",expectedVersion:child.updatedAt});
 const list=(await call(root,"GET",200,owner)).sections;
 assert.equal(list.length,3);assert.equal(list.find(x=>x.id===child.id).parentId,a.id);
 assert(list.find(x=>x.id===child.id).revisions.length>=2);
 const prior=list.find(x=>x.id===child.id).revisions.find(x=>x.action==="UPDATE");
 const reverted=(await call(root+"/"+child.id,"PATCH",200,owner,{restoreRevision:prior.id,expectedVersion:edited.updatedAt})).section;
 assert.equal(reverted.title,child.title);
 await call(root+"/reorder","PATCH",428,owner,{parentId:null,ids:[b2.id,a.id]});
 await call(root+"/reorder","PATCH",404,other,{parentId:null,ids:[b2.id,a.id],expectedOrder:[a.id,b2.id]});
 await call(root+"/reorder","PATCH",200,owner,{parentId:null,ids:[b2.id,a.id],expectedOrder:[a.id,b2.id]});
 await call(root+"/reorder","PATCH",409,owner,{parentId:null,ids:[a.id,b2.id],expectedOrder:[a.id,b2.id]});
 assert.deepEqual((await call(root,"GET",200,owner)).sections.filter(s=>!s.parentId).sort((x,y)=>x.position-y.position).map(x=>x.id),[b2.id,a.id]);
 const latestChild=(await call(root,"GET",200,owner)).sections.find(x=>x.id===child.id);
 await call(root+"/"+child.id,"DELETE",200,owner,{expectedVersion:latestChild.updatedAt});
 const latestA=(await call(root,"GET",200,owner)).sections.find(x=>x.id===a.id);
 await call(root+"/"+a.id,"DELETE",200,owner,{expectedVersion:latestA.updatedAt});
 const archivedA=(await call(root,"GET",200,owner)).sections.find(x=>x.id===a.id);
 await call(root+"/"+child.id,"PATCH",409,owner,{restore:true,expectedVersion:(await call(root,"GET",200,owner)).sections.find(x=>x.id===child.id).updatedAt});
 await call(root+"/"+a.id,"PATCH",200,owner,{restore:true,expectedVersion:archivedA.updatedAt});
 const archivedChild=(await call(root,"GET",200,owner)).sections.find(x=>x.id===child.id);
 await call(root+"/"+child.id,"PATCH",200,owner,{restore:true,expectedVersion:archivedChild.updatedAt});
 const final=(await call(root,"GET",200,owner)).sections;
 assert.equal(final.filter(s=>!s.archivedAt).length,3);
 assert(final.find(s=>s.id===child.id).revisions.some(r=>r.action==="RESTORE_REVISION"));
 console.log("STAGE2_HIERARCHY_PASS: 2-level CRUD, RBAC, version 409, stale reorder, archive parent guard, restore and revision audit");
}
main().catch(e=>{console.error("STAGE2_HIERARCHY_FAIL",e);process.exitCode=1}).finally(async()=>{for(const id of books)await db.book.deleteMany({where:{id}}).catch(e=>console.error("CLEANUP_FAIL",e.message));for(const id of users)await db.studioUser.deleteMany({where:{id}}).catch(()=>{});await db.$disconnect()});
