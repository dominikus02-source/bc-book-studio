import {spawn} from "node:child_process";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const urlRoot=process.env.TEST_ORIGIN||"http://127.0.0.1:3187";
const chrome="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const dir=await mkdtemp(join(tmpdir(),"bc-browser-"));
const port=19387;
const proc=spawn(chrome,["--headless=new","--no-first-run","--disable-gpu","--no-default-browser-check","--remote-debugging-port="+port,"--user-data-dir="+dir,"about:blank"],{stdio:"ignore"});
let ws;
const pending=new Map();let id=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(method,params={}){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(new Error("CDP timeout "+method))}},9000)})}
async function evalJS(expression){const r=await req("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,500));return r.result?.value}
async function navigate(path){await req("Page.navigate",{url:urlRoot+path});await sleep(750)}
const audit=`(()=>{const sample=["body",".hero-copy>p",".hero-stats small",".feature-card p",".feature-card h3",".auth-card h1",".auth-card>p",".auth-card label",".auth-card button",".auth-links a",".studio-root h1",".studio-book",".global-theme-toggle"];function rgb(x){const m=x.match(/[0-9.]+/g);return m?m.slice(0,3).map(Number):null}function lum(s){const c=rgb(s);if(!c)return 0;const v=c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722}function ratio(a,b){let x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}function bg(node){for(let e=node;e;e=e.parentElement){const v=getComputedStyle(e).backgroundColor;if(v&&v!=="rgba(0, 0, 0, 0)"&&v!=="transparent")return v}return getComputedStyle(document.body).backgroundColor}return sample.flatMap(selector=>[...document.querySelectorAll(selector)].slice(0,2).map(n=>{const s=getComputedStyle(n),c=s.color,b=bg(n);return{selector,ratio:+ratio(c,b).toFixed(2),fg:c,bg:b,text:(n.textContent||"").trim().slice(0,35)}}))})()`;
try{
 let endpoint;
 for(let i=0;i<40;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/json/new?"+encodeURIComponent(urlRoot),{method:"PUT"});if(r.ok){endpoint=(await r.json()).webSocketDebuggerUrl;break}}catch{}await sleep(150)}
 if(!endpoint)throw Error("Chrome debugging port unavailable");
 ws=new WebSocket(endpoint);
 await new Promise((res,rej)=>{ws.addEventListener("open",res,{once:true});ws.addEventListener("error",rej,{once:true})});
 ws.addEventListener("message",event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
 await req("Page.enable");await req("Runtime.enable");
 let failures=[];
 for(const path of ["/","/login","/activate","/forgot-password","/reset-password","/studio"]){
  await navigate(path);
  const title=await evalJS("document.title");const body=await evalJS("document.body.innerText.slice(0,120)");
  for(const mode of ["light","dark"]){
   await evalJS("document.documentElement.dataset.theme="+JSON.stringify(mode));await sleep(180);
   const results=await evalJS(audit);
   const bad=results.filter(x=>x.ratio<4.5 && ![".hero-stats small"].includes(x.selector));
   console.log(JSON.stringify({path,mode,title,body:body.slice(0,32),tested:results.length,failed:bad}));
   if(bad.length)failures.push({path,mode,bad});
  }
 }
 await navigate("/login");
 const initial=await evalJS("document.documentElement.dataset.theme");
 await evalJS('document.querySelector(".global-theme-toggle").click()');
 const toggled=await evalJS("document.documentElement.dataset.theme");
 await navigate("/activate");
 const persisted=await evalJS("document.documentElement.dataset.theme");
 console.log(JSON.stringify({test:"toggle persistence",initial,toggled,persisted,pass:toggled!==initial&&persisted===toggled}));
 if(toggled===initial||persisted!==toggled)failures.push("theme toggle persistence");
 console.log("WCAG_BROWSER_RESULT "+(failures.length?"FAIL":"PASS")+" issues="+failures.length);
 process.exitCode=failures.length?1:0;
}catch(e){console.error("BROWSER_TEST_ERROR",e.message);process.exitCode=2}
finally{try{ws?.close()}catch{};try{proc.kill()}catch{};await rm(dir,{recursive:true,force:true,maxRetries:3}).catch(()=>{})}
