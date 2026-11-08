"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),crypto=require("crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
const db=new PrismaClient(),id="cmw6gk5gu005wurcoe0dk02jr";
(async()=>{const book=await db.book.findUniqueOrThrow({where:{id},include:{chapters:true,assets:true}});const token=crypto.randomBytes(32).toString("hex");const session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});let browser;try{
 const expected=book.chapters.map(c=>[...c.content.matchAll(/!\[[^\]]+\]\(asset:([a-z0-9]{6,100})\)/g)].length).reduce((a,b)=>a+b,0);
 console.log("DB_IMAGE_REFS",expected,"ASSETS",book.assets.length);
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext();await ctx.addCookies([{name:"bcstudio_session",value:token,url:"http://127.0.0.1:32979"}]);const page=await ctx.newPage();
 for(const format of ["html","flipbook"]){const response=await page.goto("http://127.0.0.1:32979/api/books/"+id+"/export?format="+format+"&preview=1&view=1");assert.equal(response.status(),200);
  const images=await page.locator(".book-page img").count();assert.equal(images,expected,"image count "+format);
  if(images){const attrs=await page.locator(".book-page img").evaluateAll(nodes=>nodes.map(img=>({src:img.getAttribute("src")?.slice(0,22),alt:img.getAttribute("alt"),complete:img.complete,width:img.naturalWidth})));console.log("HTML_IMAGES",format,attrs);assert(attrs.every(x=>x.src?.startsWith("data:image/")&&x.alt&&x.width>0),"embedded images render");}
 }
 console.log("HTML_FLIPBOOK_IMAGE_E2E_PASS");
}finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:session.id}})}})().catch(e=>{console.error("IMAGE_E2E_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());