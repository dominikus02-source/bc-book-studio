"use strict";
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("crypto"),{chromium}=require("playwright");
process.loadEnvFile(path.join(__dirname,"..",".env.local"));
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
function luminance(rgb){const c=rgb.match(/\d+/g).slice(0,3).map(x=>Number(x)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
(async()=>{
 const id="cmw6gk5gu005wurcoe0dk02jr",book=await db.book.findUniqueOrThrow({where:{id}}),token=randomBytes(32).toString("hex");
 const session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});let browser;
 try{browser=await chromium.launch();
  for(const format of ["html","flipbook"]){for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:"reduce"});
   await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(origin+"/api/books/"+id+"/export?preview=1&view=1&format="+format);
   assert.equal(await page.locator("html").getAttribute("lang"),"id");
   assert.equal(await page.locator("main").count(),1);
   assert((await page.locator(".book-page").count())>=12,"Expected complete publishing sections");
   assert.equal(await page.locator(".book-page img:not([alt])").count(),0);
   const style=await page.locator(".book-page").first().evaluate(e=>({text:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
   assert(ratio(style.text,style.bg)>=4.5,"Contrast light below WCAG AA");
   await page.getByRole("button",{name:"Buka pengaturan pembaca"}).click();
   await page.getByRole("button",{name:"Mode gelap"}).click();
   const dark=await page.locator(".book-page").first().evaluate(e=>({text:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
   assert(ratio(dark.text,dark.bg)>=4.5,"Contrast dark below WCAG AA");
   await page.getByRole("button",{name:"Tutup pengaturan",exact:true}).click();
   await page.getByRole("button",{name:"Tampilkan daftar isi"}).click();
   assert.equal(await page.locator("#reader-sidebar").getAttribute("aria-hidden"),"false");
   await page.keyboard.press("Escape");
   assert.equal(await page.locator("#reader-sidebar").getAttribute("aria-hidden"),"true");
   assert.equal(await page.locator("#sidebar-toggle").getAttribute("aria-expanded"),"false");
   assert.deepEqual(errors,[]);
   console.log("ACCESSIBILITY_BROWSER_PASS",format,width,"contrast",ratio(style.text,style.bg).toFixed(1),ratio(dark.text,dark.bg).toFixed(1),"noJSerrors");
   await ctx.close();
  }}
 }finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:session.id}})}
})().catch(e=>{console.error("ACCESSIBILITY_BROWSER_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
