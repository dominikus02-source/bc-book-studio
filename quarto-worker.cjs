"use strict";
const http=require("node:http"),crypto=require("node:crypto"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),{spawn}=require("node:child_process");
const PORT=Number(process.env.PORT||3000),key=process.env.WORKER_KEY,QUARTO="/opt/quarto/bin/quarto",MAX_BYTES=14500000;
if(!key||key.length<32)throw Error("WORKER_KEY missing");
let busy=false;
function safe(s,max=200000){
 if(typeof s!=="string"||s.length>max||/!\[[^\]]*\]\((?!asset:[a-z0-9]{6,100}\))[^)]*\)|<[^>]*>|https?:\/\/|file:\/|data:|\\include|\\input|^\s*\x60{3}[(\{]|^\s*{{[<%]/im.test(s))throw Error("Unsupported manuscript content");
 return s;
}
const yaml=s=>JSON.stringify(s);
async function spawnRender(args,cwd){
 return new Promise((resolve,reject)=>{
  const env={PATH:"/opt/quarto/bin:/usr/local/bin:/usr/bin:/bin",HOME:"/tmp",TMPDIR:"/tmp",QUARTO_DISABLE_TELEMETRY:"true",TZ:"Asia/Jakarta"};
  const child=spawn(QUARTO,args,{cwd,env,stdio:["ignore","ignore","pipe"]});let errors="";
  child.stderr.on("data",c=>{errors=(errors+c.toString()).slice(-1500)});
  const timer=setTimeout(()=>child.kill("SIGKILL"),70000);
  child.on("error",e=>{clearTimeout(timer);reject(e)});
  child.on("close",code=>{clearTimeout(timer);code===0?resolve():reject(Error("Render error "+code+" "+errors.slice(-200)))});
 });
}
async function render(book,fmt){
 if(!["docx","epub","pdf"].includes(fmt))throw Error("Invalid format");
 if(!book||typeof book!=="object"||!Array.isArray(book.chapters)||book.chapters.length<1||book.chapters.length>40)throw Error("Invalid book");
 const title=safe(book.title,250),subject=safe(book.subject,200);
 const pageMap={A4:"a4",A5:"a5",B5:"iso-b5"};
 const paper=pageMap[book.pageSize]||(book.bookType==="FICTION"?"a5":book.genre==="TEXTBOOK"?"iso-b5":"a4");
 const author=safe(book.author||"BC Book Studio",180);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"qa-quarto-"));
 try{
  const files=new Map();
  const assets=Array.isArray(book.assets)?book.assets:[];
  if(assets.length>20)throw Error("Too many images");
  await fs.mkdir(path.join(root,"assets"));
  for(const asset of assets){
   if(!asset||!/^[a-z0-9]{6,100}$/.test(asset.id)||!["image/png","image/jpeg"].includes(asset.mime)||typeof asset.data!=="string")throw Error("Invalid image metadata");
   const raw=Buffer.from(asset.data,"base64");
   if(raw.length<32||raw.length>550000)throw Error("Image outside size limits");
   const png=asset.mime==="image/png";
   if(png&&!raw.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))throw Error("Invalid image header");
   if(!png&&(raw[0]!==255||raw[1]!==216))throw Error("Invalid image header");
   const filename=asset.id+(png?".png":".jpg");
   await fs.writeFile(path.join(root,"assets",filename),raw,{flag:"wx"});
   files.set(asset.id,filename);
  }
  function prepare(content){
   return safe(content).replace(/!\[([^\]]*)\]\(asset:([a-z0-9]{6,100})\)/g,(_,alt,id)=>{
    const filename=files.get(id);if(!filename)throw Error("Missing image asset");
    return "!["+safe(alt,200)+"](assets/"+filename+")";
   });
  }
  const tpl=await fs.readFile("/opt/quarto/share/extension-subtrees/orange-book/_extensions/orange-book/typst-show.typ","utf8");
  if(!tpl.includes("#show: book.with("))throw Error("Unsupported Quarto orange-book partial");
  await fs.writeFile(path.join(root,"typst-show.typ"),tpl.replace("#show: book.with(","#show: book.with(\n  paper-size: "+JSON.stringify(paper)+","));
  const chapters=book.chapters.map((_,i)=>"chapter-"+String(i+1).padStart(3,"0")+".qmd");
  const lines=["project:","  type: book","  output-dir: _book","execute:","  enabled: false","book:","  title: "+yaml(title),"  subtitle: "+yaml(subject),"  author: "+yaml(author),"  output-file: manuscript","  chapters:","    - index.qmd",...chapters.map(p=>"    - "+p),"format:","  docx:","    toc: true","  epub:","    toc: true","  typst:","    toc: true","    papersize: "+paper,"    template-partials:","      - typst-show.typ"];
  await fs.writeFile(path.join(root,"_quarto.yml"),lines.join("\n")+"\n");
  await fs.writeFile(path.join(root,"index.qmd"),"# Pengantar {.unnumbered}\n\n"+subject+"\n");
  for(let i=0;i<chapters.length;i++){
   const ch=book.chapters[i];
   await fs.writeFile(path.join(root,chapters[i]),"# "+safe(ch.title,180).replace(/[\r\n#]/g," ")+"\n\n"+prepare(ch.content)+"\n");
  }
  await spawnRender(["render","--to",fmt==="pdf"?"typst":fmt],root);
  const output=await fs.readFile(path.join(root,"_book","manuscript."+fmt));
  if(output.length>20000000||output.length<500)throw Error("Invalid output size");
  if(fmt==="pdf"&&output.subarray(0,4).toString()!=="%PDF")throw Error("Invalid PDF header");
  if(fmt!=="pdf"&&output.subarray(0,2).toString()!=="PK")throw Error("Invalid ZIP header");
  return output;
 }finally{await fs.rm(root,{recursive:true,force:true})}
}
const server=http.createServer((req,res)=>{
 const done=(status,msg)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify({error:msg}))};
 if(req.method==="GET"&&req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end('{"status":"ok"}')}
 if(req.method!=="POST"||req.url!=="/render")return done(404,"Not found");
 const supplied=req.headers["x-worker-key"];
 if(typeof supplied!=="string"||!crypto.timingSafeEqual(Buffer.from(crypto.createHash("sha256").update(supplied).digest()),Buffer.from(crypto.createHash("sha256").update(key).digest())))return done(401,"Unauthorized");
 if(busy)return done(429,"Worker busy");
 let body="",exceeded=false;
 req.on("data",c=>{body+=c.toString();if(body.length>MAX_BYTES){exceeded=true;req.destroy()}});
 req.on("end",async()=>{
  if(exceeded)return;
  busy=true;
  try{
   const {book,format}=JSON.parse(body);
   const b=await render(book,format);
   res.writeHead(200,{"content-type":format==="pdf"?"application/pdf":format==="epub"?"application/epub+zip":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","content-length":b.length,"cache-control":"no-store","x-renderer":"Quarto-worker"});res.end(b);
  }catch(e){console.error("QA_RENDER_ERROR",e instanceof Error?e.message.slice(0,500):"unknown");done(422,e instanceof Error?e.message.slice(0,150):"Render failed")}
  finally{busy=false}
 });
});
server.headersTimeout=10000;server.requestTimeout=15000;
server.listen(PORT,"0.0.0.0",()=>console.log("Quarto QA worker listening"));
