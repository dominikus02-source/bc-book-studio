"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),{randomBytes,createHash}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
for(const line of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=line.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
(async()=>{const b=await db.book.findUniqueOrThrow({where:{id:"cmw6gk5gu005wurcoe0dk02jr"}});const token=randomBytes(32).toString("hex");const sess=await db.studioSession.create({data:{userId:b.ownerId,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});let browser;
try{browser=await chromium.launch();for(const width of [320,390,768,1024,1440]){const ctx=await browser.newContext({viewport:{width,height:900}});await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await ctx.newPage(),errs=[];page.on("pageerror",e=>errs.push(e.message));
for(const format of ["html","flipbook"]){await page.goto(origin+"/api/books/"+b.id+"/export?preview=1&view=1&format="+format);await page.locator("#reader-sidebar").waitFor({state:"attached",timeout:20000});
const toggle=page.locator("#sidebar-toggle"),side=page.locator("#reader-sidebar"),nav=page.locator(".sidebar-toc");
assert.equal(await toggle.getAttribute("aria-expanded"),"false");assert.equal(await side.getAttribute("aria-hidden"),"true");assert.equal(await nav.locator("a").count(),12);
const hiddenBounds=await page.locator(".reader-stage").boundingBox();
await toggle.click();assert.equal(await toggle.getAttribute("aria-expanded"),"true");assert.equal(await side.getAttribute("aria-hidden"),"false");assert.equal(await side.evaluate(el=>el.inert),false);
await page.waitForTimeout(280);const openBounds=await page.locator(".reader-stage").boundingBox();
if(width>=1024)assert(openBounds.width < hiddenBounds.width-170,"desktop reader should shrink adjacent");else assert(Math.abs(openBounds.width-hiddenBounds.width)<2,"mobile overlay should not shrink reader");
await page.keyboard.press("Escape");assert.equal(await toggle.getAttribute("aria-expanded"),"false");assert.equal(await side.evaluate(el=>el.inert),true);
await toggle.click();if(format==="flipbook"){await nav.locator('a[data-page="5"]').click();assert.match(await page.locator("#page-counter").textContent(),/6.*6/);}else{await nav.locator('a[data-page="5"]').click();await page.waitForTimeout(600);const rect=await page.locator("#part-6").boundingBox();console.log("HTML_SCROLL_DEBUG",width,rect?.y,await page.evaluate(()=>({scrollY,stage:document.querySelector(".reader-stage").scrollTop})));assert(rect && rect.y<460,"HTML chapter should scroll into view");}
if(width<1024){assert.equal(await toggle.getAttribute("aria-expanded"),"false");assert.equal(await page.locator("#sidebar-backdrop").isHidden(),true);}else{assert.equal(await toggle.getAttribute("aria-expanded"),"true");await page.locator("#sidebar-close").click();}
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"overflow at "+width+" "+format);
console.log("SIDEBAR_PASS",width,format);}
assert.deepEqual(errs,[]);await ctx.close();}}finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:sess.id}})}})().catch(e=>{console.error("SIDEBAR_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
