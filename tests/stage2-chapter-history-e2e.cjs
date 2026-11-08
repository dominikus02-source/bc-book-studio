"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{createHash,randomBytes}=require("node:crypto"),{chromium}=require("playwright");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let user,book,browser;
async function api(path,method,expected,token,data){
 const r=await fetch(origin+path,{method,headers:{cookie:"bcstudio_session="+token,...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined});
 const body=await r.json();assert.equal(r.status,expected,method+" "+path+" got "+r.status+" "+JSON.stringify(body).slice(0,260));return body;
}
async function main(){
 user=await db.studioUser.create({data:{role:"EDITOR",active:true,name:"Outline History QA",email:randomBytes(10).toString("hex")+"@example.invalid"}});
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 book=await db.book.create({data:{ownerId:user.id,title:"History QA",subject:"IPA",grade:"7",targetAudience:"Siswa",writingGoal:"Memahami tujuan",description:"Buku pengujian outline dengan riwayat yang lengkap.",editorialStage:"OUTLINE",chapters:{create:{title:"Energi",position:1,outlineObjective:"Memahami energi dasar",content:"Naskah awal terjaga dan tidak boleh hilang saat pemulihan."}}},include:{chapters:true}});
 const chapter=book.chapters[0],path="/api/books/"+book.id+"/chapters/"+chapter.id;
 const changed=(await api(path,"PATCH",200,token,{title:"Energi dan usaha",outlineObjective:"Menghitung usaha dan energi",expectedVersion:chapter.updatedAt.toISOString()})).chapter;
 const history=(await api(path,"GET",200,token)).chapter.revisions;
 const old=history.find(x=>x.outlineObjective==="Memahami energi dasar");assert(old);
 await api(path,"PATCH",409,token,{restoreOutlineRevision:old.revision,expectedVersion:chapter.updatedAt.toISOString()});
 const restored=(await api(path,"PATCH",200,token,{restoreOutlineRevision:old.revision,expectedVersion:changed.updatedAt})).chapter;
 assert.equal(restored.outlineObjective,chapter.outlineObjective);assert.equal(restored.title,chapter.title);assert.equal(restored.content,chapter.content);
 const stored=await db.chapterRevision.findMany({where:{chapterId:chapter.id}});assert(stored.length>=2);
 browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:860}});
 await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await ctx.newPage();
 await page.goto(origin+"/studio?module=Rancang&bookId="+book.id);
 const section=page.getByRole("region",{name:"Tahap Rancang"});await section.waitFor();
 await section.getByText("Riwayat judul & tujuan bab").click();
 const visible=section.getByRole("region",{name:"Riwayat judul dan tujuan bab"});await visible.waitFor();
 await visible.getByText("Menghitung usaha dan energi").waitFor({timeout:12000});
 console.log("STAGE2_CHAPTER_HISTORY_PASS: metadata revisions, stale conflict, restore preserves manuscript, UI history visible");
}
main().catch(e=>{console.error("STAGE2_HISTORY_FAIL",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(book)await db.book.deleteMany({where:{id:book.id}}).catch(()=>{});if(user)await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{});await db.$disconnect()});
