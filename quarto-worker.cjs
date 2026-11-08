"use strict";
/* Isolated renderer v2: input must be authenticated and sanitized upstream.
   No network, database, or user credentials should be mounted in this container. */
const http=require("node:http"),crypto=require("node:crypto"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),{spawn}=require("node:child_process"),JSZip=require("jszip");
const PORT=Number(process.env.PORT||3000),key=process.env.WORKER_KEY,QUARTO=process.env.QUARTO_BIN||"/opt/quarto/bin/quarto",MAX_BYTES=14500000,VERSION=2;
if(!key||key.length<32)throw Error("WORKER_KEY missing");
const papers={
 a3:[297,420,"a3"],a4:[210,297,"a4"],a5:[148,210,"a5"],a6:[105,148,"a6"],
 b4:[250,353,"iso-b4"],b5:[176,250,"iso-b5"],b6:[125,176,"iso-b6"],"jis-b5":[182,257,"jis-b5"],
 letter:[215.9,279.4,"us-letter"],legal:[215.9,355.6,"us-legal"],
 "trade-6x9":[152.4,228.6,"a4"],"id-14x21":[140,210,"a4"],"id-15x23":[150,230,"a4"]
};
let busy=false;
function safe(s,max=200000){
 if(typeof s!=="string"||s.length>max||/!\[[^\]]*\]\((?!asset:[a-z0-9]{6,100}\))[^)]*\)|<[^>]*>|https?:\/\/|file:\/|data:|\\include|\\input|^\s*`{3}[(\{]|^\s*{{[<%]/im.test(s))throw Error("Unsupported manuscript content");
 return s;
}
const yaml=s=>JSON.stringify(s);
const sizeTwips=mm=>Math.round(mm*1440/25.4);
async function run(args,cwd){
 return new Promise((resolve,reject)=>{
  const env=process.platform==="win32"?{...process.env,QUARTO_DISABLE_TELEMETRY:"true"}:{PATH:"/opt/quarto/bin:/usr/local/bin:/usr/bin:/bin",HOME:"/tmp",TMPDIR:"/tmp",QUARTO_DISABLE_TELEMETRY:"true",TZ:"Asia/Jakarta"};
  const child=spawn(QUARTO,args,{cwd,env,stdio:["ignore","ignore","pipe"]});let errors="";
  child.stderr.on("data",c=>{errors=(errors+c.toString()).slice(-1500)});
  const timer=setTimeout(()=>child.kill("SIGKILL"),90000);
  child.on("error",e=>{clearTimeout(timer);reject(e)});
  child.on("close",code=>{clearTimeout(timer);code===0?resolve():reject(Error("Quarto error "+code+" "+errors.slice(-200)))});
 });
}
async function patchDocx(data,paper){
 const zip=await JSZip.loadAsync(data);const entry=zip.file("word/document.xml");if(!entry)throw Error("DOCX body missing");
 const width=sizeTwips(paper[0]),height=sizeTwips(paper[1]),pg='<w:pgSz w:w="'+width+'" w:h="'+height+'"/>';
 const margin=paper[0]<=125?11:paper[0]<=182?14:20,m=sizeTwips(margin);
 const pgMar='<w:pgMar w:top="'+m+'" w:right="'+m+'" w:bottom="'+m+'" w:left="'+m+'" w:header="'+Math.round(m/2)+'" w:footer="'+Math.round(m/2)+'" w:gutter="0"/>';
 let count=0,xml=(await entry.async("string")).replace(/<w:pgSz\b[^>]*\/?\s*>/g,()=>{count++;return pg});
 if(!count)xml=xml.replace(/<w:sectPr(?=[\s>])([^>]*)>/g,(_m,a)=>{count++;return "<w:sectPr"+a+">"+pg});
 if(!count)throw Error("DOCX section size missing");xml=xml.replace(/<w:pgMar\b[^>]*\/?\s*>/g,pgMar);if(!xml.includes("<w:pgMar "))xml=xml.replace(pg,pg+pgMar);zip.file("word/document.xml",xml);
 return Buffer.from(await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
}
async function render(book,format){
 if(!["pdf","docx","epub"].includes(format))throw Error("Invalid format");
 if(!book||typeof book!=="object"||!Array.isArray(book.chapters)||book.chapters.length<1||book.chapters.length>200)throw Error("Invalid chapter count");
 const title=safe(book.title,250),subject=safe(book.subject,200),author=safe(book.author||"BC Book Studio",180);
 const size=(book.pageSize||"a4").toLowerCase(),paper=papers[size];if(!paper)throw Error("Unsupported physical page size");
 const publishingLayout=book.publishingLayout===true;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"bcbook-worker-"));
 try{
  const files=new Map(),assets=Array.isArray(book.assets)?book.assets:[];
  if(assets.length>20)throw Error("Too many images");
  await fs.mkdir(path.join(root,"images"));
  for(const asset of assets){
   if(!asset||!/^[a-z0-9]{6,100}$/.test(asset.id)||files.has(asset.id)||!["image/png","image/jpeg"].includes(asset.mime)||typeof asset.data!=="string")throw Error("Invalid image metadata");
   const raw=Buffer.from(asset.data,"base64");
   if(raw.length<16||raw.length>550000)throw Error("Invalid image size");
   const png=asset.mime==="image/png";
   if(png&&!raw.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))throw Error("Invalid PNG");
   if(!png&&(raw[0]!==255||raw[1]!==216||raw[2]!==255))throw Error("Invalid JPEG");
   const filename=asset.id+(png?".png":".jpg");
   await fs.writeFile(path.join(root,"images",filename),raw,{flag:"wx"});files.set(asset.id,filename);
  }
  const content=x=>safe(x).replace(/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)/g,(_all,alt,id)=>{
   const file=files.get(id);if(!file)throw Error("Referenced asset unavailable");
   return "!["+safe(alt,200)+"](images/"+file+")";
  });
  const titleOf=x=>safe(x,180).replace(/[\r\n#]/g," ").trim();
  const margin=paper[0]<=125?11:paper[0]<=182?14:20;
  const customLines=["    include-before-body:","      text: |","        #set page(width: "+paper[0]+"mm, height: "+paper[1]+"mm, margin: "+margin+"mm)","        #set text(size: "+(paper[0]<=125?"9":"10.5")+"pt)",...(publishingLayout?["        #set page(numbering: none)"]:[])];
  if(publishingLayout&&(format==="pdf"||format==="docx")){
   const front=["---","lang: id","execute:","  enabled: false","toc: false","number-sections: false","format:","  typst:","    papersize: "+paper[2],...customLines,"  docx:","    toc: false","---",""];
   const parts=book.chapters.flatMap((c,i)=>[...(i?["{{< pagebreak >}}",""]:[]),"# "+titleOf(c.title)+" {.unnumbered}","",content(c.content),""]);
   await fs.writeFile(path.join(root,"publishing.qmd"),[...front,...parts].join("\n"));
   await run(["render","publishing.qmd","--to",format==="pdf"?"typst":"docx"],root);
   let bytes=await fs.readFile(path.join(root,"publishing."+(format==="pdf"?"pdf":"docx")));
   if(format==="docx")bytes=await patchDocx(bytes,paper);
   return check(bytes,format);
  }
  if(format==="pdf"){
   const front=["---","title: "+yaml(title),"subtitle: "+yaml(subject),"author: "+yaml(author),"lang: id","execute:","  enabled: false","format:","  typst:","    papersize: "+paper[2],...customLines,"---",""];
   const parts=book.chapters.flatMap((c,i)=>[...(i?["{{< pagebreak >}}",""]:[]),"# "+titleOf(c.title),"",content(c.content),""]);
   await fs.writeFile(path.join(root,"manuscript.qmd"),[...front,...parts].join("\n"));
   await run(["render","manuscript.qmd","--to","typst"],root);
   return check(await fs.readFile(path.join(root,"manuscript.pdf")),"pdf");
  }
  const list=publishingLayout?book.chapters.slice(1):book.chapters;
  const chapters=list.map((_,i)=>"chapter-"+String(i+1).padStart(3,"0")+".qmd");
  const lines=["project:","  type: book","  output-dir: _book","lang: id","execute:","  enabled: false",
   ...(publishingLayout?["epub-title-page: false"]:[]),
   "book:","  title: "+yaml(title),"  subtitle: "+yaml(subject),"  author: "+yaml(author),
   "  output-file: manuscript","  chapters:","    - index.qmd",...chapters.map(x=>"    - "+x),
   "format:","  docx:","    toc: "+(publishingLayout?"false":"true"),
   "  epub:","    toc: "+(publishingLayout?"false":"true"),"    epub-title-page: "+(publishingLayout?"false":"true"),
   "    number-sections: "+(publishingLayout?"false":"true"),
   "  typst:","    papersize: "+paper[2]];
  await fs.writeFile(path.join(root,"_quarto.yml"),lines.join("\n")+"\n");
  await fs.writeFile(path.join(root,"index.qmd"),publishingLayout?"# "+titleOf(book.chapters[0].title)+" {.unnumbered}\n\n"+content(book.chapters[0].content)+"\n":"# Pengantar {.unnumbered}\n\n"+subject+"\n");
  for(let i=0;i<chapters.length;i++){const c=list[i];await fs.writeFile(path.join(root,chapters[i]),(i?"{{< pagebreak >}}\n\n":"")+"# "+titleOf(c.title)+"\n\n"+content(c.content)+"\n")}
  await run(["render","--to",format],root);
  let output=await fs.readFile(path.join(root,"_book","manuscript."+format));
  if(format==="docx")output=await patchDocx(output,paper);
  if(publishingLayout&&format==="epub"){
   const zip=await JSZip.loadAsync(output),opf=Object.keys(zip.files).find(x=>x.endsWith(".opf"));
   if(!opf)throw Error("OPF missing");
   const metadata=await zip.file(opf).async("string");
   const entry=metadata.match(/<itemref\b(?=[^>]*idref="title_page_xhtml")[^>]*\/>/);
   if(entry){zip.file(opf,metadata.replace(entry[0],"").replace("</spine>",'<itemref idref="title_page_xhtml" linear="no" /></spine>'));zip.file("mimetype","application/epub+zip",{compression:"STORE"});output=Buffer.from(await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}))}
  }
  return check(output,format);
 }finally{await fs.rm(root,{recursive:true,force:true})}
}
function check(bytes,format){
 if(bytes.length<500||bytes.length>20000000)throw Error("Invalid output size");
 if(format==="pdf"&&bytes.subarray(0,4).toString()!=="%PDF")throw Error("Invalid PDF");
 if(format!=="pdf"&&bytes.subarray(0,2).toString()!=="PK")throw Error("Invalid archive");
 return bytes;
}
const server=http.createServer((req,res)=>{
 const done=(status,msg)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify({error:msg}))};
 if(req.method==="GET"&&req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({status:"ok",contractVersion:VERSION}))}
 if(req.method==="GET"&&req.url==="/capabilities"){
  if(req.headers["x-worker-key"]!==key)return done(401,"Unauthorized");
  res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
  return res.end(JSON.stringify({contractVersion:VERSION,publishingLayout:true,paperSizes:Object.keys(papers),formats:["pdf","docx","epub"],epubReflowable:true}));
 }
 if(req.method!=="POST"||req.url!=="/render")return done(404,"Not found");
 const supplied=req.headers["x-worker-key"];
 if(typeof supplied!=="string"||!crypto.timingSafeEqual(crypto.createHash("sha256").update(supplied).digest(),crypto.createHash("sha256").update(key).digest()))return done(401,"Unauthorized");
 if(busy)return done(429,"Worker busy");
 let body="",exceeded=false;
 req.on("data",c=>{body+=c.toString();if(body.length>MAX_BYTES){exceeded=true;req.destroy()}});
 req.on("end",async()=>{
  if(exceeded)return;busy=true;
  try{
   const input=JSON.parse(body);
   if(input.contractVersion!==VERSION)throw Error("Unsupported worker contract");
   const data=await render(input.book,input.format);
   res.writeHead(200,{"content-type":input.format==="pdf"?"application/pdf":input.format==="epub"?"application/epub+zip":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","content-length":data.length,"cache-control":"no-store","x-renderer":"Quarto-worker-v2"});res.end(data);
  }catch(e){console.error("RENDER_ERROR",e instanceof Error?e.message.slice(0,500):"unknown");done(422,e instanceof Error?e.message.slice(0,150):"Render failed")}
  finally{busy=false}
 });
});
server.headersTimeout=10000;server.requestTimeout=15000;
server.listen(PORT,process.env.WORKER_HOST||"127.0.0.1",()=>console.log("Quarto isolated worker v2 ready"));
