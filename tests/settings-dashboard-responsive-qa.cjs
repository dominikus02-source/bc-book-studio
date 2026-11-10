"use strict";
const {chromium}=require("@playwright/test"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),fs=require("node:fs/promises"),assert=require("node:assert/strict");
require("dotenv").config({path:".env.local"});
const u=new URL(process.env.DATABASE_URL);assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa","QA database required");
const db=new PrismaClient(),origin=process.env.BC_SETTINGS_TEST_ORIGIN||"http://127.0.0.1:32979";
(async()=>{let browser,user;const errors=[],results=[];try{
user=await db.studioUser.create({data:{role:"ADMIN",active:true,name:"Temporary UI QA",email:randomBytes(10).toString("hex")+"@example.invalid"}});
const token=randomBytes(32).toString("hex");
await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+20*60*1000)}});
browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await context.newPage();
page.on("pageerror",e=>errors.push(String(e)));
await fs.mkdir("F:/tmp/bc-settings-visual-qa",{recursive:true});
await page.goto(origin+"/studio?bookId=cmw6gk5gu005wurcoe0dk02jr&module=Pengaturan",{waitUntil:"domcontentloaded",timeout:90000});
await page.getByRole("region",{name:"Ringkasan Pengaturan dan Observabilitas"}).waitFor({timeout:30000});
for(const theme of ["light","dark"]){await page.evaluate(t=>{localStorage.setItem("bcstudio-theme",t);document.documentElement.dataset.theme=t},theme);
for(const width of [320,375,390,768,1024,1440]){
await page.setViewportSize({width,height:900});
const scan=await page.evaluate(()=>{const el=document.querySelector(".control-root"),services=document.querySelector(".control-aside"),gauge=document.querySelector(".control-gauge"); const root=document.documentElement;return {overflow:root.scrollWidth>innerWidth+1,bodyWidth:root.scrollWidth,viewport:innerWidth,panelWidth:Math.round(el.getBoundingClientRect().width),statusWidth:Math.round(services.getBoundingClientRect().width),gaugeWidth:Math.round(gauge.getBoundingClientRect().width),theme:document.documentElement.dataset.theme,layout:getComputedStyle(document.querySelector(".control-layout")).display,primaryBackground:getComputedStyle(document.querySelector(".control-primary")).backgroundImage,gaugeMaxWidth:getComputedStyle(gauge).maxWidth,heading:el.querySelector("h2")?.textContent||""}});
if(scan.layout!=="grid"||scan.primaryBackground==="none"||!scan.gaugeMaxWidth.endsWith("px"))throw Error("Dashboard stylesheet missing "+theme+" "+width+" "+JSON.stringify(scan));
if(scan.overflow)throw Error("Horizontal overflow "+theme+" "+width+" "+JSON.stringify(scan));
if(!scan.heading.includes("Semua yang penting"))throw Error("Dashboard not rendered "+theme+" "+width);
await page.screenshot({path:"F:/tmp/bc-settings-visual-qa/"+theme+"-"+width+".png",fullPage:true});
console.log("PASS",theme,width,JSON.stringify(scan));results.push({theme,width,...scan});
}}
if(errors.length)throw Error("JS errors "+errors.join(" | "));
await fs.writeFile("F:/tmp/bc-settings-visual-qa/results.json",JSON.stringify(results,null,2));
console.log("VISUAL_QA_PASS "+results.length+" viewport/theme combinations");
}finally{if(browser)await browser.close();if(user){await db.studioSession.deleteMany({where:{userId:user.id}});await db.studioUser.delete({where:{id:user.id}})}await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
