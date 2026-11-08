"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),JSZip=require("jszip"),{PrismaClient}=require("@prisma/client");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),origin="http://127.0.0.1:32979",bookId="cmw6gk5gu005wurcoe0dk02jr";
async function main(){
 const book=await db.book.findUniqueOrThrow({where:{id:bookId}});
 const token=crypto.randomBytes(32).toString("hex"),session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 const base=origin+"/api/books/"+bookId+"/export-jobs",headers={cookie:"bcstudio_session="+token};
 try{
  const create=await fetch(base,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({scope:"single",size:"id-14x21",preview:true})});
  const result=await create.json();console.log("JOB_ENQUEUE",create.status,result.job);
  assert.equal(create.status,202);const id=result.job.id;
  let job;
  for(let k=0;k<125;k++){
   await new Promise(r=>setTimeout(r,1100));
   const poll=await fetch(base+"/"+id,{headers});assert.equal(poll.status,200);
   job=(await poll.json()).job;
   if(k%8===0)console.log("PROGRESS",job.status,job.progress,job.currentStep);
   if(["COMPLETE","FAILED","CANCELLED"].includes(job.status))break;
  }
  assert.equal(job.status,"COMPLETE",job.error||"Job not completed");
  assert.equal(job.progress,100);
  const download=await fetch(base+"/"+id+"/download",{headers});
  const bytes=Buffer.from(await download.arrayBuffer());
  console.log("DOWNLOAD",download.status,bytes.length);
  assert.equal(download.status,200);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),job.resultSha256);
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  const manifest=JSON.parse(await zip.file("MANIFEST.json").async("string"));
  assert(manifest.files["PDF/id-14x21.pdf"]);
  assert(manifest.files["DOCX/id-14x21.docx"]);
  assert.equal(manifest.externalValidators.EPUBCheck.status,"PASS");
  for(const [name,record] of Object.entries(manifest.files)){const file=await zip.file(name).async("nodebuffer");assert.equal(crypto.createHash("sha256").update(file).digest("hex"),record.sha256);}
  console.log("JOB_DOWNLOAD_SHA256_PASS",Object.keys(manifest.files).length,"file checksums");
 }finally{await db.studioSession.delete({where:{id:session.id}});}
}
main().catch(e=>{console.error("JOB_E2E_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
