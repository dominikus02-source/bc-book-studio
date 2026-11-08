"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{spawnSync}=require("node:child_process"),{createHash}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),JSZip=require("jszip");
const root=path.resolve("artifacts/20261108-two-book-draft-previews");
const ids=["cmw6gk5gu005wurcoe0dk02jr","cmw7ad8q20000urfofr6mioge"];
const db=new PrismaClient();
const {covers,markdownParts}=require("./book-front-back.cjs");
const {PDFDocument}=require("pdf-lib");
function esc(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function slug(x){return String(x).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55)}
function run(file,args,cwd,timeout=120000){const r=spawnSync(file,args,{cwd,encoding:"utf8",timeout,maxBuffer:250000,windowsHide:true});return {exit:r.status,stdout:(r.stdout||"").slice(-1500),stderr:(r.stderr||"").slice(-1500),error:r.error?.message}}
function cleanMarkdown(x){return String(x).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,"").replace(/!\[[^\]]*\]\((?:https?:|file:)[^)]*\)/gi,"[Gambar eksternal memerlukan verifikasi hak penggunaan]")}
function flipbook(book,chapters,assetMap,frontParts,backParts){
 const allSections=[
 ...frontParts.map(p=>({title:p.title,content:p.content})),
 {title:"Daftar Isi",content:chapters.map((c,i)=>String(i+1)+". "+c.title).join("\n\n")},
 ...chapters.map(c=>({title:c.title,content:c.content.replace(/^#\s+[^\n]+\r?\n/,"")})),
 ...backParts.map(p=>({title:p.title,content:p.content}))
 ];
 const pages=allSections.map((c,i)=>({title:c.title,body:cleanMarkdown(c.content)
  .replace(/\]\(assets\/(front-cover|back-cover)\.png\)/g,(_full,label)=>"](data:image/png;base64,"+fs.readFileSync(path.join(book.__mediaDir,label+".png")).toString("base64")+")")
  .replace(/\]\(asset:([a-z0-9]+)\)/g,(_full,id)=>assetMap[id]?"](data:"+assetMap[id].mime+";base64,"+assetMap[id].base64+")":"](#gambar-tidak-tersedia)")
  .replace(/!\[([^\]]*)\]\(asset:([a-z0-9]+)\)/g,(_whole,alt,id)=>assetMap[id]?"!["+alt+"](data:"+assetMap[id].mime+";base64,"+assetMap[id].base64+")":"[Gambar tidak ditemukan: "+alt+"]"),number:i+1}));
 const {marked}=require("marked"),sanitize=require("sanitize-html");
 const sections=pages.map((p,i)=>'<article class="page" data-page="'+i+'" aria-labelledby="ch'+i+'" '+(i?'hidden':'')+'><h2 id="ch'+i+'">'+esc(p.title)+'</h2>'+sanitize(marked.parse(p.body,{async:false}),{allowedTags:["img","p","h1","h2","h3","h4","h5","h6","strong","em","ul","ol","li","blockquote","code","pre","table","thead","tbody","tr","th","td","hr","br","a"],allowedAttributes:{a:["href","title"],img:["src","alt"]},allowedSchemes:["https","http","mailto","data"],allowedSchemesByTag:{img:["data"]}})+'</article>').join("\n");
 const links=pages.map((p,i)=>'<li><button type="button" class="toc-link" data-go="'+i+'">'+esc(p.title)+'</button></li>').join("");
 return '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>PRATINJAU FLIPBOOK — '+esc(book.title)+'</title><style>:root{color-scheme:light dark;font-family:system-ui,Arial,sans-serif}*{box-sizing:border-box}body{margin:0;background:#edf2f8;color:#15263d}header{padding:18px 24px;background:#172c46;color:#fff}header h1{font-size:clamp(1.25rem,2vw,2rem);margin:.2em 0}header p{margin:.3em 0}.layout{display:grid;grid-template-columns:minmax(210px,260px) minmax(0,1fr);gap:18px;max-width:1160px;margin:16px auto;padding:0 12px}aside,main{background:#fff;border:1px solid #ccd5e2;border-radius:12px;padding:16px}aside ol{padding-left:18px}.toc-link{border:0;background:transparent;text-align:left;text-decoration:underline;color:#21569b;cursor:pointer;padding:7px 3px;font:inherit}.reader{font-size:var(--size,18px);line-height:1.75;max-width:70ch;margin:auto;overflow-wrap:anywhere}.reader img,.reader table{max-width:100%}.reader table{display:block;overflow-x:auto}.page{min-height:55vh}.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 0 18px}button{cursor:pointer;padding:9px 13px;min-height:42px;border:1px solid #8497b7;border-radius:8px;background:#f4f7fc;color:#1d3e6d;font:inherit}button:disabled{opacity:.42;cursor:not-allowed}button:focus-visible,a:focus-visible{outline:3px solid #195fc5;outline-offset:2px}.bar label{display:flex;align-items:center;gap:7px}input{min-height:38px;max-width:100%}.banner{background:#fff1c6;color:#523915;padding:8px 12px;border:1px solid #cb9f38;border-radius:8px}#linear .page{display:block!important;border-bottom:1px solid #bbb;margin-bottom:24px;padding-bottom:20px}@media(max-width:690px){.layout{display:block}aside{margin-bottom:12px}}@media(prefers-color-scheme:dark){body{background:#101b2b;color:#eaf1fa}aside,main{background:#20324c;color:#eaf1fa;border-color:#566b85}.toc-link{color:#aacdff}button{background:#2c4261;border-color:#7994ba;color:#f3f8ff}.banner{background:#4b3c20;color:#fff0c8}}@media print{header,.bar,aside{display:none}main{border:0}.page{display:block!important;break-before:page}body{background:#fff;color:#111}}</style></head><body><header><h1>'+esc(book.title)+'</h1><p>Penulis: '+esc(book.author)+' · Pratinjau buku 3 bab</p><p class="banner">DRAF — BELUM DISETUJUI • Bukan edisi final atau bukti ISBN</p></header><div class="layout"><aside><h2>Daftar isi</h2><ol>'+links+'</ol><p>Gunakan tombol, panah kiri/kanan, atau geser layar sentuh untuk berpindah bab.</p></aside><main id="reader-container"><div class="bar"><button id="prev" aria-label="Bab sebelumnya">← Sebelumnya</button><strong id="counter" role="status" aria-live="polite">Bab 1 / '+pages.length+'</strong><button id="next" aria-label="Bab berikutnya">Berikutnya →</button><label>Ukuran teks <input id="font" type="range" min="15" max="28" value="18" aria-label="Ukuran teks"></label><label><input id="linear-toggle" type="checkbox"> Mode baca linear</label></div><div id="reader" class="reader">'+sections+'</div></main></div><script>(function(){const pages=[...document.querySelectorAll(".page")],counter=document.querySelector("#counter"),linear=document.querySelector("#linear-toggle"),prev=document.querySelector("#prev"),next=document.querySelector("#next");let pos=0;function draw(index){pos=Math.max(0,Math.min(pages.length-1,index));pages.forEach((page,i)=>page.hidden=!linear.checked&&i!==pos);prev.disabled=linear.checked||pos===0;next.disabled=linear.checked||pos===pages.length-1;counter.textContent=linear.checked?"Seluruh "+pages.length+" bab":"Bab "+(pos+1)+" / "+pages.length;}document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{linear.checked=false;draw(Number(b.dataset.go));document.querySelector("#reader-container").scrollIntoView()}));prev.addEventListener("click",()=>draw(pos-1));next.addEventListener("click",()=>draw(pos+1));linear.addEventListener("change",()=>{(document.querySelector("#linear")||document.querySelector("#reader")).id=linear.checked?"linear":"reader";draw(pos)});document.querySelector("#font").addEventListener("input",e=>document.documentElement.style.setProperty("--size",e.target.value+"px"));document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea,select"))return;if(e.key==="ArrowLeft")draw(pos-1);if(e.key==="ArrowRight")draw(pos+1)});let touchX=null;document.querySelector("#reader-container").addEventListener("touchstart",e=>{touchX=e.changedTouches[0].screenX},{passive:true});document.querySelector("#reader-container").addEventListener("touchend",e=>{if(touchX===null||linear.checked)return;const dx=e.changedTouches[0].screenX-touchX;if(Math.abs(dx)>65)draw(pos+(dx<0?1:-1));touchX=null},{passive:true});draw(0)})();</script></body></html>';
}
async function normalizeEpubCoverAndAlt(source,assetMap,mediaDir,title){
 const zip=await JSZip.loadAsync(fs.readFileSync(source));
 const front=fs.readFileSync(path.join(mediaDir,"front-cover.png"));
 const back=fs.readFileSync(path.join(mediaDir,"back-cover.png"));
 const candidates=[
  {sha:createHash("sha256").update(front).digest("hex"),alt:"Sampul depan buku "+title},
  {sha:createHash("sha256").update(back).digest("hex"),alt:"Sampul belakang buku "+title},
  ...Object.values(assetMap).map(a=>({sha:createHash("sha256").update(a.bytes).digest("hex"),alt:a.altText||"Ilustrasi yang teks alternatifnya perlu diperiksa"}))
 ];
 const altByResource=new Map();let frontHref="";
 for(const name of Object.keys(zip.files).filter(x=>/\.(png|jpeg|jpg|webp)$/i.test(x))){
  const bytes=await zip.file(name).async("nodebuffer");
  const sha=createHash("sha256").update(bytes).digest("hex");
  const found=candidates.find(x=>x.sha===sha);
  if(!found)continue;
  const href=name.startsWith("EPUB/")?name.slice(5):name;
  altByResource.set(href,found.alt);
  if(found.sha===candidates[0].sha)frontHref=href;
 }
 for(const filename of Object.keys(zip.files).filter(x=>x.endsWith(".xhtml"))){
  const xmlBody=await zip.file(filename).async("string");
  const rewritten=xmlBody.replace(/<img\b[^>]*>/g,tag=>{
   const relative=(tag.match(/\bsrc="([^"]+)"/)||[])[1];
   if(!relative)return tag;
   const name=filename.startsWith("EPUB/")?filename.slice(5):filename;
   const href=path.posix.normalize(path.posix.join(path.posix.dirname(name),relative));
   const alt=altByResource.get(href);
   if(!alt)return tag;
   return /\balt="[^"]*"/.test(tag)?tag.replace(/\balt="[^"]*"/,'alt="'+esc(alt)+'"'):tag.replace(/\/?>$/,' alt="'+esc(alt)+'" />');
  });
  if(rewritten!==xmlBody)zip.file(filename,rewritten);
 }
 const opfName=Object.keys(zip.files).find(x=>x.endsWith(".opf"));
 if(opfName&&frontHref){
  const old=await zip.file(opfName).async("string");
  const rewritten=old.replace(/<item\b[^>]*\/>/g,item=>{
   if(!item.includes('href="'+frontHref+'"'))return item;
   if(item.includes('properties="'))return item.replace(/properties="([^"]*)"/,(_whole,props)=>'properties="'+props+' cover-image"');
   return item.replace(/\s*\/>$/,' properties="cover-image" />');
  });
  zip.file(opfName,rewritten);
 }
 return zip.generateAsync({type:"nodebuffer",compression:"DEFLATE",compressionOptions:{level:6}});
}
async function placeDocxCoverFirst(source){
 const zip=await JSZip.loadAsync(fs.readFileSync(source));
 let xmlBody=await zip.file("word/document.xml").async("string");
 const start=xmlBody.match(/<w:bookmarkStart\b[^>]*w:id="(\d+)"[^>]*w:name="sampul-depan"[^>]*\/>/);
 if(!start)throw Error("DOCX front cover bookmark not found");
 const begin=xmlBody.indexOf(start[0]);
 const endExp=new RegExp('<w:bookmarkEnd\\s+w:id="'+start[1]+'"\\s*/>');
 const trailing=xmlBody.slice(begin).match(endExp);
 if(!trailing)throw Error("DOCX front cover end bookmark not found");
 const end=begin+trailing.index+trailing[0].length;
 const block=xmlBody.slice(begin,end);
 const pageBreak='<w:p><w:r><w:br w:type="page" /></w:r></w:p>';
 xmlBody=xmlBody.slice(0,begin)+xmlBody.slice(end);
 xmlBody=xmlBody.replace("<w:body>","<w:body>"+block+pageBreak);
 const back=xmlBody.match(/<w:bookmarkStart\b[^>]*w:name="sampul-belakang"[^>]*\/>/);
 if(!back)throw Error("DOCX back cover not found");
 xmlBody=xmlBody.replace(back[0],pageBreak+back[0]);
 zip.file("word/document.xml",xmlBody);
 return zip.generateAsync({type:"nodebuffer",compression:"DEFLATE",compressionOptions:{level:6}});
}
async function main(){
 const u=new URL(process.env.DATABASE_URL||"");if(u.host+u.pathname!=="127.0.0.1:55999/bookstudio_import_qa")throw Error("Refusing to read unknown database");
 fs.mkdirSync(root,{recursive:true});const report={type:"DRAFT_PREVIEW_ONLY",generatedAt:new Date().toISOString(),root,books:[]};
 for(const id of ids){
  const book=await db.book.findUnique({where:{id},include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},assets:{where:{archivedAt:null}}}});
  if(!book)throw Error("Missing book "+id);if(book.status!=="DRAFT")throw Error("Book not a draft "+id);
  const basename=slug(book.title),dir=path.join(root,basename);fs.mkdirSync(dir,{recursive:true});
  const assetMap=Object.fromEntries(book.assets.map(a=>[a.id,{mime:a.mime,base64:Buffer.from(a.bytes).toString("base64"),bytes:Buffer.from(a.bytes),license:a.license,altText:a.altText}]));
  function mediaAwareMarkdown(input){return cleanMarkdown(input).replace(/\bTabel\s+(?=@tbl-)/gi,"").replace(/\bGambar\s+(?=@fig-)/gi,"").replace(/!\[([^\]]*)\]\(asset:([a-z0-9]+)\)/g,(_whole,alt,id)=>assetMap[id]?"!["+alt+"](assets/"+id+"."+(assetMap[id].mime==="image/png"?"png":assetMap[id].mime==="image/jpeg"?"jpg":"webp")+")":"[Gambar perlu dipulihkan: "+alt+"]")}

  const mediaDir=path.join(dir,"work","assets");fs.mkdirSync(mediaDir,{recursive:true});
  const coverFiles=await covers(book,mediaDir);
  const parts=markdownParts(book,coverFiles);
  const qmd=path.join(dir,"manuscript.qmd"),lines=['---','title: '+JSON.stringify(book.title),'subtitle: '+JSON.stringify(book.subject),'author: '+JSON.stringify(book.author),'lang: id','toc: true','number-sections: false','format:','  html:','    embed-resources: true','    theme: cosmo','  docx:','    toc: true','  epub:','    toc: true','  typst:','    toc: true','    papersize: a4','---','', '# DRAF — PRATINJAU, BELUM DISETUJUI','', '> Naskah kerja. Bukan edisi terbit, bukan bukti ISBN, dan belum melalui review independen.',''];
  for(const p of parts.front)lines.push("# "+p.title+" {.unnumbered}","",""+p.content,"");
  for(const c of book.chapters){
    const heading=c.title.replace(/^#+\s*/,"").replace(/[\r\n]/g," ");
    let content=c.content;
    const first=content.split(/\r?\n/,1)[0]||"";
    const norm=x=>String(x).normalize("NFKC").replace(/^#+\s*/,"").trim().replace(/\s+/g," ").toLocaleLowerCase("id");
    if(/^#\s+/.test(first)&&norm(first)===norm(heading))content=content.slice(first.length).replace(/^\r?\n/,"").trim();
    lines.push("# "+heading,"",mediaAwareMarkdown(content),"");
  }
  for(const p of parts.back)lines.push("# "+p.title+" {.unnumbered}","",""+p.content,"");
  fs.writeFileSync(qmd,lines.join("\n"),"utf8");
  const files=[],renderLog=[];
  const work=path.join(dir,"work");fs.mkdirSync(work,{recursive:true});fs.copyFileSync(qmd,path.join(work,"manuscript.qmd"));
  fs.mkdirSync(path.join(work,"assets"),{recursive:true});
  for(const [id,a] of Object.entries(assetMap)){
    const ext=a.mime==="image/png"?"png":a.mime==="image/jpeg"?"jpg":"webp";
    fs.writeFileSync(path.join(mediaDir,id+"."+ext),a.bytes);
  }
  const allQmd=fs.readFileSync(qmd,"utf8");
  const beforeCover=allQmd.indexOf("# Sampul Depan {.unnumbered}");
  const titleStart=allQmd.indexOf("# Halaman Judul {.unnumbered}");
  const backStart=allQmd.lastIndexOf("# Sampul Belakang {.unnumbered}");
  if(beforeCover<0||titleStart<=beforeCover||backStart<=titleStart)throw Error("Book sections not in expected order");
  const pdfOnlyQmd=allQmd.slice(0,beforeCover)+allQmd.slice(titleStart,backStart);
  fs.writeFileSync(path.join(work,"pdf-manuscript.qmd"),pdfOnlyQmd,"utf8");
  for(const item of [{to:"docx",ext:"docx"},{to:"epub",ext:"epub"},{to:"html",ext:"html"},{to:"typst",ext:"pdf"}]){
   const src=item.ext==="pdf"?"pdf-manuscript.qmd":"manuscript.qmd";
   const result=run("quarto",["render",src,"--to",item.to],work,180000);
   renderLog.push({format:item.ext,...result});
   const target=path.join(work,(item.ext==="pdf"?"pdf-manuscript":"manuscript")+"."+item.ext),dest=path.join(dir,basename+"-DRAF."+item.ext);
   if(result.exit===0&&fs.existsSync(target)){
    if(item.ext==="pdf"){
     const doc=await PDFDocument.load(fs.readFileSync(target));
     const sizes={A4:[595,842],A5:[420,595],B5:[499,709]};
     const [w,h]=sizes[book.pageSize]||sizes.A4;
     const front=await doc.embedPng(fs.readFileSync(path.join(mediaDir,"front-cover.png")));
     const back=await doc.embedPng(fs.readFileSync(path.join(mediaDir,"back-cover.png")));
     const addCover=(page,img)=>{
      const scale=Math.max(w/img.width,h/img.height);
      page.drawImage(img,{x:(w-img.width*scale)/2,y:(h-img.height*scale)/2,width:img.width*scale,height:img.height*scale});
     };
     addCover(doc.insertPage(0,[w,h]),front);
     addCover(doc.addPage([w,h]),back);
     doc.setTitle(book.title);doc.setAuthor(book.author);doc.setSubject(book.subject);
     fs.writeFileSync(dest,Buffer.from(await doc.save()));
    }else if(item.ext==="epub"){
     const bytes=await normalizeEpubCoverAndAlt(target,assetMap,mediaDir,book.title);
     fs.writeFileSync(dest,bytes);
    }else if(item.ext==="docx"){
     const bytes=await placeDocxCoverFirst(target);
     fs.writeFileSync(dest,bytes);
    }else fs.copyFileSync(target,dest);
    const b=fs.readFileSync(dest);
    files.push({format:item.ext,file:dest,size:b.length,sha256:createHash("sha256").update(b).digest("hex"),status:"GENERATED"});
   }else files.push({format:item.ext,status:"FAILED",message:(result.stderr||result.stdout||result.error||"").slice(-600)});
  }
  const flip=path.join(dir,basename+"-DRAF-flipbook.html");fs.writeFileSync(flip,flipbook({...book,__mediaDir:mediaDir},book.chapters,assetMap,parts.front,parts.back),"utf8");
  const fb=fs.readFileSync(flip);files.push({format:"flipbook",file:flip,size:fb.length,sha256:createHash("sha256").update(fb).digest("hex"),status:"GENERATED"});
  report.books.push({id:book.id,title:book.title,chapters:book.chapters.length,status:book.status,files,renderLog});
  console.log("BOOK_EXPORT_RESULT",book.title,files.map(x=>x.format+":"+x.status).join(","));
 }
 const manifest=path.join(root,"PREVIEW_MANIFEST.json");fs.writeFileSync(manifest,JSON.stringify(report,null,2),"utf8");
 console.log("MANIFEST",manifest);console.log("SUMMARY",report.books.map(x=>({title:x.title,formats:x.files.map(f=>({format:f.format,status:f.status,size:f.size}))})));
}
main().catch(e=>{console.error("FIVE_FORMAT_GENERATION_FAIL",e);process.exitCode=1}).finally(()=>db.$disconnect());
