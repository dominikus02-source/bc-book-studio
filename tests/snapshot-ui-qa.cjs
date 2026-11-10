const fs=require("fs"),assert=require("assert/strict"),{randomBytes,createHash}=require("crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
process.loadEnvFile(".env.local");const db=new PrismaClient(),base=process.env.QA_ORIGIN||"http://127.0.0.1:3301",out="artifacts/20261110-snapshot",rows=[],sessions=[];
async function session(userId){const token=randomBytes(32).toString("hex"),tokenHash=createHash("sha256").update(token).digest("hex");await db.studioSession.create({data:{userId,tokenHash,expiresAt:new Date(Date.now()+3600000)}});sessions.push(tokenHash);return token;}
async function main(){
const f=JSON.parse(fs.readFileSync(out+"/fixture.json","utf8")),source=await db.book.findUniqueOrThrow({where:{id:f.sourceBookId}});
const token=await session(source.ownerId);const browser=await chromium.launch({channel:"msedge",headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addCookies([{name:"bcstudio_session",value:token,url:base}]);const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 const stages=[["Ide","Proyek Buku"],["Rancang","Rancang"],["Tulis","Studio Penulisan"],["Review","Penyuntingan"],["Terbit","Penerbitan"]];
 for(const [stage,module]of stages){
 await page.goto(base+"/studio?module="+encodeURIComponent(module)+"&bookId="+source.id,{waitUntil:"domcontentloaded"});await page.getByRole("button",{name:"Buat revisi baru",exact:true}).waitFor({timeout:60000});
 if(["Review","Terbit"].includes(stage))await page.getByRole("status").filter({hasText:"Paket penerbitan dimuat dari database."}).waitFor({timeout:30000});
 for(const theme of ["light","dark"]){const toggle=page.getByRole("button",{name:theme==="dark"?"Mode gelap":"Mode terang",exact:true});if(await toggle.isVisible())await toggle.click();await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
 for(const width of [320,375,390,768,1024,1440]){await page.setViewportSize({width,height:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);rows.push({stage,module,theme,width,overflow,status:overflow?"FAIL":"PASS"});if(width===375||width===1440)await page.screenshot({path:out+"/ui-"+stage+"-"+theme+"-"+width+".png",fullPage:true});}}
 }
 await page.goto(base+"/studio?module=Penyuntingan&bookId="+source.id,{waitUntil:"domcontentloaded"});await page.getByRole("button",{name:"Buat revisi baru",exact:true}).waitFor();await page.getByRole("button",{name:"Buat revisi baru",exact:true}).focus();assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"Buat revisi baru");
 const reviewerToken=await session(f.reviewerId),reviewCtx=await browser.newContext();await reviewCtx.addCookies([{name:"bcstudio_session",value:reviewerToken,url:base}]);const rp=await reviewCtx.newPage();await rp.goto(base+"/studio?module=Penyuntingan&bookId="+f.bookId,{waitUntil:"domcontentloaded"});await rp.getByText("Paket penerbitan dimuat dari database.",{exact:false}).waitFor({timeout:30000});assert.equal(await rp.getByRole("button",{name:"Buat revisi baru",exact:true}).count(),0);rows.push({test:"reviewer sees package, no owner revision action",status:"PASS"});
 const fixtureToken=await session(f.ownerId);await ctx.addCookies([{name:"bcstudio_session",value:fixtureToken,url:base}]);
 for(const format of ["html","flipbook"]){
 await page.goto(base+"/api/books/"+f.bookId+"/export?view=1&format="+format,{waitUntil:"load"});assert.equal(await page.locator(".book-page").count(),16);
 assert.equal(await page.locator(".book-page").first().getAttribute("data-kind"),"frontCover");assert.equal(await page.locator(".book-page").last().getAttribute("data-kind"),"backCover");
 for(const width of [320,375,390,768,1024,1440]){await page.setViewportSize({width,height:900});rows.push({test:format,width,status:(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))?"PASS":"FAIL"});}
 assert.equal(await page.locator("img:not([alt]),img[alt='']").count(),0);
 if(format==="flipbook"){const before=await page.locator(".book-page:visible").first().getAttribute("id");await page.locator("body").click({position:{x:10,y:10}});await page.keyboard.press("ArrowRight");await page.waitForTimeout(400);const after=await page.locator(".book-page:visible").first().getAttribute("id");assert.notEqual(before,after);rows.push({test:"flipbook keyboard changes visible page",status:"PASS"});}
 await page.screenshot({path:out+"/reader-"+format+".png",fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.ok(rows.every(r=>r.status==="PASS"),"UI overflow found");console.log("UI_PASS",rows.length,"checks; 60 stage viewport/theme checks plus reader and keyboard checks");
}finally{await browser.close();}}
main().catch(e=>{rows.push({status:"FAIL",error:e.message});console.error(e);process.exitCode=1}).finally(async()=>{fs.writeFileSync(out+"/ui-results.json",JSON.stringify(rows,null,2));await db.studioSession.deleteMany({where:{tokenHash:{in:sessions}}});await db.$disconnect()});
