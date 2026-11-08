"use strict";
const crypto=require("crypto"),assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright"),path=require("path");process.loadEnvFile(path.join(__dirname,"..",".env.local"));
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
(async()=>{
 let session,ownerId,browser,createdUser;
 try{
  let user=await db.studioUser.findFirst({where:{role:"ADMIN",active:true}});
  if(!user){user=await db.studioUser.create({data:{email:"qa-ui-publisher-"+crypto.randomBytes(4).toString("hex")+"@example.invalid",name:"QA Publisher",role:"ADMIN",active:true}});createdUser=user.id}
  const token=crypto.randomBytes(32).toString("hex");session=await db.studioSession.create({data:{userId:user.id,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+480000)}});browser=await chromium.launch();
  for(const width of [390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:850}});await context.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
   const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(origin+"/studio?module=ISBN%20%26%20Legalitas",{waitUntil:"domcontentloaded"});
   await page.getByRole("heading",{name:"ISBN & Administrasi Penerbit"}).waitFor({timeout:35000});
   await page.getByRole("tab",{name:"Profil & Legalitas"}).click();
   await page.locator('input[value="PT Bahasa Cerdas Indonesia"]').waitFor();
   await page.getByRole("tab",{name:"Persyaratan dan Panduan"}).click();
   assert(await page.getByText("Peraturan Perpusnas Nomor 11 Tahun 2025").count()>0);
   await page.getByRole("tab",{name:"Pengajuan ISBN"}).click();
   await page.getByRole("button",{name:"Baru",exact:true}).click();
   await page.getByText("Pengajuan edisi baru").waitFor();
   assert(await page.getByRole("combobox",{name:"Ukuran fisik edisi cetak"}).count()===1);
   const docWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
   console.log("ISBN_UI_PASS",width,"viewport",width,"documentWidth",docWidth,"errors",errors.length);
   assert(docWidth<=width+1,"horizontal document overflow");
   assert.deepEqual(errors,[]);
   await context.close();
  }
 }finally{if(browser)await browser.close();if(session)await db.studioSession.delete({where:{id:session.id}});if(createdUser)await db.studioUser.delete({where:{id:createdUser}})}
})().catch(e=>{console.error("ISBN_UI_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
