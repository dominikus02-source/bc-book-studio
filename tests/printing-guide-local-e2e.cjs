require("dotenv").config({path:".env.local"});
const {PrismaClient}=require("@prisma/client");
const {chromium}=require("@playwright/test");
const {randomBytes,scryptSync}=require("node:crypto");
const assert=require("node:assert/strict");
const db=new PrismaClient();
const base="http://127.0.0.1:3106";
const password="Temp"+randomBytes(14).toString("hex")+"!";
const email="qa-print-"+Date.now()+"@example.test";
const salt=randomBytes(16).toString("hex");
let user,book,browser;
(async()=>{
 if(!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("Refusing non-local database");
 user=await db.studioUser.create({data:{email,name:"Temporary Print QA",role:"EDITOR",active:true,passwordHash:salt+":"+scryptSync(password,salt,64).toString("hex")}});
 book=await db.book.create({data:{ownerId:user.id,title:"Temporary Print QA Book",grade:"SMP",subject:"QA"}});
 const login=await fetch(base+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});assert.equal(login.status,200,"real login");
 const rawCookie=login.headers.get("set-cookie").split(";")[0];
 const headers={cookie:rawCookie,"content-type":"application/json"};
 const data={bookId:book.id,printerName:"Percetakan QA",contact:"qa@example.test",quantity:10,paper:"HVS 80 gsm",binding:"Perfect",color:"BW",size:"A5",unitPrice:15000,dueDate:"",notes:"Proof pending",status:"DRAFT"};
 const api=async(method,url,body)=>{const r=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 let r=await api("POST","/api/printing",data);assert.equal(r.status,201,JSON.stringify(r.data));const id=r.data.order.id;
 r=await api("GET","/api/printing?bookId="+book.id);assert.equal(r.status,200);assert(r.data.orders.some(x=>x.id===id));
 r=await api("PATCH","/api/printing",{id,quantity:20,status:"QUOTED"});assert.equal(r.status,200);assert.equal(r.data.order.quantity,20);
 r=await api("DELETE","/api/printing?id="+id);assert.equal(r.status,200);assert.equal(r.data.deleted,true);
 r=await api("GET","/api/printing?bookId="+book.id);assert(!r.data.orders.some(x=>x.id===id));
 console.log("CRUD_REAL_LOGIN_PASS");
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 const cookieValue=rawCookie.slice(rawCookie.indexOf("=")+1);
 await context.addCookies([{name:"bcstudio_session",value:cookieValue,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax"}]);
 for(const width of [375,768,1440]){
   const page=await context.newPage();await page.setViewportSize({width,height:850});
   for(const module of ["Percetakan","Petunjuk Penggunaan"]){
     await page.goto(base+"/studio?bookId="+book.id+"&module="+encodeURIComponent(module),{waitUntil:"domcontentloaded",timeout:30000});
     await page.getByRole("heading",{name:module,exact:true}).first().waitFor({timeout:20000});
     const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
     assert(dims.scroll<=dims.inner+2,module+" horizontal overflow "+width+" "+JSON.stringify(dims));
     if(module==="Petunjuk Penggunaan"){
       await page.getByRole("button",{name:/Stage 2/}).first().click();
       assert(await page.getByText("Prasyarat belum terpenuhi").count()>0 || await page.locator('a[href*="module=Rancang"]').count()>0);
     }
     await page.screenshot({path:"tests/qa-"+module.replaceAll(" ","-")+"-"+width+".png",fullPage:true});
   }await page.close();
 }console.log("VISUAL_VIEWPORT_PASS_375_768_1440");
})().catch(e=>{console.error("QA_FAILED",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close().catch(()=>{});if(user){await db.studioFormDraft.deleteMany({where:{ownerId:user.id,module:"PRINT_ORDER"}}).catch(()=>{});if(book)await db.book.deleteMany({where:{id:book.id}}).catch(()=>{});await db.studioUser.delete({where:{id:user.id}}).catch(()=>{});}await db.$disconnect();});
