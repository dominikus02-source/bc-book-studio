"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright"),JSZip=require("jszip");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),base="http://127.0.0.1:32979",ids=["cmw6gk5gu005wurcoe0dk02jr","cmw7ad8q20000urfofr6mioge"];
let otherId=null;
const tokenHashes=[];
async function createCookie(userId){const token=randomBytes(32).toString("hex"),hash=createHash("sha256").update(token).digest("hex");await db.studioSession.create({data:{userId,tokenHash:hash,expiresAt:new Date(Date.now()+120000)}});tokenHashes.push(hash);return "bcstudio_session="+token}
async function read(path,cookie){return fetch(base+path,{headers:cookie?{cookie}:{}})}
async function run(){
 const b=await db.book.findMany({where:{id:{in:ids}},select:{id:true,ownerId:true,status:true,title:true,chapters:{where:{archivedAt:null},select:{id:true}}}});
 assert.equal(b.length,2);assert(b.every(x=>x.status==="DRAFT"&&x.chapters.length===3));
 const userIds=[...new Set(b.map(x=>x.ownerId))],cookies=new Map();
 for(const id of userIds){const user=await db.studioUser.findUnique({where:{id}});assert(user?.active,"Owner account inactive");cookies.set(id,await createCookie(id))}
 const other=await db.studioUser.create({data:{name:"Export Access QA",role:"EDITOR",active:true,email:randomBytes(16).toString("hex")+"@example.invalid"}});otherId=other.id;
 const outsider=await createCookie(otherId);
 const browser=await chromium.launch({headless:true});
 try{
 for(const book of b){
  const path="/api/books/"+book.id+"/draft-artifacts",cookie=cookies.get(book.ownerId);
  assert.equal((await read(path+"?type=manifest",undefined)).status,401);
  assert.equal((await read(path+"?type=manifest",outsider)).status,404);
  const manifestResponse=await read(path+"?type=manifest",cookie);
  assert.equal(manifestResponse.status,200);
  const data=await manifestResponse.json();
  assert.equal(data.status,"DRAFT_PREVIEW_ONLY");assert.equal(data.formats.length,5);
  for(const format of ["docx","pdf","epub","html","flipbook","zip"]){
   const response=await read(path+"?type="+format,cookie);
   if(response.status!==200)throw Error(format+" status "+response.status+": "+(await response.text()).slice(0,300));
   assert.equal(response.headers.get("x-draft-preview"),"true");
   assert(response.headers.get("content-disposition").includes("attachment"));
   const bytes=Buffer.from(await response.arrayBuffer());
   if(format==="zip"){
    const zip=await JSZip.loadAsync(bytes);
    const names=Object.keys(zip.files);
    assert.equal(names.filter(n=>/\.(pdf|epub|docx|html)$/i.test(n)).length,5);
    assert(names.includes("BACA-DAHULU.txt"));
   }
   if(format==="pdf")assert(bytes.subarray(0,4).equals(Buffer.from("%PDF")));
  }
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await context.addCookies([{name:"bcstudio_session",value:cookie.split("=")[1],url:base}]);
  const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/studio?module=Studio+Penulisan&bookId="+book.id);
  const panel=page.getByTestId("book-preview-artifacts");
  await panel.waitFor({timeout:25000});
  await panel.locator("summary").click();
  assert.equal(await panel.getByRole("link",{name:/Unduh semua format/}).count(),1);
  assert.equal(await panel.locator("a[href*='draft-artifacts?type=']").count(),6);
  const dl=page.waitForEvent("download");
  await panel.getByRole("link",{name:/Unduh semua format/}).click();
  const download=await dl;assert(download.suggestedFilename().endsWith(".zip"));
  await page.goto(base+"/studio?module=Penerbitan&bookId="+book.id);
  await page.getByTestId("book-preview-artifacts").waitFor({timeout:20000});
  assert.deepEqual(errors,[]);
  await context.close();
  console.log("DRAFT_EXPORT_SECURE_DOWNLOAD_AND_UI_PASS",book.title);
 }
 }finally{await browser.close()}
 console.log("TWO_BOOKS_FIVE_FORMAT_SECURED_DOWNLOAD_PASS");
}
run().catch(e=>{console.error("DRAFT_DOWNLOAD_E2E_FAIL",e);process.exitCode=1}).finally(async()=>{
 for(const tokenHash of tokenHashes)await db.studioSession.deleteMany({where:{tokenHash}}).catch(()=>{});
 if(otherId)await db.studioUser.deleteMany({where:{id:otherId}}).catch(()=>{});
 await db.$disconnect();
});
