"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),crypto=require("crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
for(const line of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=line.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
const db=new PrismaClient(),id="cmw6gk5gu005wurcoe0dk02jr";
const luminance=(rgb)=>{const values=rgb.match(/\d+/g).slice(0,3).map(x=>{const n=Number(x)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return values[0]*.2126+values[1]*.7152+values[2]*.0722};
(async()=>{const b=await db.book.findUniqueOrThrow({where:{id}}),token=crypto.randomBytes(32).toString("hex"),session=await db.studioSession.create({data:{userId:b.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});let browser;try{
browser=await chromium.launch();for(const width of [320,390,768,1440]){const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});await ctx.addCookies([{name:"bcstudio_session",value:token,url:"http://127.0.0.1:32979"}]);const page=await ctx.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
for(const kind of ["html","flipbook"]){await page.goto("http://127.0.0.1:32979/api/books/"+id+"/export?format="+kind+"&preview=1&view=1");assert.equal(await page.locator("html").getAttribute("lang"),"id");
 const imageInfo=await page.locator(".book-page img").evaluateAll(els=>els.map(x=>({alt:x.getAttribute("alt"),width:x.naturalWidth})));assert(imageInfo.every(x=>x.alt?.trim()&&x.width>0));
 const ax=await ctx.newCDPSession(page);const tree=await ax.send("Accessibility.getFullAXTree");assert(tree.nodes.some(x=>x.role?.value==="main"),"main landmark exists");
 await page.locator("#sidebar-toggle").click();assert.equal(await page.locator("#reader-sidebar").getAttribute("aria-hidden"),"false");
 await page.keyboard.press("Escape");assert.equal(await page.locator("#reader-sidebar").getAttribute("aria-hidden"),"true");
 await page.locator("#reader-settings-toggle").click();
 for(const mode of ["light","dark"]){const current=await page.locator("html").getAttribute("data-theme");if(current!==mode)await page.locator("#theme-toggle").click();
  const color=await page.locator(".book-page").first().evaluate(el=>({text:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));const l1=luminance(color.text),l2=luminance(color.bg),contrast=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);assert(contrast>=4.5,"WCAG contrast "+contrast);console.log("CONTRAST_PASS",width,kind,mode,contrast.toFixed(2));}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}
assert.deepEqual(errors,[]);await ctx.close();}
console.log("AUTOMATED_ACCESSIBILITY_SMOKE_PASS (not full screen reader certification)");
}finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:session.id}})}})().catch(e=>{console.error("ACCESSIBILITY_SMOKE_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());