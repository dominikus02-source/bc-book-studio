"use strict";
const assert=require("node:assert/strict");
const {randomBytes,createHash}=require("node:crypto");
const {PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
const uri=new URL(process.env.DATABASE_URL||"");
assert.equal(uri.host+uri.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
(async()=>{
 user=await db.studioUser.create({data:{name:"Legacy Editor QA",email:randomBytes(10).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"QA Editor Klasik",author:"Penulis QA",grade:"7",subject:"IPA",description:"Uji editor klasik dalam tahap penulisan dengan satu bab aktif.",targetAudience:"Siswa SMP",writingGoal:"Menyusun paragraf",editorialStage:"WRITING",bookType:"NONFICTION",genre:"TEXTBOOK",chapters:{create:{title:"Bab Konflik Revisi",position:1,outlineObjective:"Menguji revisi",content:"Bab pertama untuk memastikan form muncul serta versi aman."}}},include:{chapters:true}});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
 const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/studio?module=Studio+Penulisan&bookId="+book.id,{waitUntil:"domcontentloaded"});
 const tools=page.locator("details.legacy-editor-tools");
 await tools.locator("summary").first().click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector("details.legacy-editor-tools")?.open);
 const chapterCard=page.locator(".chapter-status-card").filter({hasText:"Bab Konflik Revisi"}).first();
 await chapterCard.waitFor({timeout:5000});
 assert.equal(await chapterCard.isVisible(),true,"Classic chapter cards must be visible once requested");
 await chapterCard.locator("summary").click();
 await chapterCard.getByRole("button",{name:"Ubah",exact:true}).click();
 const content=page.locator("details.legacy-editor-tools").locator("textarea").filter({visible:true}).last();
 assert.equal(await content.count()>0,true);
 assert.equal(await content.inputValue(),"Bab pertama untuk memastikan form muncul serta versi aman.");
 const edit=await db.chapter.findUniqueOrThrow({where:{id:book.chapters[0].id}});
 await db.chapter.update({where:{id:edit.id},data:{title:"Perubahan di tab lain"}});
 await content.fill("Draf lokal yang tidak boleh hilang ketika ada pembaruan versi dari tab lain.");
 await page.getByRole("button",{name:"Muat versi terbaru"}).waitFor({timeout:16000});
 assert.equal(await content.inputValue(),"Draf lokal yang tidak boleh hilang ketika ada pembaruan versi dari tab lain.");
 assert.deepEqual(errors,[]);
 console.log("LEGACY_EDITOR_VISIBLE_WHEN_OPEN_AND_409_DRAFT_PRESERVED_PASS");
})().catch(e=>{console.error("LEGACY_EDITOR_REGRESSION_FAIL",e.stack||e);process.exitCode=1}).finally(async()=>{
 await browser?.close();
 if(book){await db.chapter.deleteMany({where:{bookId:book.id}}).catch(()=>{});await db.book.deleteMany({where:{id:book.id}}).catch(()=>{})}
 if(user){await db.studioSession.deleteMany({where:{userId:user.id}}).catch(()=>{});await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{})}
 await db.$disconnect();
});
