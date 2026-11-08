"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),crypto=require("crypto"),{PrismaClient}=require("@prisma/client");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),id="cmw6gk5gu005wurcoe0dk02jr";
(async()=>{const b=await db.book.findUniqueOrThrow({where:{id}}),token=crypto.randomBytes(32).toString("hex"),session=await db.studioSession.create({data:{userId:b.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});const base="http://127.0.0.1:32979/api/books/"+id+"/export-jobs",headers={cookie:"bcstudio_session="+token};try{
 const unauthorized=await fetch(base);assert([401,403].includes(unauthorized.status));console.log("UNAUTHENTICATED_DENIED",unauthorized.status);
 const r=await fetch(base,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({scope:"all",preview:true})});const data=await r.json();assert.equal(r.status,202,data.error);const jid=data.job.id;console.log("ENQUEUED_CANCELLABLE_JOB",jid);
 const cancel=await fetch(base+"/"+jid,{method:"DELETE",headers});const response=await cancel.json();assert.equal(cancel.status,200);console.log("CANCEL_ACCEPTED",response);
 let job;for(let i=0;i<60;i++){await new Promise(resolve=>setTimeout(resolve,1200));const p=await fetch(base+"/"+jid,{headers});job=(await p.json()).job;if(["CANCELLED","FAILED","COMPLETE"].includes(job.status))break;}
 assert.equal(job.status,"CANCELLED",JSON.stringify(job));console.log("CANCEL_JOB_PASS",job.status,job.progress);
 const denied=await fetch(base+"/"+jid+"/download",{headers});assert.equal(denied.status,404);console.log("CANCELLED_DOWNLOAD_DENIED",denied.status);
 }finally{await db.studioSession.delete({where:{id:session.id}})}})().catch(e=>{console.error("CANCEL_E2E_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());