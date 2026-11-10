"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),base="http://127.0.0.1:32979";
const profiles=[["NOVEL","FICTION"],["SHORT_STORY","FICTION"],["ANTHOLOGY","FICTION"],["POETRY","FICTION"],["TEXTBOOK","NONFICTION"],["REFERENCE","NONFICTION"],["GUIDE","NONFICTION"],["WORKBOOK","NONFICTION"]];
let actor=null,ids=[];
async function main(){
 actor=await db.studioUser.create({data:{name:"Genre matrix QA",email:randomBytes(12).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:actor.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 for(const [genre,bookType] of [...profiles,["TEXTBOOK","FICTION"]]){
  const book=await db.book.create({data:{ownerId:actor.id,title:"QA Genre "+genre+" "+randomBytes(3).toString("hex"),subject:"Sastra dan Sains",grade:"7",author:"Penulis QA",genre,bookType,pageSize:"A4",description:"Buku uji untuk pemeriksaan genre dan profil penerbitan.",targetAudience:"Pembaca umum",writingGoal:"Memahami hubungan genre dan persyaratan penerbitan."}});
  ids.push(book.id);
  const res=await fetch(base+"/api/books/"+book.id+"/publishing-readiness",{headers:{cookie:"bcstudio_session="+token}});
  assert.equal(res.status,200);
  const {readiness}=await res.json();
  assert.equal(readiness.formats.length,5);
  assert.equal(readiness.decision,"NO_GO");
  assert.equal(readiness.genre.name.length>0,true);
  const mismatched=genre==="TEXTBOOK"&&bookType==="FICTION";
  assert.equal(readiness.problems.some(x=>x.includes("genre tidak sesuai")),mismatched);
  assert(readiness.suggestions.some(x=>x.includes("ISBN")));
  console.log("GENRE_PREFLIGHT_PASS",genre,bookType,mismatched?"EXPECTED_INCONSISTENCY_BLOCKED":"MATCH");
 }
 console.log("ALL_EIGHT_GENRES_AND_MISMATCH_PASS");
}
main().catch(e=>{console.error("GENRE_MATRIX_QA_FAIL",e);process.exitCode=1}).finally(async()=>{if(ids.length)await db.book.deleteMany({where:{id:{in:ids}}}).catch(()=>{});if(actor)await db.studioUser.deleteMany({where:{id:actor.id}}).catch(()=>{});await db.$disconnect()});
