const {chromium}=require("@playwright/test"),{PrismaClient}=require("@prisma/client"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
if(!/^postgresql:\/\/bookstudio@127\.0\.0\.1:55999\/bookstudio$/.test(process.env.DATABASE_URL||""))throw Error("QA database required");
const db=new PrismaClient(),nonce=crypto.randomBytes(5).toString("hex"),pw=crypto.randomBytes(18).toString("hex"),salt=crypto.randomBytes(16).toString("hex");
const email="qa-visual-"+nonce+"@example.invalid";
const output=path.join(__dirname,"test-results","responsive");
fs.mkdirSync(output,{recursive:true});
(async()=>{
 let browser,bookId;
 try{
  await db.studioUser.create({data:{email,name:"QA Visual",role:"EDITOR",active:true,passwordHash:salt+":"+crypto.scryptSync(pw,salt,64).toString("hex")}});
  const login=await fetch("http://127.0.0.1:32975/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
  if(!login.ok)throw Error("QA login returned "+login.status);
  const cookie=(login.headers.get("set-cookie")||"").split(";")[0];
  const token=cookie.split("=")[1];
  if(!token)throw Error("No session token");
  const create=await fetch("http://127.0.0.1:32975/api/books",{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({title:"QA Proyek Tampilan",grade:"7",subject:"Bahasa Indonesia",description:"Konten visual pengujian",bookType:"NONFICTION",genre:"TEXTBOOK"})});
  if(!create.ok)throw Error("Create failed "+create.status);
  bookId=(await create.json()).book.id;
  browser=await chromium.launch({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true});
  const widths=[320,375,390,768,1024,1440],results=[];
  for(const w of widths){
   for(const mode of ["light","dark"]){
    const context=await browser.newContext({viewport:{width:w,height:900},deviceScaleFactor:1});
    await context.addCookies([{name:"bcstudio_session",value:token,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:32975/studio",{waitUntil:"networkidle"});
    await page.evaluate(m=>localStorage.setItem("bcstudio-theme",m),mode);
    await page.reload({waitUntil:"networkidle"});
    await page.locator("#main-content").waitFor();
    const snapshot=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,vw:innerWidth,theme:document.documentElement.dataset.theme}));
    await page.addScriptTag({path:require.resolve("axe-core/axe.min.js")});
    const problems=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));});
    await page.screenshot({path:path.join(output,mode+"-"+w+".png"),fullPage:true});
    let mobileNav=null;
    if(w<=760){
     await page.getByRole("button",{name:"Buka menu"}).click();
     mobileNav=await page.getByRole("navigation",{name:"Menu studio"}).isVisible();
     await page.keyboard.press("Escape");
    }
    const result={width:w,mode,overflow:snapshot.sw>snapshot.vw+1,theme:snapshot.theme,mobileNav,violations:problems};
    results.push(result);
    console.log("VISUAL_QA",JSON.stringify(result));
    await context.close();
   }
  }
  const bad=results.filter(r=>r.overflow||r.theme!==r.mode||r.mobileNav===false||r.violations.some(v=>v.impact==="critical"||v.impact==="serious"));
  console.log("VISUAL_QA_SUMMARY cases="+results.length+" failures="+bad.length);
  if(bad.length)process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  if(bookId)await db.book.deleteMany({where:{id:bookId}}).catch(()=>{});
  await db.studioUser.deleteMany({where:{email}}).catch(()=>{});
  await db.$disconnect();
 }
})().catch(e=>{console.error("VISUAL_QA_ERROR",e.message);process.exitCode=1});
