"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),{randomBytes,createHash}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
for(const line of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=line.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).host,"127.0.0.1:55999");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
async function main(){
 const book=await db.book.findUniqueOrThrow({where:{id:"cmw6gk5gu005wurcoe0dk02jr"}});
 const token=randomBytes(32).toString("hex");
 const session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
  const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",e=>{if(e.type()==="error")errors.push("console: "+e.text())});
  for(const format of ["html","flipbook"]){
   await page.goto(origin+"/api/books/"+book.id+"/export?preview=1&view=1&format="+format,{waitUntil:"load"});
   await page.locator(".book-page").first().waitFor({timeout:20000});
   assert((await page.locator(".book-page").count())>=12,"Reader must include complete front matter, contents, body and back matter");
   assert.equal(await page.locator(".book-page").first().getAttribute("data-kind"),"frontCover");
   assert.equal(await page.locator(".book-page").last().getAttribute("data-kind"),"backCover");
   const colorLight=await page.locator(".book-page").first().evaluate(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
   await page.locator("#reader-settings-toggle").click();
   await page.getByRole("button",{name:"Mode gelap"}).click();
   assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
   const colorDark=await page.locator(".book-page").first().evaluate(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
   assert.notDeepEqual(colorDark,colorLight);
   await page.getByRole("button",{name:"Mode terang"}).click();
   assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
   console.log("THEME_PASS",format,colorLight,colorDark);
   if(format==="flipbook"){
    for(const count of [1,2,4,6,8]){
     await page.getByRole("combobox",{name:"Jumlah halaman per tampilan"}).selectOption(String(count));
     assert.equal(await page.locator(".book-page:not([hidden])").count(),count);
     console.log("PAGE_MODE_PASS",count);
    }
    await page.getByRole("combobox",{name:"Orientasi halaman"}).selectOption("landscape");
    assert.equal(await page.locator("#book-view").getAttribute("data-orientation"),"landscape");
    await page.getByRole("combobox",{name:"Orientasi halaman"}).selectOption("portrait");
    await page.getByRole("button",{name:"Perbesar"}).click();
    assert.equal(await page.locator("#zoom-value").textContent(),"110%");
    await page.getByRole("button",{name:"Perkecil"}).click();
    assert.equal(await page.locator("#zoom-value").textContent(),"100%");
    if(await page.locator("#reader-settings").isHidden())await page.locator("#reader-settings-toggle").click();
    await page.locator("#turn-sound").click();
    assert.equal(await page.getByRole("button",{name:"Mute suara membalik halaman"}).getAttribute("aria-pressed"),"true");
    await page.getByRole("combobox",{name:"Jumlah halaman per tampilan"}).selectOption("2");
    await page.getByRole("button",{name:"Halaman berikutnya"}).click();
    assert.match(await page.locator("#page-counter").textContent(),/3.*4/);
    await page.keyboard.press("ArrowRight");
    assert.match(await page.locator("#page-counter").textContent(),/5.*6/);
    await page.getByRole("button",{name:"Halaman sebelumnya"}).click();
    assert.match(await page.locator("#page-counter").textContent(),/3.*4/);
    console.log("FLIP_CONTROL_PASS");
   }
   if(await page.locator("#reader-settings").isHidden())await page.locator("#reader-settings-toggle").click();
   const speak=page.getByRole("button",{name:"Bacakan"});assert.equal(await speak.count(),1);
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,"viewport overflow "+format+" "+width);
   }
   console.log("RESPONSIVE_PASS",format);
  }
  assert.deepEqual(errors,[]);
  console.log("READER_E2E_PASS",errors.length,"page errors");
 }finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:session.id}});}
}
main().catch(e=>{console.error("READER_E2E_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
