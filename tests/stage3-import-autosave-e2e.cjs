"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
(async()=>{
 user=await db.studioUser.create({data:{name:"Stage 3 Upload QA",email:randomBytes(12).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"Buku Uji Autosave Bab",subject:"IPA",author:"Penulis QA",grade:"7",description:"Uji integrasi impor Markdown dan autosave naskah",targetAudience:"Siswa SMP",writingGoal:"Menjelaskan sains",editorialStage:"WRITING",bookType:"NONFICTION",genre:"TEXTBOOK",chapters:{create:{title:"Bab Awal",position:1,outlineObjective:"Membandingkan konsep IPA",content:"Paragraf awal yang telah disimpan sebelum proses impor bab baru."}}},include:{chapters:true}});const chapter=book.chapters[0];
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true});
 await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/studio?module=Studio+Penulisan&bookId="+book.id);
 const editor=page.locator(".draft-editor-stage");await editor.waitFor({timeout:20000});
 const group=editor.locator("details.stage-transfer-panel").filter({hasText:"Template Stage 3"}).first();
 await group.locator("summary").first().click();
 const form=editor.getByRole("region",{name:"Impor dan ekspor Stage 3 Naskah Bab"});
 await form.waitFor();const downloadPromise=page.waitForEvent("download");await form.getByRole("button",{name:"Unduh Markdown"}).click();
 const download=await downloadPromise;let text=fs.readFileSync(await download.path(),"utf8");
 for(const [key,value] of Object.entries({title:"Bab Ekosistem Hasil Impor",content:"## Komponen Ekosistem\n\nEkosistem terdiri atas komponen biotik dan abiotik yang saling berinteraksi.\n\n- Cahaya\n- Air\n\n### Latihan\nJelaskan dua interaksi antarorganisme."})){
  const start=text.indexOf("## "+key+" — ");assert(start>=0);
  const after=text.indexOf("\n",start),next=text.indexOf("\n## ",after+1);
  text=text.slice(0,after+1)+"\n"+value+"\n"+text.slice(next>=0?next+1:text.length);
 }
 await form.locator('input[type="file"]').setInputFiles({name:"bab-qa.md",mimeType:"text/markdown",buffer:Buffer.from(text)});
 await page.waitForFunction(async ids=>{const r=await fetch("/api/books/"+ids[0]+"/chapters/"+ids[1]);if(!r.ok)return false;const j=await r.json();return j.chapter.title==="Bab Ekosistem Hasil Impor"&&j.chapter.content.includes("Cahaya")},[book.id,chapter.id],{timeout:20000});
 let latest;for(let i=0;i<45;i++){latest=await db.chapter.findUniqueOrThrow({where:{id:chapter.id}});if(latest.content.includes("Komponen Ekosistem")&&latest.title==="Bab Ekosistem Hasil Impor")break;await new Promise(r=>setTimeout(r,250))}console.log("STAGE3_CONTENT_DEBUG",JSON.stringify({title:latest.title,text:latest.content.slice(0,300)}));assert(latest.content.includes("Komponen Ekosistem"));
 assert.deepEqual(errors,[]);console.log("STAGE3_MARKDOWN_IMPORT_BLOCK_EDITOR_AUTOSAVE_PASS");
})().catch(e=>{console.error("STAGE3_IMPORT_FAIL",e.stack);process.exitCode=1}).finally(async()=>{await browser?.close();if(book){if(db.chapterRevision)await db.chapterRevision.deleteMany({where:{chapterId:{in:book.chapters.map(c=>c.id)}}}).catch(()=>{});await db.chapter.deleteMany({where:{bookId:book.id}}).catch(()=>{});await db.book.deleteMany({where:{id:book.id}}).catch(()=>{})}if(user){await db.studioSession.deleteMany({where:{userId:user.id}});await db.studioUser.deleteMany({where:{id:user.id}})}await db.$disconnect()});
