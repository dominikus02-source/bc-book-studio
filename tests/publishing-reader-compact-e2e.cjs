"use strict";
const assert=require("node:assert/strict");
const fs=require("fs"),crypto=require("node:crypto");
const {PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"")}
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
(async()=>{
 const book=await db.book.findUniqueOrThrow({where:{id:"cmw6gk5gu005wurcoe0dk02jr"}});
 const token=crypto.randomBytes(32).toString("hex");
 const session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
   const page=await context.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   for(const format of ["html","flipbook"]){
    await page.goto(origin+"/api/books/"+book.id+"/export?format="+format+"&preview=1&view=1",{waitUntil:"load"});
    await page.locator(".book-page").first().waitFor();
    const toolbar=page.locator(".reader-toolbar"),settings=page.locator("#reader-settings");
    assert.equal(await toolbar.count(),1);
    assert.equal(await settings.isHidden(),true,"options default closed");
    const metrics=await toolbar.evaluate(el=>({height:el.getBoundingClientRect().height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,viewport:innerWidth}));
    assert(metrics.height<=58,"toolbar too tall "+JSON.stringify({width,format,metrics}));
    assert(metrics.scrollWidth<=metrics.clientWidth+2,"toolbar overflows "+JSON.stringify({width,format,metrics}));
    await page.locator("#reader-settings-toggle").click();
    assert.equal(await settings.isVisible(),true);
    assert.equal(await page.locator("#reader-settings-toggle").getAttribute("aria-expanded"),"true");
    await page.locator("#theme-toggle").click();
    const actualTheme=await page.locator("html").getAttribute("data-theme");assert(["dark","light"].includes(actualTheme));
    await page.getByRole("combobox",{name:"Ukuran kertas buku"}).selectOption("a5");
    assert.equal(await page.locator("#paper-size").inputValue(),"a5");
    if(format==="flipbook"){
     await page.getByRole("combobox",{name:"Jumlah halaman per tampilan"}).selectOption("2");
     await page.getByRole("combobox",{name:"Orientasi halaman"}).selectOption("landscape");
     assert.equal(await page.locator("#book-view").getAttribute("data-orientation"),"landscape");
     await page.locator("#turn-sound").click();
     if(width<=500){await page.locator("#zoom-in-secondary").click();assert.equal(await page.locator("#zoom-value-secondary").textContent(),"110%");}
    }
    await page.keyboard.press("Escape");
    assert.equal(await settings.isHidden(),true);
    assert.equal(await page.locator("#reader-settings-toggle").getAttribute("aria-expanded"),"false");
    if(format==="flipbook"){
     await page.getByRole("button",{name:"Halaman berikutnya"}).click();
     assert.match(await page.locator("#page-counter").textContent(),/3.*4/);
     if(width>500){await page.locator("#zoom-in").click();assert.equal(await page.locator("#zoom-value").textContent(),"110%");}else{assert.equal(await page.locator("#zoom-value").textContent(),"110%");}
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=2,"horizontal viewport overflow: "+overflow);
    console.log("COMPACT_READER_PASS",format,width,metrics);
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
 }finally{await browser?.close();await db.studioSession.delete({where:{id:session.id}})}
})().catch(e=>{console.error("COMPACT_READER_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
