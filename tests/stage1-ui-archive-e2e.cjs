"use strict";
const assert=require("node:assert/strict");
const {createHash,randomBytes}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const {chromium}=require("playwright");
const uri=new URL(process.env.DATABASE_URL||"");
assert.equal(uri.host+uri.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),base="http://127.0.0.1:32979",books=[];
let user,browser;
async function request(path,method,token,body){
 const r=await fetch(base+path,{method,headers:{cookie:"bcstudio_session="+token,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const out=await r.json();assert(r.ok,method+" "+path+": "+JSON.stringify(out).slice(0,300));return out;
}
async function run(){
 user=await db.studioUser.create({data:{role:"EDITOR",name:"Stage1 UI QA",active:true,email:randomBytes(10).toString("hex")+"@example.invalid"}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 browser=await chromium.launch({headless:true});
 for(const theme of ["light","dark"])for(const width of [390,1440]){
  const {book}=await request("/api/books","POST",token,{title:"QA Arsip "+theme+" "+width,grade:"7",subject:"Bahasa",bookType:"NONFICTION",genre:"REFERENCE"});books.push(book.id);
  const ctx=await browser.newContext({viewport:{width,height:890}});
  await ctx.addCookies([{name:"bcstudio_session",value:token,url:base}]);
  const page=await ctx.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/studio?module=Proyek+Buku&bookId="+book.id);
  await page.evaluate(mode=>{localStorage.setItem("bcstudio-theme",mode);document.documentElement.dataset.theme=mode;},theme);
  await page.reload();
  await page.getByRole("button",{name:new RegExp(book.title)}).first().click();
  const archive=page.getByRole("button",{name:"Arsipkan draf"});
  await archive.waitFor({timeout:20000});
  page.once("dialog",dialog=>dialog.accept());
  await archive.click();
  await page.getByRole("status").getByText(/Tersimpan/).first().waitFor({timeout:15000}).catch(()=>{});
  const summary=page.getByText("Arsip buku dan pemulihan",{exact:true});
  await summary.click();
  await page.getByRole("button",{name:"Muat daftar arsip"}).click();
  const restore=page.getByRole("button",{name:"Pulihkan buku"}).last();
  await restore.waitFor({timeout:15000});
  page.once("dialog",dialog=>dialog.accept());await restore.click();
  await page.getByText(/Draf dipulihkan/).waitFor({timeout:15000});
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,theme:document.documentElement.dataset.theme}));
  assert.equal(result.overflow,false);assert.equal(result.theme,theme);assert.deepEqual(errors,[]);
  const active=await request("/api/books","GET",token);assert(active.books.some(x=>x.id===book.id));
  console.log("STAGE1_UI_PASS",theme,width);
  await ctx.close();
 }
}
run().catch(e=>{console.error("STAGE1_UI_FAIL",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();for(const id of books)await db.book.deleteMany({where:{id}}).catch(()=>{});if(user)await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{});await db.$disconnect()});
