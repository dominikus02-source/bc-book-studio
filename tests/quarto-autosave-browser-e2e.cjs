"use strict";
const assert=require("node:assert/strict"),{randomBytes,createHash}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
const u=new URL(process.env.DATABASE_URL);assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
async function main(){
user=await db.studioUser.create({data:{name:"Quarto Browser QA",role:"EDITOR",active:true,email:randomBytes(10).toString("hex")+"@example.invalid"}});
const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
book=await db.book.create({data:{ownerId:user.id,title:"Quarto AutoTOC Test",grade:"9",subject:"IPA",editorialStage:"WRITING",chapters:{create:{position:1,title:"Bab Manual",outlineObjective:"Evaluasi Markdown",content:"# Bab Quarto Otomatis\n\n## Awal Momentum\n\nParagraf panjang untuk pengujian autosave dan heading Quarto pada browser.\n\n### Perubahan Kecepatan\n\nKonsep impuls menghubungkan gaya dan waktu."}}},include:{chapters:true}});
browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await ctx.newPage();page.on("dialog",d=>d.accept());const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(origin+"/studio?module=Studio+Penulisan&bookId="+book.id);
const canvas=page.locator("section.writing-workspace");await canvas.getByRole("heading",{name:"Judul dan daftar isi otomatis (Quarto Markdown)"}).waitFor({timeout:25000});
const toc=canvas.getByRole("navigation",{name:"Daftar isi naskah saat ini"});
await toc.getByText("Awal Momentum",{exact:true}).waitFor();
await toc.getByText("Perubahan Kecepatan",{exact:true}).waitFor();
await canvas.getByRole("button",{name:/Gunakan judul dari Markdown/}).click();
await canvas.getByLabel("Judul bab (editor blok)").waitFor();assert.equal(await canvas.getByLabel("Judul bab (editor blok)").inputValue(),"Bab Quarto Otomatis");
await canvas.getByText("Naskah tersimpan.",{exact:true}).waitFor({timeout:15000});
assert.equal((await db.chapter.findUniqueOrThrow({where:{id:book.chapters[0].id}})).title,"Bab Quarto Otomatis");
console.log("PASS title generated from # and autosaved");
await canvas.locator("details.writing-block-item").last().locator("summary").first().click();await canvas.locator("textarea[data-draft-block]").last().fill("Konsep impuls menghubungkan gaya dan durasi kontak dalam peristiwa pada tumbuhan; isi QA berhasil diperbarui.");
await canvas.getByText("Naskah tersimpan.",{exact:true}).waitFor({timeout:15000});
await page.reload();await canvas.locator("details.writing-block-item").last().locator("summary").first().click();await canvas.locator("textarea[data-draft-block]").last().waitFor({timeout:15000});
assert.match(await canvas.locator("textarea[data-draft-block]").last().inputValue(),/isi QA berhasil diperbarui/);
await toc.getByText("Awal Momentum",{exact:true}).waitFor();await toc.getByText("Perubahan Kecepatan",{exact:true}).waitFor();
console.log("PASS autosave content -> refresh -> heading persisted");
for(const width of [320,375,390,768,1024,1440]){await page.setViewportSize({width,height:900});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,"page overflow "+width);}
console.log("PASS full page responsive 320/375/390/768/1024/1440");assert.deepEqual(errs,[]);
}
main().catch(e=>{console.error("QUARTO_BROWSER_QA_FAIL",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(book)await db.book.deleteMany({where:{id:book.id}});if(user)await db.studioUser.deleteMany({where:{id:user.id}});await db.$disconnect()});

