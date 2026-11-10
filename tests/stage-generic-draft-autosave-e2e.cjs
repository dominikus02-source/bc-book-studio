"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright");
const url=new URL(process.env.DATABASE_URL||"");assert.equal(url.host+url.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,browser;
(async()=>{
 user=await db.studioUser.create({data:{name:"Generic Draft QA",email:randomBytes(11).toString("hex")+"@example.invalid",role:"EDITOR",active:true}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 for(const [module,key,value] of [["Idea Lab","bookTitle","Buku QA Otomatis"],["Kurikulum","curriculumName","Kurikulum QA Lokal"],["Studio Visual","visualDescription","Diagram ekologis untuk siswa SMP"],["Studio Latihan","questionObjective","Membedakan ekosistem"],["Pusat Agen","agentQuery","Pemimpin Redaksi"]]){
  await page.goto(origin+"/studio?module="+encodeURIComponent(module),{waitUntil:"load"});
  const panel=page.getByRole("region",{name:"Impor dan ekspor "+module});await panel.waitFor();
  const downloadPromise=page.waitForEvent("download");await panel.getByRole("button",{name:"Unduh Markdown"}).click();
  const dl=await downloadPromise;let text=fs.readFileSync(await dl.path(),"utf8");
  const marker="## "+key+" — ";const start=text.indexOf(marker);assert(start>=0,marker);
  const header=text.indexOf("\n",start),next=text.indexOf("\n## ",header+1);
  text=text.slice(0,header+1)+"\n"+value+"\n"+text.slice(next>=0?next+1:text.length);
  await panel.locator('input[type="file"]').setInputFiles({name:"qa-"+module+".md",mimeType:"text/markdown",buffer:Buffer.from(text)});
  await page.getByText("File berhasil diimpor dan draf tersimpan otomatis di database.",{exact:false}).waitFor({timeout:15000});
  const drafts=await db.studioFormDraft.findMany({where:{ownerId:user.id,module}});
  assert.equal(drafts.length,1,module);
  assert.equal(drafts[0].payload[key],value,module);
  console.log("GENERIC_DRAFT_IMPORT_AUTOSAVE_PASS",module);
 }
 assert.deepEqual(errors,[]);console.log("GENERIC_DRAFT_FIVE_MODULES_PASS");
})().catch(e=>{console.error("GENERIC_DRAFT_FAIL",e.stack);process.exitCode=1}).finally(async()=>{await browser?.close();if(user){await db.studioFormDraft.deleteMany({where:{ownerId:user.id}});await db.studioSession.deleteMany({where:{userId:user.id}});await db.studioUser.deleteMany({where:{id:user.id}})}await db.$disconnect()});
