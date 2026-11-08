import { mkdtemp,writeFile,readFile,readdir,rm } from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";
import JSZip from "jszip";
import {paperSpec,mmToTwips} from "./paper-sizes";
type Source={publishingLayout?:boolean;id:string;title:string;grade:string;subject:string;bookType?:string;genre?:string;pageSize?:string;author?:string;chapters:Array<{title:string;content:string}>;assets?:Array<{id:string;mime:string;data:string;altText:string}>};
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
/** Apply true physical section sizes in DOCX, not only the visual preview. */
async function sizeDocx(data:Uint8Array,sizeId:string):Promise<Uint8Array>{
 const spec=paperSpec(sizeId);if(!spec)throw Error("Unsupported paper size");
 const zip=await JSZip.loadAsync(data);
 const file=zip.file("word/document.xml");if(!file)throw Error("DOCX body missing");
 const original=await file.async("string");
 const pgSz='<w:pgSz w:w="'+mmToTwips(spec.widthMm)+'" w:h="'+mmToTwips(spec.heightMm)+'"/>';
 const margin=spec.widthMm<=125?11:spec.widthMm<=182?14:20;
 const mar=mmToTwips(margin);const pgMar='<w:pgMar w:top="'+mar+'" w:right="'+mar+'" w:bottom="'+mar+'" w:left="'+mar+'" w:header="'+Math.round(mar/2)+'" w:footer="'+Math.round(mar/2)+'" w:gutter="0"/>';
 let replaced=0;
 let xml=original.replace(/<w:pgSz\b[^>]*\/?\s*>/g,()=>{replaced++;return pgSz});
 if(!replaced){
  xml=xml.replace(/<w:sectPr(?=[\s>])([^>]*)>/g,(_m,attrs)=>{replaced++;return "<w:sectPr"+attrs+">"+pgSz});
 }
 if(!replaced)throw Error("DOCX section geometry missing");
 xml=xml.replace(/<w:pgMar\b[^>]*\/?\s*>/g,pgMar);
 if(!xml.includes("<w:pgMar "))xml=xml.replace(pgSz,pgSz+pgMar);
 zip.file("word/document.xml",xml);
 return new Uint8Array(await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
}
function typstPaper(spec:{typst?:string;widthMm:number;heightMm:number}){
 return spec.typst||"a4";
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
   const capUrl=new URL(url); capUrl.pathname="/capabilities";
   const capResp=await fetch(capUrl.toString(),{headers:{"x-worker-key":secret},signal:control.signal,cache:"no-store"});
   if(!capResp.ok)throw Error("Quarto Worker capabilities unavailable");
   const contract=await capResp.json();
   if(contract.contractVersion!==2||contract.publishingLayout!==true||!contract.formats?.includes(format)||!contract.paperSizes?.includes((book.pageSize||"a4").toLowerCase()))throw Error("Quarto Worker v2 contract mismatch; publication export held");
   const body=JSON.stringify({contractVersion:2,book:{title:book.title,subject:book.subject,pageSize:book.pageSize,bookType:book.bookType,genre:book.genre,author:book.author,publishingLayout:book.publishingLayout===true,chapters:book.chapters.map(x=>({title:x.title,content:x.content})),assets:book.assets||[]},format});
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
 if(book.assets?.length&&process.env.NODE_ENV!=="development"&&process.env.QUARTO_ISOLATED_WORKER!=="1")throw Error("Images require isolated Quarto worker");
 const root=await mkdtemp(join(tmpdir(),"bcbook-quarto-"));
 try{
  // Dev-only local renderer. Production must use an isolated authenticated worker.
  const assets=new Map<string,string>();
  if(book.assets?.length){
   if(book.assets.length>20)throw Error("Too many images");
   const {mkdir}=await import("node:fs/promises");
   await mkdir(join(root,"images"),{recursive:true});
   for(const asset of book.assets){
    if(!/^[a-z0-9]{6,100}$/.test(asset.id)||assets.has(asset.id))throw Error("Invalid image ID");
    if(asset.mime!=="image/png"&&asset.mime!=="image/jpeg")throw Error("Unsupported image MIME");
    const data=Buffer.from(asset.data,"base64");
    if(data.length<16||data.length>550000)throw Error("Invalid image size");
    const png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg=data[0]===255&&data[1]===216&&data[2]===255;
    if(asset.mime==="image/png"&&!png||asset.mime==="image/jpeg"&&!jpg)throw Error("Image signature mismatch");
    const filename="images/"+asset.id+(png?".png":".jpg");
    await writeFile(join(root,filename),data);
    assets.set(asset.id,filename);
   }
  }
  const resolveAssets=(markdown:string)=>safeMarkdown(markdown).replace(/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)/g,(_all,alt,id)=>{
   const filename=assets.get(id);if(!filename)throw Error("Referenced image unavailable: "+id);
   return "!["+alt+"]("+filename+")";
  });
  // A publishing package uses one Quarto source: no auto-generated title/TOC before its cover.
  if(book.publishingLayout&&(format==="pdf"||format==="docx")){
   const spec=paperSpec(book.pageSize||"a4");if(!spec)throw Error("Unsupported paper size");
   const paper=typstPaper(spec);
   const margin=spec.widthMm<=125?11:spec.widthMm<=182?14:20;
   const paperRule="#set page(width: "+spec.widthMm+"mm, height: "+spec.heightMm+"mm, margin: "+margin+"mm)";
   const fontRule=spec.widthMm<=125?"#set text(size: 9pt)":"#set text(size: 10.5pt)";
   const front=["---","lang: id","execute:","  enabled: false","toc: false","number-sections: false","format:","  typst:","    papersize: "+paper,"    include-before-body:","      text: |","        "+paperRule,"        "+fontRule,"        #set page(numbering: none)","  docx:","    toc: false","---",""];
   const parts=book.chapters.flatMap((ch,i)=>[...(i?["{{< pagebreak >}}",""]:[]),"# "+ch.title.replace(/[\r\n#]/g," ").trim()+" {.unnumbered}","",resolveAssets(ch.content),""]);
   await writeFile(join(root,"publishing-manuscript.qmd"),[...front,...parts].join("\n"),"utf8");
   // Quarto injects these Typst rules before content; standard and custom dimensions both reflow.

   await run(process.env.QUARTO_BIN!,["render","publishing-manuscript.qmd","--to",format==="pdf"?"typst":"docx"],root);
   const bytes=await readFile(join(root,"publishing-manuscript."+(format==="pdf"?"pdf":"docx")));
   if(bytes.length<500||bytes.length>80000000)throw Error("Invalid publishing package size");
   if(format==="pdf"&&!bytes.subarray(0,4).equals(Buffer.from("%PDF")))throw Error("Invalid PDF package");
   if(format==="docx"&&!(await JSZip.loadAsync(bytes)).file("word/document.xml"))throw Error("Invalid DOCX package");
   return format==="docx"?sizeDocx(bytes,book.pageSize||"a4"):new Uint8Array(bytes);
  }
   if(format==="pdf"){
   const spec=paperSpec(book.pageSize||"a4");if(!spec)throw Error("Unsupported paper size");
   const paper=typstPaper(spec);
   const margin=spec.widthMm<=125?11:spec.widthMm<=182?14:20;
   const front=["---","title: "+yaml(book.title),"subtitle: "+yaml(book.subject),"author: "+yaml(book.author||"BC Book Studio"),"lang: id","execute:","  enabled: false","toc: true","number-sections: true","format:","  typst:","    papersize: "+paper,"    include-before-body:","      text: |","        #set page(width: "+spec.widthMm+"mm, height: "+spec.heightMm+"mm, margin: "+margin+"mm)","        #set text(size: "+(spec.widthMm<=125?"9":"10.5")+"pt)","---",""];
   if(!spec.typst){const i=front.lastIndexOf("---");front.splice(front.indexOf('  docx:'),0,'    include-before-body:','      text: |','        #set page(width: '+spec.widthMm+'mm, height: '+spec.heightMm+'mm)');}
   const content=book.chapters.flatMap((ch,i)=>[...(i?["{{< pagebreak >}}",""]:[]),"# "+ch.title.replace(/[\r\n#]/g," ").trim(),"",resolveAssets(ch.content),""]);
   await writeFile(join(root,"manuscript.qmd"),[...front,...content].join("\n"),"utf8");
   await run(process.env.QUARTO_BIN!,["render","manuscript.qmd","--to","typst"],root);
   const output=await readFile(join(root,"manuscript.pdf"));
   if(output.length<200||output.length>80000000||!output.subarray(0,4).equals(Buffer.from("%PDF")))throw Error("Invalid PDF output");
   return new Uint8Array(output);
  }
  const chapterFiles=book.publishingLayout?book.chapters.slice(1):book.chapters;
  const paths=chapterFiles.map((_,i)=>"chapter-"+String(i+1).padStart(3,"0")+".qmd");
  const yml=[
   "lang: id",
   "project:","  type: book","  output-dir: _book","execute:","  enabled: false",...(book.publishingLayout?["epub-title-page: false"]:[]),
   "book:","  title: "+yaml(book.title),"  subtitle: "+yaml(book.subject),"  author: "+yaml(book.author||"BC Book Studio"),
   "  output-file: manuscript","  chapters:","    - index.qmd",
   ...paths.map(f=>"    - "+f),
   "format:","  docx:","    toc: true","    number-sections: true",
   "  epub:","    toc: "+(book.publishingLayout?"false":"true"),"    epub-title-page: "+(book.publishingLayout?"false":"true"),"    number-sections: "+(book.publishingLayout?"false":"true"),
   "  typst:","    toc: true","    number-sections: true","    papersize: "+typstPaper(paperSpec(book.pageSize||"a4")||paperSpec("a4")!)
  ].join("\n")+"\n";
  await writeFile(join(root,"_quarto.yml"),yml,"utf8");
  await writeFile(join(root,"index.qmd"),book.publishingLayout?"# "+book.chapters[0].title.replace(/[\r\n#]/g," ").trim()+" {.unnumbered}\n\n"+resolveAssets(book.chapters[0].content)+"\n":"# Pengantar {.unnumbered}\n\n"+safeMarkdown(book.subject)+"\n","utf8");
  for(let i=0;i<paths.length;i++){
   const c=chapterFiles[i];
   await writeFile(join(root,paths[i]),(i?"{{< pagebreak >}}\n\n":"")+"# "+c.title.replace(/[\r\n#]/g," ").trim()+"\n\n"+resolveAssets(c.content)+"\n","utf8");
  }
  await run(process.env.QUARTO_BIN!,["render","--to",format],root);
  const ext=format;
  const files=await readdir(join(root,"_book"));
  const filename=files.find(f=>f==="manuscript."+ext)||files.find(f=>f.endsWith("."+ext));
  if(!filename)throw Error("Quarto output missing");
  const output=await readFile(join(root,"_book",filename));
  if(output.length<200||output.length>80000000)throw Error("Output size invalid");
  if(format==="epub"||format==="docx"){
   const zip=await JSZip.loadAsync(output);
   if(format==="epub"&&(!zip.file("mimetype")||!zip.file("META-INF/container.xml")))throw Error("Invalid EPUB package");
   if(format==="docx"&&!zip.file("word/document.xml"))throw Error("Invalid DOCX package");
  }
  if(book.publishingLayout&&format==="epub"){
   const zip=await JSZip.loadAsync(output);
   const opf=Object.keys(zip.files).find(name=>name.endsWith(".opf"));
   if(!opf)throw Error("EPUB package metadata missing");
   const source=await zip.file(opf)!.async("string");
   const item=source.match(/<itemref\b(?=[^>]*idref="title_page_xhtml")[^>]*\/>/);
   if(item){
    const patched=source.replace(item[0],"").replace("</spine>",'  <itemref idref="title_page_xhtml" linear="no" />\n  </spine>');
    zip.file(opf,patched);
    const mime=zip.file("mimetype");if(mime)zip.file("mimetype",await mime.async("string"),{compression:"STORE"});
    return new Uint8Array(await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
   }
  }
  return format==="docx"?sizeDocx(output,book.pageSize||"a4"):new Uint8Array(output);
 }finally{await rm(root,{recursive:true,force:true})}
}
