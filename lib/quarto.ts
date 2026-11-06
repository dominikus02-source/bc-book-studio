import { mkdtemp,writeFile,readFile,readdir,rm } from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";
import JSZip from "jszip";
type Source={id:string;title:string;grade:string;subject:string;bookType?:string;genre?:string;pageSize?:string;author?:string;chapters:Array<{title:string;content:string}>;assets?:Array<{id:string;mime:string;data:string;altText:string}>};
type Format="pdf"|"epub"|"docx";
const yaml=(v:string)=>JSON.stringify(v);
function safeMarkdown(v:string) {
 if (v.length>250000||/\{\{[<%]|<script|!\[[^\]]*\]\((?:https?:|file:|\/)/i.test(v)) throw Error("Unsafe or unsupported embedded resources in manuscript");
 return v;
}
function run(command:string,args:string[],cwd:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:{...process.env,QUARTO_DISABLE_TELEMETRY:"true"},stdio:["ignore","pipe","pipe"]});
  let stderr="",stdout="";
  child.stderr.on("data",b=>{stderr=(stderr+b.toString()).slice(-3000)});
  child.stdout.on("data",b=>{stdout=(stdout+b.toString()).slice(-1000)});
  const timeout=setTimeout(()=>child.kill("SIGKILL"),90000);
  child.on("error",e=>{clearTimeout(timeout);reject(e)});
  child.on("close",code=>{clearTimeout(timeout);code===0?resolve():reject(Error("Quarto failed: "+stderr.slice(-300)))});
 });
}
export async function quartoExport(book:Source,format:Format):Promise<Uint8Array>{
 if(!process.env.QUARTO_BIN&&!process.env.QUARTO_WORKER_URL)throw Error("Quarto binary/worker not configured");
 if(process.env.QUARTO_WORKER_URL){
  const url=new URL(process.env.QUARTO_WORKER_URL);
  if(url.protocol!=="http:"||!(url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname.endsWith(".internal")))throw Error("Worker must use restricted private endpoint");
  const secret=process.env.QUARTO_WORKER_TOKEN;
  if(!secret||secret.length<32)throw Error("Worker authentication not configured");
  const control=new AbortController();
  const timeout=setTimeout(()=>control.abort(),100000);
  try{
   const body=JSON.stringify({book:{title:book.title,subject:book.subject,pageSize:book.pageSize,bookType:book.bookType,genre:book.genre,author:book.author,chapters:book.chapters.map(x=>({title:x.title,content:x.content})),assets:book.assets||[]},format});
   if(body.length>14500000)throw Error("Manuscript exceeds worker capacity");
   const response=await fetch(url.toString(),{method:"POST",headers:{"content-type":"application/json","x-worker-key":secret},body,signal:control.signal,cache:"no-store"});
   if(!response.ok)throw Error("Worker render rejected "+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length<500||bytes.length>20000000)throw Error("Worker output exceeds allowed size");
   if(format==="pdf"&&!bytes.subarray(0,4).equals(Buffer.from("%PDF")))throw Error("Worker PDF invalid");
   if(format!=="pdf"){
    const zip=await JSZip.loadAsync(bytes);
    if(format==="docx"&&!zip.file("word/document.xml"))throw Error("Worker DOCX invalid");
    if(format==="epub"&&(!zip.file("mimetype")||!zip.file("META-INF/container.xml")))throw Error("Worker EPUB invalid");
   }
   return new Uint8Array(bytes);
  }finally{clearTimeout(timeout)}
 }

 if(!book.chapters.length||book.chapters.length>200)throw Error("Invalid chapter count");
 if(book.assets?.length&&!process.env.QUARTO_WORKER_URL)throw Error("Images require isolated Quarto worker");
 const root=await mkdtemp(join(tmpdir(),"bcbook-quarto-"));
 try{
  const paths=book.chapters.map((_,i)=>"chapter-"+String(i+1).padStart(3,"0")+".qmd");
  const yml=[
   "project:","  type: book","  output-dir: _book","execute:","  enabled: false",
   "book:","  title: "+yaml(book.title),"  subtitle: "+yaml(book.subject),
   "  output-file: manuscript","  chapters:","    - index.qmd",
   ...paths.map(f=>"    - "+f),
   "format:","  docx:","    toc: true","    number-sections: true",
   "  epub:","    toc: true","    number-sections: true",
   "  typst:","    toc: true","    number-sections: true","    papersize: a5"
  ].join("\n")+"\n";
  await writeFile(join(root,"_quarto.yml"),yml,"utf8");
  await writeFile(join(root,"index.qmd"),"# Pengantar {.unnumbered}\n\n"+safeMarkdown(book.subject)+"\n","utf8");
  for(let i=0;i<paths.length;i++){
   const c=book.chapters[i];
   await writeFile(join(root,paths[i]),"# "+c.title.replace(/[\r\n#]/g," ").trim()+"\n\n"+safeMarkdown(c.content)+"\n","utf8");
  }
  await run(process.env.QUARTO_BIN!,["render","--to",format==="pdf"?"typst":format],root);
  const ext=format==="pdf"?"pdf":format;
  const files=await readdir(join(root,"_book"));
  const filename=files.find(f=>f==="manuscript."+ext)||files.find(f=>f.endsWith("."+ext));
  if(!filename)throw Error("Quarto output missing");
  const output=await readFile(join(root,"_book",filename));
  if(output.length<200||output.length>80000000)throw Error("Output size invalid");
  if(format==="pdf"&&!output.subarray(0,4).equals(Buffer.from("%PDF")))throw Error("Invalid PDF header");
  if(format==="epub"||format==="docx"){
   const zip=await JSZip.loadAsync(output);
   if(format==="epub"&&(!zip.file("mimetype")||!zip.file("META-INF/container.xml")))throw Error("Invalid EPUB package");
   if(format==="docx"&&!zip.file("word/document.xml"))throw Error("Invalid DOCX package");
  }
  return new Uint8Array(output);
 }finally{await rm(root,{recursive:true,force:true})}
}
