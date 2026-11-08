"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{createHash,randomBytes}=require("node:crypto"),{chromium}=require("playwright");
const uri=new URL(process.env.DATABASE_URL||"");assert.equal(uri.host+uri.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
async function main(){
 user=await db.studioUser.create({data:{role:"EDITOR",name:"Stage 2 UI QA",email:randomBytes(10).toString("hex")+"@example.invalid",active:true}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"Hierarchy UI QA",grade:"7",subject:"Bahasa",description:"Susunan buku lengkap yang memuat bab dan subbagian.",targetAudience:"Pembaca SMP",writingGoal:"Memahami struktur isi buku",editorialStage:"OUTLINE",chapters:{create:[{position:1,title:"Bab Pengantar",outlineObjective:"Memahami konsep pengantar",content:""},{position:2,title:"Bab Lanjutan",outlineObjective:"Menguasai bagian berikutnya",content:""}]}},include:{chapters:true}});
 browser=await chromium.launch();
 const context=await browser.newContext({viewport:{width:390,height:860}});
 await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
 const page=await context.newPage();page.on("dialog",dialog=>dialog.accept());
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/studio?module=Rancang&bookId="+book.id);
 const outline=page.getByRole("region",{name:"Tahap Rancang"});
 await outline.waitFor({timeout:45000});
 const details=outline.locator("details.outline-section-details").first();
 await details.locator("summary").first().click();
 const section=details.getByRole("region",{name:"Subbagian hierarkis"});
 await section.waitFor();
 await section.getByLabel("Nama subbagian").fill("Subbagian konsep");
 await section.getByLabel("Tujuan pembahasan").fill("Memahami ide pokok dalam bab.");
 await section.getByRole("button",{name:"Tambah subbagian"}).click();
 await section.getByText("Subbagian konsep",{exact:true}).first().waitFor();
 await section.getByLabel("Nama subbagian").fill("Subbagian contoh");
 await section.getByLabel("Tujuan pembahasan").fill("Mengerjakan contoh pendukung.");
 await section.getByLabel("Induk subbagian").selectOption({label:"Subbagian konsep"});
 await section.getByRole("button",{name:"Tambah subbagian"}).click();
 await section.getByText("Subbagian contoh",{exact:true}).first().waitFor();
 const sections=await db.outlineSection.findMany({where:{bookId:book.id}});
 assert.equal(sections.length,2);
 assert.equal(sections.find(x=>x.title==="Subbagian contoh").parentId,sections.find(x=>x.title==="Subbagian konsep").id);
 await page.reload();
 await outline.waitFor();await outline.locator("details.outline-section-details").first().locator("summary").first().click();
 await outline.getByText("Subbagian contoh",{exact:true}).first().waitFor();
 for(const theme of ["light","dark"]){
  await page.evaluate(mode=>{localStorage.setItem("bcstudio-theme",mode);document.documentElement.dataset.theme=mode},theme);
  await page.reload();await outline.waitFor();
  for(const width of [320,375,390,768,1024,1440]){
   await page.setViewportSize({width,height:900});
   const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.dataset.theme,font:getComputedStyle(document.body).fontFamily}));
   assert.equal(r.overflow,false,theme+" "+width);assert.equal(r.theme,theme);assert.match(r.font,/DM Sans/);
  }
  console.log("STAGE2_UI_RESPONSIVE_PASS",theme,6);
 }
 assert.deepEqual(errors,[]);
 console.log("STAGE2_UI_HIERARCHY_PASS: parent/child create, persistent reload, light/dark fonts and responsive");
}
main().catch(e=>{console.error("STAGE2_UI_FAIL",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(book)await db.book.deleteMany({where:{id:book.id}}).catch(e=>console.error("Cleanup",e.message));if(user)await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{});await db.$disconnect()});
