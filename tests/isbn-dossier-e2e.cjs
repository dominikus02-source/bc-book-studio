const assert=require("node:assert/strict"),crypto=require("node:crypto"),{PrismaClient}=require("@prisma/client"),JSZip=require("jszip"),{PDFDocument}=require("pdf-lib"),{chromium}=require("playwright");
process.loadEnvFile(require("path").join(__dirname,"..",".env.local"));assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),base=process.env.ISBN_QA_ORIGIN||"http://127.0.0.1:3106",ids={},sessions=[];
async function session(user){const token=crypto.randomBytes(32).toString("hex");const s=await db.studioSession.create({data:{userId:user.id,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+900000)}});sessions.push(s.id);return token}
async function request(url,token,body){const r=await fetch(base+url,{method:body?"POST":"GET",headers:{...(token?{Cookie:"bcstudio_session="+token}:{}),...(body&&!(body instanceof FormData)?{"Content-Type":"application/json"}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.headers.get("content-type")?.includes("json")?await r.json():Buffer.from(await r.arrayBuffer())}}
(async()=>{let browser;try{
 const tag=crypto.randomBytes(6).toString("hex");
 const admin=await db.studioUser.create({data:{email:"isbn-admin-"+tag+"@example.invalid",name:"ISBN QA",role:"ADMIN",active:true}});ids.admin=admin.id;
 const editor=await db.studioUser.create({data:{email:"isbn-editor-"+tag+"@example.invalid",name:"ISBN QA",role:"EDITOR",active:true}});ids.editor=editor.id;
 const token=await session(admin),editorToken=await session(editor);
 const pub=await db.publisherProfile.create({data:{id:"qa-"+tag,legalName:"PENERBIT UJI BUKAN LEGALITAS NYATA",directorName:"QA",legalAddress:"Alamat QA",nib:"QA-NOT-REAL"}});ids.pub=pub.id;
 const book=await db.book.create({data:{ownerId:admin.id,title:"QA ISBN Dossier "+tag,grade:"7",subject:"Bahasa Indonesia",author:"QA",chapters:{create:{position:1,title:"Bab dari Stage 2",content:"Naskah uji"}}}});ids.book=book.id;
 const app=await db.isbnApplication.create({data:{publisherId:pub.id,bookId:book.id,createdById:admin.id,title:book.title,authorNames:"QA",catalogUrl:"https://example.invalid/catalog/qa"}});ids.app=app.id;
 const url="/api/publisher/isbn/"+app.id+"/dossier";
 assert.equal((await request(url+"?kind=application_letter")).status,401);
 assert.equal((await request(url+"?kind=application_letter",editorToken)).status,403);
 assert.equal((await request(url,editorToken,{action:"save",kind:"application_letter",text:"unauthorized"})).status,403);console.log("PASS RBAC 401/403");
 let r=await request(url+"?kind=title_pages",token);assert.equal(r.status,200,JSON.stringify(r.data));assert(r.data.text.includes("Bab dari Stage 2"));assert.equal(r.data.bookId,book.id);
 r=await request(url,token,{action:"save",kind:"application_letter",text:"DRAF QA tersimpan",version:null});assert.equal(r.status,200,JSON.stringify(r.data));let version=r.data.version;
 assert.equal((await request(url,token,{action:"save",kind:"application_letter",text:"lost update",version:null})).status,409);
 assert.equal((await request(url+"?kind=application_letter",token)).data.text,"DRAF QA tersimpan");
 r=await request(url,token,{action:"archive",kind:"application_letter",version});assert.equal(r.status,200);
 assert((await request(url+"?kind=application_letter",token)).data.text.includes(book.title));console.log("PASS draft CRUD + optimistic conflict + Stage 2");
 r=await request(url+"?mode=templates",token);assert.equal(r.status,200);const templates=await JSZip.loadAsync(r.data);
 assert(templates.file("DRAF-authenticity.pdf"));assert(templates.file("DRAF-title_pages.docx"));for(const f of Object.values(templates.files)){if(f.name.endsWith(".pdf"))assert((await PDFDocument.load(await f.async("uint8array"))).getPageCount()>0)}
 console.log("PASS ZIP templates PDF/DOCX");
 assert.equal((await request(url+"?mode=package",token)).status,409);
 const pdf=await PDFDocument.create();pdf.addPage().drawText("QA ONLY - NOT OFFICIAL EVIDENCE");const bytes=Buffer.from(await pdf.save()),hash=crypto.createHash("sha256").update(bytes).digest("hex");
 for(const kind of ["application_letter","authenticity","title_pages","watermarked_manuscript"]){
  const form=new FormData();form.set("kind",kind);form.set("file",new Blob([bytes],{type:"application/pdf"}),"qa.pdf");
  if(kind==="authenticity"){assert.equal((await request("/api/publisher/isbn/"+app.id+"/documents",token,form)).status,400);form.set("stampMode","ELECTRONIC")}
  form.set("attested","true");r=await request("/api/publisher/isbn/"+app.id+"/documents",token,form);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.document.sha256,hash);
 }
 for(const kind of ["LEGAL_CERTIFICATE","NIB_KBLI","ISBN_MEMBERSHIP_SIGNED"])await db.publisherDocument.create({data:{publisherId:pub.id,uploaderId:admin.id,kind,filename:"qa-only.pdf",mime:"application/pdf",bytes,size:bytes.length,sha256:hash}});
 assert.equal((await request(url+"?mode=package",token)).status,409);
 // Dedicated QA fixture only, never approves a user manuscript.
 await db.book.update({where:{id:book.id},data:{status:"APPROVED",approvedAt:new Date()}});
 r=await request(url+"?mode=package",token);assert.equal(r.status,200,JSON.stringify(r.data));const pack=await JSZip.loadAsync(r.data),manifest=JSON.parse(await pack.file("manifest.json").async("string"));assert.equal(manifest.bookId,book.id);assert.equal(manifest.files.length,7);
 for(const f of manifest.files)assert.equal(crypto.createHash("sha256").update(await pack.file(f.path).async("nodebuffer")).digest("hex"),f.sha256);
 assert(manifest.files.some(f=>f.declaration?.stampMode==="ELECTRONIC"));console.log("PASS complete ZIP, byte-preserved e-meterai declaration, approval gate");
 browser=await chromium.launch();const context=await browser.newContext();await context.addCookies([{name:"bcstudio_session",value:token,url:base}]);const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 for(const width of [320,375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+"/studio?bookId="+book.id+"&module=ISBN+%26+Legalitas",{waitUntil:"domcontentloaded"});await page.getByRole("heading",{name:"Siapkan dokumen pengajuan"}).waitFor({timeout:60000});
  assert.equal(await page.locator(".isbn-list .selected strong").innerText(),book.title);
  await page.getByLabel("Isi draf dokumen",{exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"overflow at "+width);
  console.log("PASS responsive book selection",width);
 }
 await page.getByLabel("Isi draf dokumen",{exact:true}).fill("DRAF browser QA");await page.getByText("Tersimpan otomatis di database.",{exact:false}).waitFor({timeout:10000});await page.reload();await page.getByLabel("Isi draf dokumen",{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('section[aria-label="Penyusun dokumen ISBN"] textarea')?.value==="DRAF browser QA");assert.deepEqual(errors,[]);console.log("PASS browser save/reload and no JS errors");
 console.log("AI live generation NOT RUN (no external charge in automated QA)");console.log("ISBN_DOSSIER_ALL_PASS");
 }finally{if(browser)await browser.close();if(ids.app)await db.isbnApplication.delete({where:{id:ids.app}});if(ids.pub){await db.publisherDocument.deleteMany({where:{publisherId:ids.pub}});await db.publisherProfile.delete({where:{id:ids.pub}})}if(ids.book)await db.book.delete({where:{id:ids.book}});await db.studioSession.deleteMany({where:{id:{in:sessions}}});for(const id of [ids.editor,ids.admin].filter(Boolean))await db.studioUser.delete({where:{id}})}
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
