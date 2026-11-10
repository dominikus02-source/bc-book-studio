"use strict";
const assert=require("node:assert/strict");
const {randomBytes,createHash}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const {chromium}=require("playwright");
const fs=require("node:fs/promises");
const database=new URL(process.env.DATABASE_URL);
assert.equal(database.host+database.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin=process.env.REVIEW_QA_ORIGIN||"http://127.0.0.1:32979",users=[],books=[];
let browser;
async function actor(role){
 const user=await db.studioUser.create({data:{role,active:true,name:"Workflow QA",email:randomBytes(12).toString("hex")+"@example.invalid"}});
 users.push(user.id);
 const token=randomBytes(32).toString("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+1800000)}});
 return {...user,token};
}
async function call(path,status,user,data,method=data?"POST":"GET"){
 if(method==="PATCH"&&/^\/api\/books\/[^/]+$/.test(path)&&data&&!Object.prototype.hasOwnProperty.call(data,"expectedVersion")){
  const r=await fetch(origin+path,{headers:{...(user?{cookie:"bcstudio_session="+user.token}:{})}});
  const current=await r.json().catch(()=>({}));data={...data,expectedVersion:current.book?.updatedAt||new Date(0).toISOString()};
 }
 const response=await fetch(origin+path,{method,headers:{...(user?{cookie:"bcstudio_session="+user.token}:{}),...(data?{"content-type":"application/json"}:{})},body:data?JSON.stringify(data):undefined});
 const body=await response.json();
 if(status!==null)assert.equal(response.status,status,method+" "+path+" "+JSON.stringify(body).slice(0,250));
 return {status:response.status,...body};
}
async function main(){
 const owner=await actor("EDITOR"),reviewer=await actor("REVIEWER"),admin=await actor("ADMIN"),other=await actor("EDITOR");
 const book=(await call("/api/books",201,owner,{title:"Satu buku satu alur QA",grade:"7",subject:"Bahasa",bookType:"NONFICTION",genre:"REFERENCE"})).book;books.push(book.id);
 const path="/api/books/"+book.id;
 await call(path,401);await call(path,404,other);await call(path,404,admin);
 await call(path,404,other,{title:"Tidak boleh"},"PATCH");
 await call(path+"/workflow",404,admin,{to:"OUTLINE"});
 await call(path+"/review",409,owner,{action:"submit"});
 await call(path,200,owner,{description:"Buku panduan belajar menulis cerita untuk siswa kelas tujuh.",targetAudience:"Siswa kelas VII",writingGoal:"Menulis cerita pendek.",editorialChecks:{objectives:true,sources:true,assessment:true,expert:true,rights:true}},"PATCH");
 await call(path+"/workflow",200,owner,{to:"OUTLINE"});
 let chapter=(await call(path+"/chapters",201,owner,{title:"Mengenal cerita",outlineObjective:"Mengenali struktur cerita."})).chapter;
 await call(path,200,owner,{writingGoal:""},"PATCH");
 await call(path+"/workflow",409,owner,{to:"WRITING"});
 await call(path,200,owner,{writingGoal:"Menulis cerita pendek."},"PATCH");
 await call(path+"/workflow",200,owner,{to:"WRITING"});
 chapter=(await call(path+"/chapters/"+chapter.id,200,owner,{title:chapter.title,outlineObjective:"Mengenali struktur dan tokoh cerita.",expectedVersion:chapter.updatedAt},"PATCH")).chapter;
 chapter=(await call(path+"/chapters/"+chapter.id,200,owner,{title:chapter.title,content:"Cerita memiliki tokoh, latar, konflik, dan penyelesaian yang saling berkaitan.",expectedVersion:chapter.updatedAt},"PATCH")).chapter;
 await call(path+"/reviewers",404,other,{email:reviewer.email});
 await call(path+"/reviewers",404,owner,{email:owner.email});
 await call(path+"/reviewers",404,owner,{email:other.email});
 await call(path+"/reviewers",201,owner,{email:reviewer.email});
 await call(path,200,reviewer);
 await call(path+"/chapters/"+chapter.id,404,reviewer,{title:chapter.title,content:chapter.content,expectedVersion:chapter.updatedAt},"PATCH");
 assert.equal((await call(path+"/workflow",200,owner)).stages[3].available,true);
 console.log("PASS CRUD ownership: EDITOR owner, other editor, unassigned ADMIN, assigned REVIEWER and anonymous; stage prerequisites and outline reopening");

 const second=(await call("/api/books",201,owner,{title:"Buku kedua untuk navigasi QA",grade:"8",subject:"Bahasa"})).book;books.push(second.id);
 browser=await chromium.launch();
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:"bcstudio_session",value:owner.token,url:origin}]);
 const page=await context.newPage();
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.goto(origin+"/studio?module=Proyek+Buku&bookId="+book.id);
 const stages=page.getByRole("region",{name:"Tahapan pembuatan buku"});
 await stages.getByText(book.title,{exact:true}).waitFor();
 await page.getByRole("button",{name:new RegExp(second.title)}).click();
 await stages.getByText(second.title,{exact:true}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get("bookId"),second.id);
 await page.reload();await stages.getByText(second.title,{exact:true}).waitFor();
 await page.getByRole("button",{name:new RegExp(book.title)}).click();
 await stages.getByRole("button",{name:/2. Rancang/}).click();
 await page.getByRole("region",{name:"Tahap Rancang"}).getByRole("button",{name:"Ubah kerangka"}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get("bookId"),book.id);
 await page.goBack();
 await page.getByRole("button",{name:"Simpan perubahan",exact:true}).waitFor();
 console.log("PASS two-book selection synced with URL, workflow, refresh and browser Back");
 await fs.mkdir("F:/tmp/bc-workflow-ux-qa",{recursive:true});
 for(const theme of ["light","dark"]){
  await page.evaluate(theme=>{localStorage.setItem("bcstudio-theme",theme)},theme);
  for(const module of ["Proyek Buku","Rancang","Studio Penulisan","Penyuntingan","Tata Letak"]){
   await page.goto(origin+"/studio?module="+encodeURIComponent(module)+"&bookId="+book.id);
   await stages.getByText(book.title,{exact:true}).waitFor();
   for(const width of [320,375,390,768,1024,1440]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,module+" "+theme+" "+width);
    assert.equal(await stages.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,"stage controls "+width);
   }
   await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:"F:/tmp/bc-workflow-ux-qa/"+theme+"-"+module.replaceAll(" ","-")+".png",fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);
 console.log("PASS five author workspaces x six widths x light/dark; screenshots saved; no browser JS errors");

 await call(path+"/review",200,owner,{action:"submit"});
 await call(path+"/reviewers",409,owner,{email:admin.email});
 await call(path+"/reviewers",409,owner,{reviewerId:reviewer.id},"DELETE");
 await call(path+"/review",403,owner,{action:"approve",note:"Tidak boleh"});
 await call(path+"/review",403,admin,{action:"approve",note:"Tidak ditugaskan"});
 const data={bookId:book.id,chapterId:chapter.id,category:"CONTENT",severity:"CRITICAL",content:"Periksa kebenaran isi sebelum menyetujui."};
 await call("/api/reviewer/notes",403,owner,data);
 await call("/api/reviewer/notes",403,admin,data);
 const note=(await call("/api/reviewer/notes",201,reviewer,data)).note;
 await call("/api/reviewer/notes/"+note.id,404,admin,{status:"RESOLVED",expectedVersion:note.updatedAt},"PATCH");
 await call(path+"/review",409,reviewer,{action:"approve",note:"Masih ada catatan kritis"});
 await call("/api/reviewer/notes/"+note.id,200,reviewer,{status:"RESOLVED",expectedVersion:note.updatedAt},"PATCH");
 assert.equal(await db.review.count({where:{bookId:book.id,decision:"note:update"}}),1);
 const results=await Promise.all([
  call("/api/reviewer/notes",null,reviewer,{...data,content:"Catatan kritis bersamaan dengan persetujuan."}),
  call(path+"/review",null,reviewer,{action:"approve",note:"Persetujuan untuk fixture QA"})
 ]);
 const state=await db.book.findUnique({where:{id:book.id}});
 if(state.status==="APPROVED"){
  assert.equal(results[0].status,409);assert.equal(results[1].status,200);
  assert.equal(await db.reviewerNote.count({where:{bookId:book.id,status:"OPEN",severity:"CRITICAL"}}),0);
 }else{
  assert.equal(results[0].status,201);assert.equal(results[1].status,409);
  await call("/api/reviewer/notes/"+results[0].note.id,200,reviewer,{status:"RESOLVED",expectedVersion:results[0].note.updatedAt},"PATCH");
  await call(path+"/review",200,reviewer,{action:"approve",note:"Catatan telah diselesaikan"});
 }
 await call("/api/reviewer/notes",409,reviewer,data);
 await call("/api/reviewer/notes/"+note.id,409,reviewer,{content:"Tidak boleh setelah ditutup",expectedVersion:note.updatedAt},"PATCH");
 assert.equal((await call(path+"/workflow",200,owner)).stages[4].available,true);
 console.log("PASS locked review assignments, independent reviewer, critical-note gate, audit and concurrent note/approval serialization");
}
main().finally(async()=>{
 if(browser)await browser.close();
 await db.bookLayout.deleteMany({where:{bookId:{in:books}}});
 await db.bookApprovalSnapshot.deleteMany({where:{bookId:{in:books}}});
 await db.book.deleteMany({where:{id:{in:books}}});
 await db.studioUser.deleteMany({where:{id:{in:users}}});
 await db.$disconnect();
}).catch(error=>{console.error(error);process.exitCode=1});
