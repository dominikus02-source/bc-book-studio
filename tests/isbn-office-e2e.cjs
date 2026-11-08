"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),JSZip=require("jszip"),{PDFDocument,StandardFonts}=require("pdf-lib"),{PrismaClient}=require("@prisma/client");
process.loadEnvFile(require("path").join(__dirname,"..",".env.local"));
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),base="http://127.0.0.1:32979";
async function api(path,cookie,method,body){
 const headers={Cookie:"bcstudio_session="+cookie};const opts={method:method||"GET",headers};
 if(body instanceof FormData)opts.body=body;
 else if(body){headers["Content-Type"]="application/json";opts.body=JSON.stringify(body)}
 const r=await fetch(base+path,opts),data=(r.headers.get("content-type")||"").includes("application/json")?await r.json():Buffer.from(await r.arrayBuffer());return {r,data}
}
async function session(user){const token=crypto.randomBytes(32).toString("hex");const record=await db.studioSession.create({data:{userId:user.id,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});return {token,id:record.id}}
(async()=>{
 let appId,adminSession,editorSession,temporaryAdmin,editor,profileCreated=false;
 try{
  let admin=await db.studioUser.findFirst({where:{active:true,role:"ADMIN"}});
  if(!admin){admin=await db.studioUser.create({data:{email:"qa-isbn-"+crypto.randomBytes(5).toString("hex")+"@example.invalid",name:"QA Publisher",role:"ADMIN",active:true}});temporaryAdmin=admin.id}
  editor=await db.studioUser.create({data:{email:"qa-isbn-editor-"+crypto.randomBytes(5).toString("hex")+"@example.invalid",name:"QA Reader",role:"EDITOR",active:true}});
  adminSession=await session(admin);editorSession=await session(editor);
  const initial=await api("/api/publisher",adminSession.token);assert.equal(initial.r.status,200);
  const unauthorized=await api("/api/publisher",editorSession.token);assert.equal(unauthorized.r.status,403);console.log("RBAC_ADMIN_ONLY_PASS");
  const books=initial.data.books;assert(books.length,"QA book unavailable");
  if(!initial.data.profile?.updatedAt){const fields={legalName:"PT Bahasa Cerdas Indonesia",imprintName:"Bahasa Cerdas Indonesia",directorName:"",legalAddress:"",correspondenceAddress:"",email:"",phone:"",officialWebsite:"",catalogWebsite:"",nib:"",kbli:"",decreeNumber:"",deedNumber:"",perpusnasAccountStatus:"NOT_REGISTERED",perpusnasReference:"",approvalNote:"QA draft"};const p=await api("/api/publisher",adminSession.token,"PUT",fields);assert.equal(p.r.status,200);profileCreated=true;console.log("PROFILE_CREATE_PASS")}
  const book=books[0],payload={bookId:book.id,title:book.title,subtitle:"",authorNames:book.author||"Penulis QA",language:"id",editionNumber:1,format:"PRINT",binding:"PAPERBACK",paperSize:"a5",imprint:"Bahasa Cerdas Indonesia",plannedPublicationYear:2027,catalogUrl:"",territory:"GLOBAL",rightsBasis:"ORIGINAL",originalWorkReference:"",note:"QA only - never submit"};
  const created=await api("/api/publisher/isbn",adminSession.token,"POST",payload);assert.equal(created.r.status,201,JSON.stringify(created.data));appId=created.data.application.id;console.log("APPLICATION_CREATE_PASS",appId);
  const listing=await api("/api/publisher/isbn",adminSession.token);assert.equal(listing.r.status,200);assert(listing.data.applications.some(x=>x.id===appId));console.log("DB_LIST_PASS");
  const altered=await api("/api/publisher/isbn/"+appId,adminSession.token,"PATCH",{fields:{subtitle:"Edisi Uji QA",language:"en",format:"EPUB"}});assert.equal(altered.r.status,200,JSON.stringify(altered.data));assert.equal(altered.data.application.subtitle,"Edisi Uji QA");console.log("EDITION_CRUD_PASS");
  const premature=await api("/api/publisher/isbn/"+appId,adminSession.token,"PATCH",{status:"ISSUED",isbn13:"9786231234567"});assert.equal(premature.r.status,409);console.log("FALSE_ISBN_PREVENTION_PASS");
  const notReady=await api("/api/publisher/isbn/"+appId,adminSession.token,"PATCH",{status:"DOCUMENTS_READY"});assert.equal(notReady.r.status,409);console.log("MISSING_DOCUMENT_GATE_PASS");
  for(const kind of ["application_letter","authenticity"]){
   for(const format of ["pdf","docx"]){
    const t=await api("/api/publisher/isbn/"+appId+"/letters/"+kind+"?format="+format,adminSession.token);assert.equal(t.r.status,200,JSON.stringify(t.data));
    if(format==="pdf")assert.equal(t.data.subarray(0,5).toString(),"%PDF-");
    else{const z=await JSZip.loadAsync(t.data);assert(z.file("word/document.xml"));const xml=await z.file("word/document.xml").async("string");assert(xml.includes("Edisi Uji QA")||xml.includes(book.title))}
    console.log("TEMPLATE_PASS",kind,format,t.data.length);
   }
  }
  const member=await api("/api/publisher/letters/membership_letter?format=docx",adminSession.token);assert.equal(member.r.status,200);
  const pdf=await PDFDocument.create();const page=pdf.addPage([595,842]);const font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText("QA INSTRUMENT ONLY",{x:70,y:700,font,size:20});const bytes=Buffer.from(await pdf.save());
  const form=new FormData();form.append("kind","application_letter");form.append("file",new Blob([bytes],{type:"application/pdf"}),"qa-document.pdf");
  const uploaded=await api("/api/publisher/isbn/"+appId+"/documents",adminSession.token,"POST",form);assert.equal(uploaded.r.status,201,JSON.stringify(uploaded.data));
  const docId=uploaded.data.document.id;
  const fetched=await api("/api/publisher/isbn/"+appId+"/documents/"+docId,adminSession.token);assert.equal(fetched.r.status,200);assert.equal(crypto.createHash("sha256").update(fetched.data).digest("hex"),uploaded.data.document.sha256);
  console.log("DOCUMENT_UPLOAD_DOWNLOAD_INTEGRITY_PASS");
  const erase=await api("/api/publisher/isbn/"+appId+"/documents/"+docId,adminSession.token,"DELETE");assert.equal(erase.r.status,200);
  const archive=await api("/api/publisher/isbn/"+appId,adminSession.token,"DELETE");assert.equal(archive.r.status,200);
  const events=await db.isbnEvent.findMany({where:{applicationId:appId}});assert(events.some(e=>e.action==="ARCHIVED"));console.log("SOFT_DELETE_AUDIT_PASS",events.length);
  console.log("ISBN_OFFICE_QA_ALL_PASS");
 }finally{
  if(appId)await db.isbnApplication.delete({where:{id:appId}}).catch(()=>{});
  if(adminSession)await db.studioSession.delete({where:{id:adminSession.id}}).catch(()=>{});
  if(editorSession)await db.studioSession.delete({where:{id:editorSession.id}}).catch(()=>{});
  if(editor)await db.studioUser.delete({where:{id:editor.id}}).catch(()=>{});
  if(temporaryAdmin)await db.studioUser.delete({where:{id:temporaryAdmin}}).catch(()=>{});
  if(profileCreated)await db.publisherProfile.delete({where:{id:"bci-publisher"}}).catch(()=>{});
 }
})().catch(e=>{console.error("ISBN_OFFICE_QA_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());

