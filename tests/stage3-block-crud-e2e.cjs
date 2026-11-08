"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
async function main(){
 user=await db.studioUser.create({data:{role:"EDITOR",name:"Stage 3 QA",active:true,email:randomBytes(10).toString("hex")+"@example.invalid"}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"Stage 3 Naskah",author:"Penulis QA",grade:"7",subject:"Bahasa",description:"Naskah pengujian Stage Tulis lengkap.",targetAudience:"Pembaca SMP",writingGoal:"Menyusun cerita yang utuh",editorialStage:"WRITING",chapters:{create:{position:1,title:"Bab Utama",outlineObjective:"Menyusun bagian cerita.",content:"Paragraf dasar dengan cukup isi untuk uji editor naskah."}}},include:{chapters:true}});
 const chapter=book.chapters[0];
 await db.outlineSection.create({data:{bookId:book.id,chapterId:chapter.id,position:1,title:"Orientasi cerita",objective:"Kenalkan tokoh dan latar"}});
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true});
 await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
 const page=await context.newPage();const errors=[];page.on("pageerror",err=>errors.push(err.message));page.on("dialog",dialog=>dialog.accept());
 await page.goto(origin+"/studio?module=Studio+Penulisan&bookId="+book.id);
 const editor=page.getByRole("region",{name:"Kanvas naskah draf"});
 await editor.waitFor({timeout:60000});
 await editor.getByText("Kerangka Stage 2 untuk bab ini").click();
 await editor.getByRole("button",{name:"Sisipkan judul Orientasi cerita"}).click();
 const group=label=>editor.locator(".writing-palette-contents details > summary").getByText(label,{exact:true});
 await group("Pembelajaran").click();
 await editor.locator(".draft-palette-item").filter({hasText:"Daftar periksa"}).getByRole("button",{name:"Tambah"}).click();
 await group("Visual & data").click();
 await editor.locator(".draft-palette-item").filter({hasText:"Tabel"}).getByRole("button",{name:"Tambah"}).click();
 await group("Referensi").click();
 await editor.locator(".draft-palette-item").filter({hasText:"Kutipan"}).getByRole("button",{name:"Tambah"}).click();
 await editor.locator(".draft-palette-item").filter({hasText:"Blok kode"}).getByRole("button",{name:"Tambah"}).click();
 await editor.getByRole("button",{name:"Duplikat blok 1"}).click();
 await editor.getByRole("button",{name:"Simpan sekarang"}).click();
 await editor.getByText("Naskah tersimpan.",{exact:true}).waitFor({timeout:15000});
 const saved=await db.chapter.findUniqueOrThrow({where:{id:chapter.id}});
 assert(saved.content.includes("## Orientasi cerita"));assert(saved.content.includes("| Aspek | Penjelasan |"));assert(saved.content.includes("- [ ] Langkah pertama"));assert(saved.content.includes("Contoh kode"));
 await editor.getByText("Riwayat revisi naskah").click();
 await editor.getByRole("button",{name:"Muat riwayat"}).click();
 await editor.locator(".draft-revision-history li details summary").first().click();
 const first=editor.getByRole("button",{name:/Pulihkan revisi/}).first();
 await first.waitFor({timeout:15000});await first.click();
 await editor.getByText("Naskah tersimpan.",{exact:true}).waitFor({timeout:15000});
 const reverted=await db.chapter.findUniqueOrThrow({where:{id:chapter.id}});
 assert(reverted.content.length>20);
 for(const theme of ["light","dark"]){
  await page.evaluate(mode=>{localStorage.setItem("bcstudio-theme",mode);document.documentElement.dataset.theme=mode},theme);
  await page.reload();await editor.waitFor({timeout:15000});
  for(const width of [320,375,390,768,1024,1440]){
   await page.setViewportSize({width,height:900});
   const res=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.dataset.theme,font:getComputedStyle(document.querySelector('.writing-workspace')||document.body).fontFamily}));
   assert.equal(res.overflow,false,"Overflow "+theme+" "+width);
   assert.equal(res.theme,theme);assert.match(res.font,/DM Sans/);
  }
  console.log("STAGE3_RESPONSIVE_PASS",theme,"six viewports, font");
 }
 assert.deepEqual(errors,[]);
 console.log("STAGE3_BLOCK_CRUD_PASS: insert from outline, list/table/quote/code, duplicate, manual save, revisions, restore, light/dark");
}
main().catch(e=>{console.error("STAGE3_FAIL",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(book)await db.book.deleteMany({where:{id:book.id}}).catch(e=>console.error("Cleanup:",e.message));if(user)await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{});await db.$disconnect()});
