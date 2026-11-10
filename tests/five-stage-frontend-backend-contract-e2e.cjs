"use strict";
const assert=require("node:assert/strict"),{randomBytes,createHash}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
const dbUrl=new URL(process.env.DATABASE_URL||"");assert.equal(dbUrl.host+dbUrl.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
(async()=>{
 user=await db.studioUser.create({data:{name:"Five Stage Contract QA",email:randomBytes(12).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"Kontrak lima tahap QA",subject:"IPA",grade:"7",author:"Penulis QA",description:"Naskah untuk menguji kejelasan alur front-end dan fungsi CRUD lima tahapan.",targetAudience:"Siswa SMP",writingGoal:"Memahami prinsip sains",bookType:"NONFICTION",genre:"TEXTBOOK",editorialStage:"BRIEF"}});
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/studio?module=Proyek+Buku&bookId="+book.id,{waitUntil:"domcontentloaded"});
 const panel=page.getByRole("region",{name:"Tahapan pembuatan buku"});await panel.waitFor({timeout:20000});
 const pageText=await page.locator("body").innerText();
 assert(!pageText.includes("11 peran inti siap dikonfigurasi"));
 assert(!pageText.includes("Coba editor blok dengan buku contoh"));
 assert.equal(await page.getByRole("button",{name:"Tinjauan Pedagogis",exact:true}).count(),0);
 assert.equal(await page.getByRole("button",{name:"Pusat Agen",exact:true}).count(),0);
 await page.getByRole("button",{name:"Buka menu"}).click();
 assert.equal(await page.getByRole("button",{name:"Lihat semua tahapan"}).count(),1);
 await page.getByRole("button",{name:"Tutup menu"}).first().click();
 const response=await context.request.get(origin+"/api/books/"+book.id+"/workflow");assert.equal(response.status(),200);
 const state=await response.json();assert.equal(state.stages.length,5);
 const sequence=[["Proyek Buku","label.studio-field:visible input"],["Rancang","[aria-label=\"Tahap Rancang\"]:visible"],["Studio Penulisan",".draft-editor-stage:visible"],["Penyuntingan",".workspace-stack:visible"],["Penerbitan",".publishing-panel:visible"]];
 for(const [module,text] of sequence){
  await page.goto(origin+"/studio?module="+encodeURIComponent(module)+"&bookId="+book.id,{waitUntil:"domcontentloaded"});
  await page.getByText("Kontrak lima tahap QA",{exact:true}).first().waitFor({timeout:20000});
  const selector=page.locator(text).first();
  await selector.waitFor({timeout:16000});
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,links:[...document.querySelectorAll("a[href]")].filter(a=>a.textContent?.includes("Pratinjau tautan baca publik")).length}));
  assert.equal(result.overflow,false,module+" overflow");
  if(module==="Penerbitan"){assert.equal(result.links,0,"No public read link before published");assert.equal(await page.getByRole("button",{name:"Tarik publikasi"}).isDisabled(),true)}
  console.log("FIVE_STAGE_UI_CONTRACT_PASS",module);
 }
 await page.goto(origin+"/studio?module=Tata+Letak&bookId="+book.id);
 assert.equal(await page.getByText("Coba editor blok dengan buku contoh").count(),0);
 assert.deepEqual(errors,[]);
 console.log("FIVE_STAGE_FRONTEND_BACKEND_CONTRACT_PASS");
})().catch(e=>{console.error("FIVE_STAGE_CONTRACT_FAIL",e.stack||e);process.exitCode=1}).finally(async()=>{
 await browser?.close();
 if(book){await db.book.deleteMany({where:{id:book.id}}).catch(()=>{})}
 if(user){await db.studioSession.deleteMany({where:{userId:user.id}}).catch(()=>{});await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{})}
 await db.$disconnect();
});
