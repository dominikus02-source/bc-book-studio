"use strict";
const assert=require("node:assert/strict"),crypto=require("crypto"),path=require("path"),{PrismaClient}=require("@prisma/client"),{PDFDocument,StandardFonts}=require("pdf-lib");
process.loadEnvFile(path.join(__dirname,"..",".env.local"));assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
(async()=>{let admin,sess,userCreated,profileCreated=false,docId;try{
 admin=await db.studioUser.findFirst({where:{active:true,role:"ADMIN"}});if(!admin){admin=await db.studioUser.create({data:{email:"qa-publisher-"+crypto.randomBytes(4).toString("hex")+"@example.invalid",name:"QA",role:"ADMIN",active:true}});userCreated=admin.id}
 const token=crypto.randomBytes(32).toString("hex");sess=await db.studioSession.create({data:{userId:admin.id,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+360000)}});
 let profile=await db.publisherProfile.findUnique({where:{id:"bci-publisher"}});if(!profile){profile=await db.publisherProfile.create({data:{id:"bci-publisher",legalName:"PT Bahasa Cerdas Indonesia",updatedById:admin.id}});profileCreated=true}
 const headers={cookie:"bcstudio_session="+token};
 const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText("QA LEGAL EVIDENCE ONLY",{x:50,y:730,size:17,font});const bytes=Buffer.from(await pdf.save());
 const form=new FormData();form.set("kind","NIB_KBLI");form.set("file",new Blob([bytes],{type:"application/pdf"}),"qa-legal-nib.pdf");
 let r=await fetch(origin+"/api/publisher/documents",{method:"POST",headers,body:form});let data=await r.json();assert.equal(r.status,201,JSON.stringify(data));docId=data.document.id;console.log("VAULT_UPLOAD_PASS",docId);
 r=await fetch(origin+"/api/publisher/documents",{headers});data=await r.json();assert(data.documents.some(x=>x.id===docId));console.log("VAULT_LIST_PASS");
 r=await fetch(origin+"/api/publisher/documents/"+docId,{headers});assert.equal(r.status,200);assert.equal(crypto.createHash("sha256").update(Buffer.from(await r.arrayBuffer())).digest("hex"),data.documents.find(x=>x.id===docId).sha256);console.log("VAULT_SHA256_DOWNLOAD_PASS");
 r=await fetch(origin+"/api/publisher/documents/"+docId,{method:"DELETE",headers});assert.equal(r.status,200);assert((await db.publisherDocument.findUnique({where:{id:docId}})).archivedAt);console.log("VAULT_ARCHIVE_PASS");
 console.log("PUBLISHER_VAULT_E2E_PASS");
}finally{
 if(docId)await db.publisherDocument.delete({where:{id:docId}}).catch(()=>{});
 if(profileCreated)await db.publisherProfile.delete({where:{id:"bci-publisher"}}).catch(()=>{});
 if(sess)await db.studioSession.delete({where:{id:sess.id}}).catch(()=>{});
 if(userCreated)await db.studioUser.delete({where:{id:userCreated}}).catch(()=>{});
}})().catch(e=>{console.error("PUBLISHER_VAULT_E2E_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
