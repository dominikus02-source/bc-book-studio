import {spawn} from "node:child_process";
import {mkdtemp,rm,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {scryptSync,randomBytes} from "node:crypto";
import {PrismaClient} from "@prisma/client";
const port=3187, debugPort=19389;
const prisma=new PrismaClient({datasources:{db:{url:"postgresql://postgres@127.0.0.1:55439/postgres"}}});
const chrome="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile=await mkdtemp(join(tmpdir(),"bc-axe-"));
const browser=spawn(chrome,["--headless=new","--no-first-run","--disable-gpu","--no-default-browser-check","--remote-debugging-port="+debugPort,"--user-data-dir="+profile,"about:blank"],{stdio:"ignore"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws,id=0;const pending=new Map();
async function rpc(method,params={}){const n=++id;return await new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(new Error("CDP timeout: "+method))}},30000)})}
async function evaluate(expression){const r=await rpc("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||"Browser script failed");return r.result?.value}
try{
 const email="qa-accessibility@studio.example.test",password="BC-Wcag-Strong-"+randomBytes(8).toString("hex");
 const salt=randomBytes(16).toString("hex");const hashed=salt+":"+scryptSync(password,salt,64).toString("hex");
 const user=await prisma.studioUser.upsert({where:{email},create:{email,name:"QA Accessibility User",passwordHash:hashed,active:true,role:"EDITOR"},update:{passwordHash:hashed,active:true}});
 const book=await prisma.book.findFirst({where:{title:"QA Accessibility Sample"}});
 if(!book)await prisma.book.create({data:{title:"QA Accessibility Sample",grade:"7",subject:"Bahasa Indonesia",chapters:{create:{position:1,title:"Contoh bab",content:"Contoh isi naskah panjang untuk menampilkan daftar bab serta panel editor pada pemeriksaan WCAG dan responsivitas."}}}});
 const response=await fetch("http://127.0.0.1:"+port+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
 const cookie=response.headers.get("set-cookie")?.split(";")[0];
 if(!response.ok||!cookie)throw Error("Real login API failed: "+response.status);
 console.log("LOGIN_API_SUCCESS real_http_only_session=true");
 let endpoint;for(let i=0;i<60;i++){try{const r=await fetch("http://127.0.0.1:"+debugPort+"/json/new?about:blank",{method:"PUT"});if(r.ok){endpoint=(await r.json()).webSocketDebuggerUrl;break}}catch{}await delay(150)}if(!endpoint)throw Error("Chrome unreachable");
 ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true})});
 ws.addEventListener("message",event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
 await rpc("Page.enable");await rpc("Runtime.enable");await rpc("Network.enable");
 const [name,value]=cookie.split("=");await rpc("Network.setCookie",{name,value,url:"http://127.0.0.1:"+port+"/",httpOnly:true,sameSite:"Lax"});
 const axe=await readFile(join(process.cwd(),"node_modules","axe-core","axe.min.js"),"utf8");
 await rpc("Page.addScriptToEvaluateOnNewDocument",{source:axe});
 const all=[];
 for(const width of [320,375,390,768,1024,1440]){
   await rpc("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<768});
   for(const theme of ["light","dark"]){
     await rpc("Page.navigate",{url:"http://127.0.0.1:"+port+"/studio"});await delay(800);
     await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
     await delay(250);
     const auth=await evaluate('({title:document.title,logged:document.body.innerText.includes("Buat buku"),emailInput:!!document.querySelector("input[type=email]"),width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth})');
     if(!auth.logged)throw Error("Authenticated dashboard did not load "+width+" "+theme+" "+JSON.stringify(auth));
     const violations=await evaluate('axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}}).then(x=>x.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,first:v.nodes[0]?.target})))');
     all.push({width,theme,overflow:auth.overflow,violations});
     console.log(JSON.stringify({width,theme,overflow:auth.overflow,violations}));
   }
 }
 const failures=all.filter(x=>x.overflow>2||x.violations.length>0);
 console.log("AUTHENTICATED_AXE_AUDIT_"+(failures.length?"FAIL":"PASS")+" viewport_modes="+all.length+" failing="+failures.length);
 if(failures.length)process.exitCode=1;
}catch(error){console.error("AUTHENTICATED_AXE_ERROR",error.message);process.exitCode=2}
finally{try{ws?.close()}catch{}try{browser.kill()}catch{}await prisma.$disconnect();await rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{})}
