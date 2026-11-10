"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),crypto=require("crypto"),{PrismaClient}=require("@prisma/client"),{PDFDocument}=require("pdf-lib"),JSZip=require("jszip");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),id="cmw6gk5gu005wurcoe0dk02jr",base="http://127.0.0.1:32979/api/books/"+id+"/export-jobs";
(async()=>{const b=await db.book.findUniqueOrThrow({where:{id}}),token=crypto.randomBytes(32).toString("hex"),sess=await db.studioSession.create({data:{userId:b.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+900000)}});const headers={cookie:"bcstudio_session="+token};try{
 const r=await fetch(base,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({scope:"all",preview:true})});const response=await r.json();assert.equal(r.status,202,response.error);const jid=response.job.id;console.log("ALL_SIZES_JOB",jid);
 let job;for(let k=0;k<300;k++){await new Promise(resolve=>setTimeout(resolve,1400));const p=await fetch(base+"/"+jid,{headers});job=(await p.json()).job;if(k%12===0)console.log("PROGRESS",job.status,job.progress,job.currentStep);if(["COMPLETE","FAILED","CANCELLED"].includes(job.status))break;}
 assert.equal(job.status,"COMPLETE",job.error||"Job incomplete");const dl=await fetch(base+"/"+jid+"/download",{headers});assert.equal(dl.status,200);const data=Buffer.from(await dl.arrayBuffer());assert.equal(crypto.createHash("sha256").update(data).digest("hex"),job.resultSha256);console.log("ZIP_RECEIVED",data.length);
 const archive=await JSZip.loadAsync(data,{checkCRC32:true}),manifest=JSON.parse(await archive.file("MANIFEST.json").async("string"));assert.equal(manifest.sizes.length,13);assert.equal(Object.keys(manifest.files).length,29);assert.equal(manifest.externalValidators.EPUBCheck.status,"PASS");
 const sizes={a3:[297,420],a4:[210,297],a5:[148,210],a6:[105,148],b4:[250,353],b5:[176,250],b6:[125,176],"jis-b5":[182,257],letter:[215.9,279.4],legal:[215.9,355.6],"trade-6x9":[152.4,228.6],"id-14x21":[140,210],"id-15x23":[150,230]};
 for(const [name,dimensions] of Object.entries(sizes)){
  const pdf=Buffer.from(await archive.file("PDF/"+name+".pdf").async("nodebuffer")),doc=Buffer.from(await archive.file("DOCX/"+name+".docx").async("nodebuffer"));
  const p=await PDFDocument.load(pdf),page=p.getPage(0).getSize();assert(Math.abs(page.width-dimensions[0]*72/25.4)<1);assert(Math.abs(page.height-dimensions[1]*72/25.4)<1);
  const z=await JSZip.loadAsync(doc),xml=await z.file("word/document.xml").async("string");
  assert(xml.includes('w:w="'+Math.round(dimensions[0]*1440/25.4)+'"'));
  assert(xml.includes('w:h="'+Math.round(dimensions[1]*1440/25.4)+'"'));
  assert(xml.includes("<w:pgMar"));
  console.log("PAPER_FULL_PASS",name,"pages",p.getPageCount());
 }
 console.log("ALL_SIZES_QUEUE_E2E_PASS",manifest.externalValidators.EPUBCheck.status,Object.keys(manifest.files).length,"file hashes");
}finally{await db.studioSession.delete({where:{id:sess.id}})}})().catch(e=>{console.error("ALL_SIZES_E2E_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());