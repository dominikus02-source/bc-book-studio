const {chromium}=require("@playwright/test"),{PrismaClient}=require("@prisma/client"),{randomBytes,scryptSync}=require("node:crypto");
if(!/^postgresql:\/\/bookstudio@127\.0\.0\.1:55434\/bookstudio$/.test(process.env.DATABASE_URL||""))throw Error("QA database required");
const db=new PrismaClient(),nonce=randomBytes(5).toString("hex"),pw=randomBytes(16).toString("hex"),salt=randomBytes(16).toString("hex"),email="qa-tabs-"+nonce+"@example.invalid";
const tabs=["Proyek Buku","Buat Buku","Idea Lab","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Tinjauan Pedagogis","Tata Letak","Penerbitan","Pusat Agen","Pengaturan"];
(async()=>{
 let browser,bookId;
 try{
  await db.studioUser.create({data:{email,name:"QA Tabs",role:"EDITOR",active:true,passwordHash:salt+":"+scryptSync(pw,salt,64).toString("hex")}});
  const r=await fetch("http://127.0.0.1:3195/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
  if(!r.ok)throw Error("QA login failed");
  const cookie=(r.headers.get("set-cookie")||"").split(";")[0],token=cookie.split("=")[1];
  const br=await fetch("http://127.0.0.1:3195/api/books",{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({title:"QA UI Tabs",grade:"7",subject:"Literasi",description:"QA tabs",bookType:"NONFICTION",genre:"REFERENCE"})});
  if(!br.ok)throw Error("QA book fail "+br.status);bookId=(await br.json()).book.id;
  browser=await chromium.launch({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true});
  let fails=0,total=0;
  for(const w of [390,1440]){
   for(const mode of ["light","dark"]){
    const ctx=await browser.newContext({viewport:{width:w,height:900}});
    await ctx.addCookies([{name:"bcstudio_session",value:token,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
    const page=await ctx.newPage();await page.goto("http://127.0.0.1:3195/studio",{waitUntil:"networkidle"});
    await page.evaluate(v=>localStorage.setItem("bcstudio-theme",v),mode);await page.reload({waitUntil:"networkidle"});
    await page.addScriptTag({path:require.resolve("axe-core/axe.min.js")});
    for(const tab of tabs){
     await page.evaluate(name=>window.dispatchEvent(new CustomEvent("bc-studio-navigate",{detail:name})),tab);
     await page.waitForTimeout(100);
     const violation=await page.evaluate(async()=>{const data=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}});return data.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target.join(" "))}));});
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
     total++;
     if(overflow||violation.length){fails++;console.log("TAB_QA_FAIL",JSON.stringify({width:w,mode,tab,overflow,violation:violation.slice(0,3)}))}
    }
    await ctx.close();
   }
  }
  console.log("TAB_QA_SUMMARY total="+total+" failures="+fails);
  if(fails)process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  if(bookId)await db.book.deleteMany({where:{id:bookId}}).catch(()=>{});
  await db.studioUser.deleteMany({where:{email}}).catch(()=>{});
  await db.$disconnect();
 }
})().catch(e=>{console.error("TAB_QA_ERROR",e.message);process.exitCode=1});
