"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright"),fs=require("node:fs"),path=require("node:path");
if(!process.env.DATABASE_URL)process.loadEnvFile(path.join(__dirname,"../.env.local"));
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient();let user,book,tokenHash;
(async()=>{
 const token=randomBytes(32).toString("hex");tokenHash=createHash("sha256").update(token).digest("hex");
 user=await db.studioUser.create({data:{name:"UI Pagination QA",email:"ui-pagination-"+randomBytes(6).toString("hex")+"@example.invalid",active:true,role:"EDITOR"}});
 book=await db.book.create({data:{ownerId:user.id,title:"Buku UI Pagination QA",grade:"7",subject:"Fisika"}});
 await db.studioSession.create({data:{userId:user.id,tokenHash,expiresAt:new Date(Date.now()+180000)}});
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.addCookies([{name:"bcstudio_session",value:token,url:"http://127.0.0.1:32979"}]);
  const page=await ctx.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:32979/studio/pagination?bookId="+book.id,{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"Penomoran Halaman Buku"}).waitFor({timeout:30000});
  const select=page.getByLabel("Mulai bab baru");
  await select.selectOption("nextPage");
  await page.getByLabel("Running header bergantian kiri/kanan").uncheck();
  await page.getByRole("button",{name:"Simpan perubahan"}).click();
  await page.waitForTimeout(2000);
  console.log("PAGINATION_SAVE_DIAGNOSTIC",JSON.stringify({alerts:await page.locator('[role="alert"]').allTextContents(),statuses:await page.locator('[role="status"]').allTextContents(),url:page.url(),saveDisabled:await page.getByRole("button",{name:"Simpan perubahan"}).isDisabled()}));
  await page.getByText("Pengaturan tersimpan.").waitFor({timeout:20000});
  await page.reload();
  await page.locator("fieldset:not([disabled])").waitFor({timeout:20000});
  assert.equal(await page.getByLabel("Mulai bab baru").inputValue(),"nextPage");
  assert.equal(await page.getByLabel("Running header bergantian kiri/kanan").isChecked(),false);
  page.once("dialog",dialog=>void dialog.accept());
  await page.getByRole("button",{name:"Reset ke default"}).click();
  await page.getByText("Preset default dipulihkan.").waitFor();
  assert.equal(await page.getByLabel("Mulai bab baru").inputValue(),"recto");
  assert.deepEqual(errors,[]);
  console.log("PAGINATION_UI_E2E_PASS",JSON.stringify({bookId:book.id,viewport:"390x844",errors}));
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error("PAGINATION_UI_E2E_FAIL",e.stack);process.exitCode=1}).finally(async()=>{
 try{if(book)await db.book.delete({where:{id:book.id}});if(tokenHash)await db.studioSession.deleteMany({where:{tokenHash}});if(user)await db.studioUser.delete({where:{id:user.id}})}finally{await db.$disconnect()}
});
