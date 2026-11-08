"use strict";
const assert=require("node:assert/strict");
const {randomBytes,createHash}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const fs=require("node:fs"),path=require("node:path");
if(!process.env.DATABASE_URL&&fs.existsSync(path.join(__dirname,"../.env.local")))process.loadEnvFile(path.join(__dirname,"../.env.local"));
const u=new URL(process.env.DATABASE_URL||"");
assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa","QA-only safety guard");
const db=new PrismaClient(),base="http://127.0.0.1:32979";
let owner,other,book,tokenHash,otherHash;
const token=()=>randomBytes(32).toString("hex");
const cookie=(t)=>"bcstudio_session="+t;
const sha=t=>createHash("sha256").update(t).digest("hex");
const request=async(path,cookieValue,method="GET",body)=>{
 const res=await fetch(base+path,{method,headers:{...(cookieValue?{cookie:cookieValue}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json()};
};
(async()=>{
 const t=token(),tOther=token();tokenHash=sha(t);otherHash=sha(tOther);
 owner=await db.studioUser.create({data:{name:"Pagination QA",email:"pagination-"+randomBytes(8).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 other=await db.studioUser.create({data:{name:"Pagination Other QA",email:"other-pagination-"+randomBytes(8).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 book=await db.book.create({data:{ownerId:owner.id,title:"Buku Pagination QA",grade:"7",subject:"Fisika"}});
 await db.studioSession.createMany({data:[{userId:owner.id,tokenHash,expiresAt:new Date(Date.now()+120000)},{userId:other.id,tokenHash:otherHash,expiresAt:new Date(Date.now()+120000)}]});
 const api="/api/books/"+book.id+"/pagination";
 assert.equal((await request(api,null)).status,401);
 assert.equal((await request(api,cookie(tOther))).status,404);
 const init=await request(api,cookie(t));
 assert.equal(init.status,200);assert.equal(init.data.version,0);assert.equal(init.data.settings.chapterStart,"recto");
 const changed={...init.data.settings,chapterStart:"nextPage",chapterOpeningFolio:"hidden",runningHeaders:false};
 const write=await request(api,cookie(t),"PATCH",{expectedVersion:0,settings:changed});
 assert.equal(write.status,200);assert.equal(write.data.version,1);
 const stored=await request(api,cookie(t));assert.equal(stored.data.settings.chapterOpeningFolio,"hidden");
 assert.equal((await request(api,cookie(t),"PATCH",{expectedVersion:0,settings:changed})).status,409);
 assert.equal((await request(api,cookie(tOther),"DELETE")).status,404);
 assert.equal((await request(api,cookie(t),"PATCH",{expectedVersion:1,settings:{...changed,unexpected:true}})).status,400);
 const reset=await request(api,cookie(t),"DELETE");assert.equal(reset.status,200);
 const after=await request(api,cookie(t));assert.equal(after.data.version,0);assert.equal(after.data.settings.chapterStart,"recto");
 console.log("PAGINATION_CRUD_E2E_PASS",JSON.stringify({bookId:book.id,assertions:11,status:200}));
})().catch(e=>{console.error("PAGINATION_CRUD_E2E_FAIL",e.stack);process.exitCode=1}).finally(async()=>{
 try{
 if(book)await db.book.delete({where:{id:book.id}});
 if(tokenHash||otherHash)await db.studioSession.deleteMany({where:{tokenHash:{in:[tokenHash,otherHash].filter(Boolean)}}});
 if(owner)await db.studioUser.delete({where:{id:owner.id}});
 if(other)await db.studioUser.delete({where:{id:other.id}});
 }finally{await db.$disconnect()}
});
