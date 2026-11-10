"use strict";
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),{spawn}=require("child_process"),JSZip=require("jszip"),{PDFDocument}=require("pdf-lib"),ts=require("typescript");
const base=path.resolve(__dirname,"..");process.loadEnvFile(path.join(base,".env.local"));
require.extensions[".ts"]=function(mod,filename){const r=ts.transpileModule(fs.readFileSync(filename,"utf8"),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});mod._compile(r.outputText,filename)};
const {quartoExport}=require(path.join(base,"lib","quarto.ts"));
(async()=>{
 const token=crypto.randomBytes(40).toString("hex"),port=39267;
 const child=spawn(process.execPath,["scripts/quarto-worker-server.cjs"],{cwd:base,env:{...process.env,NODE_ENV:"development",QUARTO_WORKER_TOKEN:token,QUARTO_WORKER_PORT:String(port),QUARTO_WORKER_BIND:"127.0.0.1"},stdio:["ignore","pipe","pipe"]});
 let stderr="";child.stderr.on("data",x=>stderr+=x.toString());
 const url="http://127.0.0.1:"+port+"/";
 try{
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch(url+"capabilities",{headers:{"x-worker-key":token}});if(r.ok){const cap=await r.json();assert.equal(cap.contractVersion,2);assert(cap.paperSizes.includes("id-14x21"));ready=true;break}}catch{}await new Promise(ok=>setTimeout(ok,150))}
  assert(ready,"worker startup: "+stderr);
  const unauthorized=await fetch(url+"capabilities");assert.equal(unauthorized.status,401);
  const invalid=await fetch(url,{method:"POST",headers:{"x-worker-key":token,"content-type":"application/json"},body:JSON.stringify({contractVersion:1})});assert.equal(invalid.status,400);
  process.env.QUARTO_WORKER_URL=url;process.env.QUARTO_WORKER_TOKEN=token;
  const source={id:"mock",title:"Validasi Buku",subject:"Fisika",grade:"7",pageSize:"id-14x21",publishingLayout:true,chapters:[{title:"Sampul depan",content:"Buku validasi penerbitan - draf."},{title:"Bab Satu",content:"## Pendahuluan\n\nIsi bab yang menjelaskan sains untuk peserta didik."}],assets:[]};
  const pdf=await quartoExport(source,"pdf");
  const document=await PDFDocument.load(pdf);const p=document.getPage(0).getSize();assert(Math.abs(p.width-140*72/25.4)<1);assert(Math.abs(p.height-210*72/25.4)<1);
  const word=await quartoExport(source,"docx");const zip=await JSZip.loadAsync(word),xml=await zip.file("word/document.xml").async("string");assert(xml.includes('w:w="7937"'));assert(xml.includes('w:h="11906"'));
  console.log("QUARTO_V2_CONTRACT_PASS", "unauthorized=401", "schema_mismatch=400", "PDF="+p.width.toFixed(2)+"x"+p.height.toFixed(2),"DOCX=7937x11906");
 }finally{delete process.env.QUARTO_WORKER_URL;child.kill();await new Promise(ok=>{if(child.exitCode!==null)return ok();child.on("exit",ok);setTimeout(ok,2000)})}
})().catch(e=>{console.error("QUARTO_V2_CONTRACT_FAIL",e.stack);process.exitCode=1});
