const {chromium}=require("@playwright/test"),{PrismaClient}=require("@prisma/client"),{randomBytes,scryptSync}=require("node:crypto"),assert=require("node:assert/strict");
if(!/^postgresql:\/\/bookstudio@127\.0\.0\.1:55434\/bookstudio$/.test(process.env.DATABASE_URL||""))throw Error("QA database required");
const db=new PrismaClient(),nonce=randomBytes(5).toString("hex"),email="qa-save-"+nonce+"@example.invalid",pw=randomBytes(20).toString("hex"),salt=randomBytes(16).toString("hex");
(async()=>{
 let browser,bookId;
 try{
  await db.studioUser.create({data:{email,name:"QA Autosave",active:true,role:"EDITOR",passwordHash:salt+":"+scryptSync(pw,salt,64).toString("hex")}});
  const login=await fetch("http://127.0.0.1:3195/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get("set-cookie")||"").split(";")[0],token=cookie.split("=")[1];
  const create=await fetch("http://127.0.0.1:3195/api/books",{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({title:"QA Autosave Book",grade:"7",subject:"Sastra",description:"Autosave demo",bookType:"FICTION",genre:"NOVEL"})});
  assert.equal(create.status,201);bookId=(await create.json()).book.id;
  const add=await fetch("http://127.0.0.1:3195/api/books/"+bookId+"/chapters",{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({title:"Bab Awal",content:"Ini isi awal cerita yang cukup panjang untuk diperiksa."})});
  assert.equal(add.status,201);
  const chapterId=(await add.json()).chapter.id;
  browser=await chromium.launch({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.addCookies([{name:"bcstudio_session",value:token,domain:"127.0.0.1",path:"/",httpOnly:true,secure:false,sameSite:"Lax"}]);
  const page=await ctx.newPage();await page.goto("http://127.0.0.1:3195/studio",{waitUntil:"networkidle"});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("bc-studio-navigate",{detail:"Proyek Buku"})));
  await page.getByRole("button",{name:/QA Autosave Book/}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("bc-studio-navigate",{detail:"Studio Penulisan"})));
  await page.getByText("Bab Awal",{exact:true}).click();
  await page.getByRole("button",{name:"Ubah",exact:true}).click();
  await page.getByRole("textbox",{name:"Judul bab"}).fill("Bab Tersimpan Otomatis");
  await page.getByRole("textbox",{name:"Isi bab"}).fill("Naskah ini berubah dan harus tersimpan otomatis setelah jeda tanpa tombol manual.");
  await page.waitForTimeout(3000);
  await page.getByText("Tersimpan",{exact:true}).waitFor({timeout:10000});
  const updated=await db.chapter.findUnique({where:{id:chapterId},include:{revisions:true}});
  assert.equal(updated.title,"Bab Tersimpan Otomatis");
  assert.equal(updated.revisions.length,1);
  console.log("AUTOSAVE_UI_QA_PASS mobile390 debounce persisted chapter revision");
 }finally{
  if(browser)await browser.close();
  if(bookId)await db.book.deleteMany({where:{id:bookId}}).catch(()=>{});
  await db.studioUser.deleteMany({where:{email}}).catch(()=>{});
  await db.$disconnect();
 }
})().catch(e=>{console.error("AUTOSAVE_UI_QA_FAIL",e.message);process.exitCode=1});
