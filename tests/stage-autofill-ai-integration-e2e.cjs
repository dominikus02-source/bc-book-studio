"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright"),JSZip=require("jszip");
const origin="http://127.0.0.1:32979",database=new URL(process.env.DATABASE_URL||"");
assert.equal(database.host+database.pathname,"127.0.0.1:55999/bookstudio_import_qa","QA database required");
const db=new PrismaClient();let user,book,browser;
function changeMarkdown(content,values){let source=content;for(const [key,value] of Object.entries(values)){const start=source.indexOf("## "+key+" — ");assert(start>=0,"Missing key "+key);const headerEnd=source.indexOf("\n",start),next=source.indexOf("\n## ",headerEnd+1);source=source.slice(0,headerEnd+1)+"\n"+value+"\n"+source.slice(next>=0?next+1:source.length)}return source}
async function uploadMarkdown(page,region,values){const downloadPromise=page.waitForEvent("download");await region.getByRole("button",{name:"Unduh Markdown"}).click();const dl=await downloadPromise;const text=changeMarkdown(fs.readFileSync(await dl.path(),"utf8"),values);await region.locator('input[type="file"]').setInputFiles({name:"qa-stage.md",mimeType:"text/markdown",buffer:Buffer.from(text)})}
async function uploadXlsx(page,region,values){const downloadPromise=page.waitForEvent("download");await region.getByRole("button",{name:"Unduh XLSX"}).click();const dl=await downloadPromise;const zip=await JSZip.loadAsync(fs.readFileSync(await dl.path()));let sheet=await zip.file("xl/worksheets/sheet1.xml").async("string");
for(const [row,value] of Object.entries(values)){const match=new RegExp('(<c r="C'+row+'"[^>]*><is><t xml:space="preserve">)[\\s\\S]*?(<\\/t><\\/is><\\/c>)');assert(match.test(sheet));sheet=sheet.replace(match,(_,start,end)=>start+value.replace(/&/g,"&amp;")+end)}
zip.file("xl/worksheets/sheet1.xml",sheet);await region.locator('input[type="file"]').setInputFiles({name:"qa-stage.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:await zip.generateAsync({type:"nodebuffer"})})}
async function eventually(fn,timeout=16000){const start=Date.now();while(Date.now()-start<timeout){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,220))}throw Error("Database state did not update")}
(async()=>{
 user=await db.studioUser.create({data:{name:"Unified Form QA",role:"EDITOR",active:true,email:randomBytes(10).toString("hex")+"@example.invalid"}});
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"QA Buku Stage Form",author:"Penulis Penguji",grade:"7",subject:"IPA",description:"Konteks uji import stage terisolasi",editorialStage:"BRIEF",bookType:"NONFICTION",genre:"TEXTBOOK",targetAudience:"Siswa SMP",writingGoal:"Menguasai konsep IPA",pageSize:"A4"}});
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:900,height:900},acceptDownloads:true});
 await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
 const page=await ctx.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("dialog",d=>d.accept());
 const health=await ctx.request.get(origin+"/api/studio/ai-form");assert.equal(health.status(),200);const healthData=await health.json();assert.equal(healthData.configured,false);assert.equal(JSON.stringify(healthData).includes("encryptedKey"),false);
 const forbidden=await ctx.request.post(origin+"/api/studio/ai-form",{data:{bookId:book.id,name:"Checklist editorial",context:"",goal:"complete",fields:[{key:"approve",label:"Persetujuan",type:"boolean"}],values:{approve:false}}});assert.equal(forbidden.status(),403);
 const noProvider=await ctx.request.post(origin+"/api/studio/ai-form",{data:{bookId:book.id,name:"Stage 2 Kerangka Bab",context:"Uji struktur",goal:"complete",fields:[{key:"title",label:"Judul",type:"text"}],values:{title:"Judul bab"}}});assert.equal(noProvider.status(),503);
 console.log("AI_MODEL_SETTINGS_SECURITY_PASS 200/403/503, zero credential disclosure");
 await page.goto(origin+"/studio?bookId="+book.id+"&module=Proyek+Buku");
 const details=page.locator("details.optional-tools").filter({hasText:"Impor atau unduh rincian buku"}).first();await details.locator("summary").first().click();
 const metadata=page.getByRole("region",{name:"Impor dan ekspor Metadata proyek buku"});await metadata.waitFor();
 await metadata.locator("summary").filter({hasText:"Generate prompt"}).click();
 const prompt=await metadata.getByRole("textbox",{name:"Pratinjau prompt AI Metadata proyek buku"}).inputValue();
 assert(prompt.includes("Pemimpin Redaksi")&&prompt.includes("registry: chief_editor")&&prompt.includes("QA Buku Stage Form"));
 assert.equal(await metadata.getByRole("button",{name:/Isi formulir dengan AI aktif/}).isDisabled(),true);
 await uploadMarkdown(page,metadata,{title:"QA Buku Autofill Tersimpan",targetAudience:"Siswa SMP kelas tujuh",writingGoal:"Siswa dapat mengaitkan IPA dengan pengamatan nyata"});
 await eventually(async()=>{const record=await db.book.findUnique({where:{id:book.id}});return record?.title==="QA Buku Autofill Tersimpan"&&record.targetAudience==="Siswa SMP kelas tujuh"});
 assert.equal(await metadata.getByRole("button",{name:"Terapkan ke form"}).count(),0);
 console.log("STAGE1_MARKDOWN_AUTOFILL_AUTOSAVE_PASS");
 await db.book.update({where:{id:book.id},data:{editorialStage:"OUTLINE"}});
 await page.goto(origin+"/studio?bookId="+book.id+"&module=Rancang");
 const outline=page.getByRole("region",{name:"Tahap Rancang"});await outline.waitFor();
 const chapterForm=outline.getByRole("region",{name:"Impor dan ekspor Stage 2 Kerangka Bab"});await chapterForm.waitFor();
 await uploadXlsx(page,chapterForm,{2:"Bab Ekologi Sains",3:"Siswa dapat membedakan komponen ekosistem melalui observasi."});
 const chapter=await eventually(()=>db.chapter.findFirst({where:{bookId:book.id,title:"Bab Ekologi Sains"}}));
 assert(chapter.outlineObjective.includes("komponen ekosistem"));
 console.log("STAGE2_CHAPTER_XLSX_AUTOFILL_AUTOSAVE_PASS");
 const sectionDetails=outline.locator("details.outline-section-details").first();await sectionDetails.locator("summary").click();
 const sectionForm=outline.getByRole("region",{name:"Impor dan ekspor Stage 2 Subbagian"});await sectionForm.waitFor();
 await uploadMarkdown(page,sectionForm,{title:"Faktor abiotik",objective:"Siswa mengamati pengaruh air dan cahaya pada makhluk hidup",content:"Contoh sederhana faktor lingkungan di sekolah."});
 const section=await eventually(()=>db.outlineSection.findFirst({where:{bookId:book.id,chapterId:chapter.id,title:"Faktor abiotik"}}));
 assert(section.objective.includes("air dan cahaya"));
 console.log("STAGE2_SECTION_MD_AUTOFILL_AUTOSAVE_PASS");
 assert.deepEqual(errors,[]);console.log("UNIFIED_STAGE_AUTOFILL_E2E_PASS");
})().catch(e=>{console.error("UNIFIED_STAGE_AUTOFILL_FAIL",e.stack||e);process.exitCode=1}).finally(async()=>{
 await browser?.close();
 if(book){await db.outlineSection.deleteMany({where:{bookId:book.id}}).catch(()=>{});await db.bookBriefRevision.deleteMany({where:{bookId:book.id}}).catch(()=>{});await db.chapter.deleteMany({where:{bookId:book.id}}).catch(()=>{});await db.book.deleteMany({where:{id:book.id}}).catch(()=>{})}
 if(user){await db.studioSession.deleteMany({where:{userId:user.id}}).catch(()=>{});await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{})}
 await db.$disconnect()
});
