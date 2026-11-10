const fs=require("fs"),assert=require("assert/strict"),{randomBytes,createHash}=require("crypto"),{PrismaClient}=require("@prisma/client"),JSZip=require("jszip");
process.loadEnvFile(".env.local");const db=new PrismaClient(),base=process.env.QA_ORIGIN||"http://127.0.0.1:3301",id="cmw9sb9mm000qulx8fzvieiwp",out="artifacts/20261110-snapshot";
const hash=x=>createHash("sha256").update(x).digest("hex");let th;
(async()=>{const b=await db.book.findUniqueOrThrow({where:{id}});const token=randomBytes(32).toString("hex");th=hash(token);await db.studioSession.create({data:{userId:b.ownerId,tokenHash:th,expiresAt:new Date(Date.now()+600000)}});const headers={cookie:"bcstudio_session="+token,"content-type":"application/json"},path="/api/books/"+id+"/export-jobs";
 const r=await fetch(base+path,{method:"POST",headers,body:JSON.stringify({scope:"single",size:"a4",preview:false})}),created=await r.json();assert.equal(r.status,202,JSON.stringify(created));
 let job;for(let i=0;i<240;i++){job=(await (await fetch(base+path+"/"+created.job.id,{headers})).json()).job;if(["COMPLETE","FAILED","CANCELLED"].includes(job.status))break;await new Promise(r=>setTimeout(r,1000));}
 assert.equal(job.status,"COMPLETE",job.error||job.status);
 const noAuth=await fetch(base+path+"/"+job.id+"/download");assert.equal(noAuth.status,401);
 const response=await fetch(base+path+"/"+job.id+"/download",{headers});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),job.resultSha256);
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true}),manifest=JSON.parse(await zip.file("MANIFEST.json").async("string"));assert.equal(manifest.source.approvedAt,new Date(b.approvedAt).toISOString());assert.equal(manifest.source.schemaVersion,2);
 assert.equal(Object.keys(manifest.files).length,5);for(const [file,info]of Object.entries(manifest.files))assert.equal(hash(await zip.file(file).async("nodebuffer")),info.sha256);
 assert.equal(manifest.externalValidators.EPUBCheck.status,"PASS");fs.writeFileSync(out+"/main-book/all-five-formats.zip",bytes);fs.writeFileSync(out+"/queued-export.json",JSON.stringify({status:"PASS",jobId:job.id,zipBytes:bytes.length,sha256:hash(bytes),manifest},null,2));console.log("QUEUED_EXPORT_PASS",job.id,bytes.length);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(th)await db.studioSession.deleteMany({where:{tokenHash:th}});await db.$disconnect()});
