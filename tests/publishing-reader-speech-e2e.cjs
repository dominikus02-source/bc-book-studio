"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).host,"127.0.0.1:55999");
const db=new PrismaClient();
(async()=>{const book=await db.book.findUniqueOrThrow({where:{id:"cmw6gk5gu005wurcoe0dk02jr"}}),token=randomBytes(32).toString("hex");const session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});let browser;try{browser=await chromium.launch();const ctx=await browser.newContext();await ctx.addCookies([{name:"bcstudio_session",value:token,url:"http://127.0.0.1:32979"}]);const page=await ctx.newPage();
await page.addInitScript(()=>{window.__speechCalls=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{speak(utterance){window.__speechCalls.push({type:"speak",text:utterance.text,lang:utterance.lang})},cancel(){window.__speechCalls.push({type:"cancel"})}}})});
await page.goto("http://127.0.0.1:32979/api/books/"+book.id+"/export?format=flipbook&preview=1&view=1");
await page.getByRole("button",{name:"Bacakan"}).click();assert.equal(await page.getByRole("button",{name:"Hentikan suara"}).count(),1);
const calls=await page.evaluate(()=>window.__speechCalls);assert(calls.some(c=>c.type==="speak"&&c.text.includes("Sampul Depan")&&c.lang==="id-ID"));
await page.getByRole("button",{name:"Hentikan suara"}).click();assert.equal(await page.getByRole("button",{name:"Bacakan"}).count(),1);
console.log("SPEAKER_BROWSER_PASS: utterance id-ID current page, stop button");
}finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:session.id}})}})().catch(e=>{console.error("SPEAKER_BROWSER_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
