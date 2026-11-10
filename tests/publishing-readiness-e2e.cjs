"use strict";
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client");
const {randomBytes,createHash}=require("node:crypto");
const base="http://127.0.0.1:32979";
const u=new URL(process.env.DATABASE_URL||"");
assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa","REFUSE NON-QA DATABASE");
const db=new PrismaClient();
let bookId;
const actors=[];
async function account(role){
 const u=await db.studioUser.create({data:{name:"Audit Role "+role,role,active:true,email:randomBytes(12).toString("hex")+"@example.invalid"}});
 actors.push(u.id);
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:u.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 return {id:u.id,role,cookie:"bcstudio_session="+token};
}
async function req(path,actor,method="GET",body,expected){
 const r=await fetch(base+path,{method,headers:{...(actor?{cookie:actor.cookie}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const value=await r.json().catch(()=>({}));
 if(expected!==undefined)assert.equal(r.status,expected,method+" "+path+" expected "+expected+" got "+r.status+" "+JSON.stringify(value).slice(0,550));
 return {status:r.status,body:value};
}
async function run(){
 const owner=await account("EDITOR"),reviewer=await account("REVIEWER"),admin=await account("ADMIN"),other=await account("EDITOR"),secondAdmin=await account("ADMIN");
 const at=new Date(),title="Publisher readiness QA "+randomBytes(4).toString("hex");
 const chapterText="Buku ini memaparkan ekologi dalam konteks pembelajaran. Contoh bersumber dari pengamatan sederhana.\n\n**Ekologi QA**\n\n![Diagram QA](asset:qaimag01)";
 const b=await db.book.create({data:{ownerId:owner.id,title,subject:"IPA",grade:"7",author:"Penulis Uji",bookType:"NONFICTION",genre:"TEXTBOOK",description:"Panduan ekologi praktis untuk pembaca tingkat SMP dan komunitas belajar.",targetAudience:"Siswa kelas tujuh",writingGoal:"Mengenal komponen lingkungan dan interaksinya.",status:"APPROVED",approvedAt:at,editorialStage:"LAYOUT",chapters:{create:{position:1,title:"Ekologi",content:chapterText,outlineObjective:"Membedakan komponen biotik dan abiotik."}}}});
 bookId=b.id;
 await db.bookApprovalSnapshot.create({data:{bookId,approvedAt:at,reviewerId:reviewer.id,manuscript:{title,subject:"IPA",grade:"7",author:"Penulis Uji",bookType:"NONFICTION",genre:"TEXTBOOK",pageSize:"A4",description:b.description,chapters:[{position:1,title:"Ekologi",content:chapterText}],assets:[{id:"qaimag01",mime:"image/png",data:"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XbVYAAAAASUVORK5CYII=",altText:"Diagram QA",license:"CC0-1.0",sourceUrl:null}]}}});
 await db.bookLayout.create({data:{bookId,approvedAt:at,version:1,settings:{pageSize:"A4",order:[1]}}});
 await db.bookReviewer.create({data:{bookId,reviewerId:reviewer.id,assignedById:owner.id}});
 await db.bookReviewer.create({data:{bookId,reviewerId:admin.id,assignedById:owner.id}});
 const path="/api/books/"+bookId+"/publishing-readiness";
 await req(path,undefined,"GET",undefined,401);
 await req(path,other,"GET",undefined,404);
 const ownerView=(await req(path,owner,"GET",undefined,200)).body;
 assert.equal(ownerView.readiness.decision,"NO_GO");
 assert.equal(ownerView.readiness.formats.length,5);
 assert.equal(ownerView.readiness.formats.find(f=>f.format==="FLIPBOOK").implemented,true); // Basic reader implemented; NO_GO still requires verified release evidence.
 assert.equal(ownerView.permissions.canSubmit,true);
 await req(path,reviewer,"GET",undefined,200);
 await req(path,admin,"GET",undefined,200);
 await req(path,secondAdmin,"GET",undefined,404);
 console.log("PUBLISHING_READINESS_ROLE_GET_MATRIX_PASS");
 const payload={kind:"RIGHTS",status:"SUBMITTED",snapshot:at.toISOString(),layoutVersion:1,note:"Izin penulis dan hak cipta sedang dikumpulkan dari dokumen sumber.",referenceUrl:"https://example.org/proof"};
 await req(path,other,"POST",payload,403);await req(path,reviewer,"POST",payload,403);await req(path,secondAdmin,"POST",{...payload,status:"VERIFIED",reviewedSubmissionId:"unknown"},403);await req(path,undefined,"POST",payload,401);
 const submitted=(await req(path,owner,"POST",payload,201)).body;
 assert(submitted.id);
 await req(path,owner,"POST",{...payload,status:"VERIFIED",reviewedSubmissionId:submitted.id},403);
 await req(path,admin,"POST",{...payload,status:"VERIFIED"},400);
 const verified=(await req(path,admin,"POST",{...payload,status:"VERIFIED",reviewedSubmissionId:submitted.id,note:"Saya sudah memeriksa dokumen bukti hak penggunaan dan identitas penerbit."},201)).body;
 assert(verified.id);
 console.log("PUBLISHING_EVIDENCE_OWNER_SUBMIT_ADMIN_VERIFY_AND_RBAC_PASS");
 const isbn="978-623-200-381-1";
 await req(path,owner,"POST",{...payload,kind:"ISBN",isbn:"978-623-200-381-2"},400);
 const isbnSubmit=(await req(path,owner,"POST",{...payload,kind:"ISBN",isbn,note:"Pengajuan cek ISBN dan bukti katalog penerbit dilampirkan."},201)).body;
 await req(path,admin,"POST",{...payload,kind:"ISBN",status:"VERIFIED",isbn,reviewedSubmissionId:isbnSubmit.id,note:"Periksa nomor dan dokumen katalog secara manual."},400);
 await req(path,admin,"POST",{...payload,kind:"ISBN",status:"VERIFIED",isbn,referenceUrl:"https://not-perpusnas.example/id",reviewedSubmissionId:isbnSubmit.id,note:"Periksa nomor dan dokumen katalog secara manual."},400);
 await req(path,admin,"POST",{...payload,kind:"ISBN",status:"VERIFIED",isbn,referenceUrl:"https://isbn.perpusnas.go.id/landing_page/home",reviewedSubmissionId:isbnSubmit.id,note:"Pemeriksaan manual atas bukti resmi, nomor dan edisi buku.",},201);
 const formatSubmission=(await req(path,owner,"POST",{...payload,kind:"FORMAT_FLIPBOOK",note:"Penulis mengusulkan laporan Flipbook yang belum tersedia."},201)).body;
 const missingFlipbookProof=await req(path,admin,"POST",{...payload,kind:"FORMAT_FLIPBOOK",status:"VERIFIED",reviewedSubmissionId:formatSubmission.id},400);
 assert.match(missingFlipbookProof.body.error,/SHA-256|validator|laporan/i); // Reject missing artifact proof before the release gate.
 console.log("ISBN_CHECKSUM_OFFICIAL_URL_HUMAN_PROOF_AND_FLIPBOOK_HOLD_PASS");
 await req("/api/books/"+bookId+"/publication",owner,"POST",{action:"publish",confirmed:true},409);
 const all=(await req(path,owner,"GET",undefined,200)).body;
 assert.equal(all.readiness.decision,"NO_GO");
 assert(all.readiness.checks.find(c=>c.kind==="RIGHTS").satisfied);
 assert(all.readiness.checks.find(c=>c.kind==="ISBN").satisfied);
 const layoutPatch=await req("/api/books/"+bookId+"/layout",owner,"PATCH",{snapshot:at.toISOString(),expectedVersion:1,settings:{pageSize:"A5",order:[1]}},200);
 assert.equal(layoutPatch.body.version,2);
 const after=(await req(path,owner,"GET",undefined,200)).body;
 assert.equal(after.readiness.historicalEvidenceCount>=3,true);
 assert.equal(after.readiness.checks.find(c=>c.kind==="RIGHTS").satisfied,false);
 assert.equal(after.readiness.checks.find(c=>c.kind==="ISBN").satisfied,false);
 await req(path,owner,"POST",{...payload,layoutVersion:1},409);
 await req(path,owner,"POST",{...payload,layoutVersion:2,note:"Hak dan lisensi perlu ditinjau ulang untuk layout baru."},201);
 console.log("LAYOUT_CHANGE_AUTOMATIC_EVIDENCE_INVALIDATION_PASS");

 const {chromium}=require("playwright");
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:860},acceptDownloads:true,hasTouch:true});
  await context.addCookies([{name:"bcstudio_session",value:owner.cookie.split("=")[1],url:base}]);
  const page=await context.newPage(),pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.goto(base+"/studio?module=Penerbitan&bookId="+bookId);
  const panel=page.getByRole("region",{name:"Pemeriksaan bukti penerbitan"});
  await panel.waitFor({timeout:25000});
  await panel.getByText("BELUM SIAP DITERBITKAN (NO-GO)").waitFor({timeout:25000});
  const publish=page.getByRole("button",{name:"Terbitkan buku"});
  assert.equal(await publish.isDisabled(),true);
  assert.equal(await panel.locator(".publisher-evidence-item").count(),17); // Updated publication evidence matrix; do not skip categories.
  await panel.getByText("Saran isian otomatis sesuai genre, standar, dan format").click();
  await panel.getByText(/Tautkan tujuan belajar/).waitFor();
  await panel.getByText("Persyaratan validator untuk DOCX, PDF, EPUB, HTML, dan Flipbook").click();
  await panel.getByText(/Lampirkan SHA-256, hasil E2E/).waitFor(); // Current Flipbook validator evidence description.
  const advanced=panel.getByText("Ajukan bukti penerbitan untuk ditinjau");
  await advanced.click();
  await panel.getByLabel("Jenis bukti").selectOption("CATALOG");
  await panel.getByLabel("Uraian bukti dan pemeriksaan manusia").fill("Katalog judul buku akan diperiksa oleh penerbit berwenang sebelum publikasi.");
  await panel.getByRole("button",{name:"Ajukan bukti",exact:true}).click();
  await panel.getByText(/Menunggu pemeriksaan ADMIN independen/).waitFor();
  for(const mode of ["light","dark"]){
   await page.evaluate(theme=>{localStorage.setItem("bcstudio-theme",theme);document.documentElement.dataset.theme=theme},mode);
   for(const width of [320,375,390,768,1024,1440]){
    await page.setViewportSize({width,height:860});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,"Overflow in "+mode+" "+width);
   }
  }
  assert.deepEqual(pageErrors,[]);
  console.log("PUBLISHING_PANEL_NO_GO_OWNER_SUBMIT_AND_12_RESPONSIVE_QA_PASS");
 }finally{await browser.close()}

 // Synthetic evidence exercises release transitions in the guarded QA database.
 const artifact=Buffer.from("QA fixture, not a release artifact");
 const evidence={snapshot:at.toISOString(),layoutVersion:2,note:"QA fixture only. No actual release evidence.",referenceUrl:"https://example.invalid/qa",checksum:createHash("sha256").update(artifact).digest("hex"),artifactBytes:artifact.length,validator:"QA fixture",validatorVersion:"1"};
 const checks=(await req(path,owner,"GET",undefined,200)).body.readiness.checks;
 for(const check of checks.filter(c=>c.requiredBeforePublish&&c.kind!=="RELEASE_SIGNOFF")){
  const proof={...evidence,kind:check.kind};
  const submission=(await req(path,owner,"POST",{...proof,status:"SUBMITTED"},201)).body;
  await req(path,admin,"POST",{...proof,status:check.kind==="ISBN"?"NOT_APPLICABLE":"VERIFIED",...(check.kind==="ISBN"?{referenceUrl:"https://isbn.perpusnas.go.id/landing_page/home",note:"QA only: simulate ISBN applicability without making any real determination."}:{}),reviewedSubmissionId:submission.id},201);
 }
 const signoff={...evidence,kind:"RELEASE_SIGNOFF"};
 const release=(await req(path,owner,"POST",{...signoff,status:"SUBMITTED"},201)).body;
 await req(path,admin,"POST",{...signoff,status:"VERIFIED",reviewedSubmissionId:release.id},201);
 const publication="/api/books/"+bookId+"/publication",read=base+"/read/"+bookId;
 assert.equal((await fetch(read)).status,404);
 await req(publication,other,"POST",{action:"publish",confirmed:true},404);
 await req(publication,owner,"POST",{action:"publish",confirmed:true},200);
 const row=await db.bookPublication.findUniqueOrThrow({where:{bookId}});
 assert.equal(row.snapshot.layoutVersion,2);
 assert.equal(row.snapshot.assets.length,1);
 const html=await fetch(read);
 assert.equal(html.status,200);
 const rendered=await html.text();
 assert.match(rendered,/<strong>Ekologi QA<\/strong>/);
 assert.match(rendered,/<img[^>]+src="data:image\/png;base64,[^"]+"[^>]+alt="Diagram QA/);
 await req(publication,owner,"POST",{action:"publish",confirmed:true},409);
 await req(publication,other,"POST",{action:"unpublish"},404);
 await req(publication,owner,"POST",{action:"unpublish"},200);
 assert.equal((await fetch(read)).status,404);
 assert.ok((await db.bookPublication.findUniqueOrThrow({where:{bookId}})).unpublishedAt);
 assert.equal(await db.review.count({where:{bookId,decision:{in:["publish","unpublish"]}}}),2);
 console.log("QA_PUBLISH_READ_REVOKE_PASS");
 console.log("PUBLISHING_READINESS_AUDIT_PASS");
}
run().catch(e=>{console.error("PUBLISHING_READINESS_QA_FAIL",e);process.exitCode=1}).finally(async()=>{
 if(bookId){
  await db.bookPublishingEvidence.deleteMany({where:{bookId}}).catch(()=>{});
  await db.review.deleteMany({where:{bookId}}).catch(()=>{});
  await db.bookLayout.deleteMany({where:{bookId}}).catch(()=>{});
  await db.bookApprovalSnapshot.deleteMany({where:{bookId}}).catch(()=>{});
  await db.bookReviewer.deleteMany({where:{bookId}}).catch(()=>{});
  await db.book.deleteMany({where:{id:bookId}}).catch(()=>{});
 }
 for(const id of actors)await db.studioUser.deleteMany({where:{id}}).catch(()=>{});
 await db.$disconnect();
});
