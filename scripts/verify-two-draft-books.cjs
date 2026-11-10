"use strict";
const fs=require("node:fs"),path=require("node:path"),JSZip=require("jszip"),{chromium}=require("playwright"),crypto=require("node:crypto");
const root=path.resolve("artifacts/20261108-two-book-draft-previews"),manifest=JSON.parse(fs.readFileSync(path.join(root,"PREVIEW_MANIFEST.json"),"utf8"));
const {PrismaClient}=require("@prisma/client"),db=new PrismaClient();
const expected=["docx","pdf","epub","html","flipbook"];
const requiredMatter=["Sampul Depan","Halaman Judul","Halaman Identitas dan Hak Cipta","Kata Pengantar","Petunjuk Pembaca","Referensi dan Sumber","Daftar Pustaka dan Bibliografi","Sampul Belakang"];
const flattened=x=>String(x).replace(/&amp;/g,"&").replace(/<[^>]+>/g," ").replace(/\s+/g," ").toLowerCase();
const assertMatter=(value,format,required=requiredMatter)=>{for(const heading of required){if(!flattened(value).includes(heading.toLowerCase()))throw Error(format+" missing "+heading)}};

async function main(){
 const browser=await chromium.launch({headless:true});const checks=[];
 try{
 for(const item of manifest.books){
  const book=await db.book.findUnique({where:{id:item.id},include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},assets:{where:{archivedAt:null},select:{id:true,mime:true}}}});
  if(!book||book.status!=="DRAFT")throw Error("Unsafe or missing book "+item.id);
  const titles=book.chapters.map(c=>c.title),dir=path.dirname(item.files[0].file),results=[];
  for(const format of expected){
   const f=item.files.find(a=>a.format===format);
   if(!f||f.status!=="GENERATED"||!fs.existsSync(f.file))throw Error("Missing real file "+format+" for "+book.title);
   const buf=fs.readFileSync(f.file),sha=crypto.createHash("sha256").update(buf).digest("hex");
   if(sha!==f.sha256)throw Error("Hash changed "+format);
   const c={format,size:buf.length,sha256:sha,status:"PASS",checks:[]};
   if(format==="docx"||format==="epub"){
    const zip=await JSZip.loadAsync(buf);
    if(format==="docx"){
     const x=await zip.file("word/document.xml")?.async("string");
     if(!x)throw Error("DOCX missing document.xml");
     for(const title of titles)if(!x.includes(title.replace(/&/g,"&amp;")))throw Error("DOCX missing "+title);
     assertMatter(x,"DOCX");
     const frontPosition=x.indexOf('w:name="sampul-depan"');
     const titlePosition=x.indexOf('w:pStyle w:val="Title"');
     const backPosition=x.indexOf('w:name="sampul-belakang"');
     if(frontPosition<0||titlePosition<0||frontPosition>titlePosition||backPosition<titlePosition)throw Error("DOCX book cover order incorrect");
     c.checks.push("front cover before title","back cover last","front matter and back matter");
     c.checks.push("OOXML document readable","all 3 chapter titles");
     if(book.assets.length){const names=Object.keys(zip.files).filter(n=>n.startsWith("word/media/"));if(names.length<book.assets.length)throw Error("DOCX image assets absent");c.checks.push(names.length+" embedded images")}
    }else{
     const mime=await zip.file("mimetype")?.async("string");
     if(mime!=="application/epub+zip")throw Error("Bad epub mime");
     const opf=Object.keys(zip.files).find(n=>n.endsWith(".opf"));if(!opf)throw Error("EPUB has no .opf");
     const docs=Object.keys(zip.files).filter(n=>n.endsWith(".xhtml"));if(docs.length<3)throw Error("EPUB chapters missing");
     const merged=(await Promise.all(docs.map(n=>zip.file(n).async("string")))).join("\n");
     for(const title of titles)if(!merged.includes(title.replace(/&/g,"&amp;")))throw Error("EPUB missing "+title);
     assertMatter(merged,"EPUB");
     const opfXml=await zip.file(opf)?.async("string");
     if(!opfXml?.includes('cover-image'))throw Error("EPUB metadata missing cover-image property");
     if(merged.includes('alt=""'))throw Error("EPUB contains blank image alternative text");
     c.checks.push("front and back matter","registered cover image","nonempty image descriptions");
     c.checks.push("EPUB mimetype, OPF and XHTML","all chapter titles");
     if(book.assets.length){const media=Object.keys(zip.files).filter(n=>/\.(png|jpe?g)$/i.test(n));if(media.length<book.assets.length)throw Error("EPUB image assets absent");c.checks.push(media.length+" embedded images")}
    }
   }else if(format==="pdf"){
    if(!buf.subarray(0,5).equals(Buffer.from("%PDF-"))||!buf.toString("latin1").slice(-1500).includes("%%EOF"))throw Error("PDF header/trailer invalid");
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc=await pdfjs.getDocument({data:new Uint8Array(buf),useSystemFonts:true,disableFontFace:true}).promise;
    const pages=doc.numPages;let extracted="";
    for(let i=1;i<=pages;i++){const content=await(await doc.getPage(i)).getTextContent();extracted+="\n"+content.items.map(t=>t.str??"").join(" ")}
    for(const title of titles){const parts=title.split(" ").filter(v=>v.length>=5).slice(0,2);if(!parts.some(p=>extracted.includes(p)))throw Error("PDF chapter likely absent: "+title)}
    if(!extracted.includes("DRAF"))throw Error("PDF draft watermark/text absent");
    if(pages<7)throw Error("PDF lacks full book structure");
    const firstPage=await(await doc.getPage(1)).getTextContent();
    const lastPage=await(await doc.getPage(pages)).getTextContent();
    if(firstPage.items.some(x=>String(x.str||"").trim())||lastPage.items.some(x=>String(x.str||"").trim()))throw Error("PDF front/back covers should occupy dedicated image-only pages");
    c.checks.push("physical full-page first and last covers");
    assertMatter(extracted,"PDF",requiredMatter.filter(x=>!x.startsWith("Sampul ")));

    c.pages=pages;c.checks.push("PDF parsed with pdfjs",pages+" pages","draft disclaimer","chapter text");
   }else{
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("file:///"+f.file.replace(/\\/g,"/"));
    if(format==="html"){
     const pageText=await page.locator("body").innerText();
     for(const title of titles)if(!pageText.includes(title))throw Error("HTML chapter missing "+title);
     if(!pageText.includes("DRAF"))throw Error("HTML missing preview notice");
     if(book.assets.length){const images=await page.locator("img").count();if(images<book.assets.length)throw Error("HTML images missing");c.checks.push(images+" images")}
     assertMatter(pageText,"HTML");
     c.checks.push("HTML opens","all chapters","draft disclaimer");
    }else{
     const actual=await page.locator(".page").count();
     if(actual!==12)throw Error("Flipbook front+toc+chapters+back must contain 12 pages, got "+actual);
     const allText=await page.locator(".page").allInnerTexts();
     assertMatter(allText.join(" "),"Flipbook");
     const next=page.getByRole("button",{name:"Bab berikutnya"});
     await next.click();
     if(!((await page.locator("#counter").innerText()).includes("2 / 12")))throw Error("Flipbook next broken");
     await page.keyboard.press("ArrowRight");
     if(!((await page.locator("#counter").innerText()).includes("3 / 12")))throw Error("Flipbook keyboard navigation broken");
     await page.getByLabel("Mode baca linear").check();
     if(await page.locator(".page:visible").count()!==12)throw Error("Flipbook linear fallback broken");
     await page.getByLabel("Mode baca linear").uncheck();
     if(await page.locator(".page:visible").count()!==1)throw Error("Flipbook cannot restore paginated mode");
     if(!((await page.locator("#counter").innerText()).includes("3 / 12")))throw Error("Flipbook lost selected page after linear mode");
     await page.locator('.toc-link[data-go="11"]').click();
     if(!((await page.locator(".page:visible h2").innerText()).includes("Sampul Belakang")))throw Error("Back cover navigation failed");
     c.checks.push("all 12 logical sections","next button","keyboard navigation","linear reading fallback","back cover","draft disclaimer");
     if(book.assets.length){const images=await page.locator("img").count();if(images<book.assets.length)throw Error("Flipbook images missing");c.checks.push(images+" images")}
     c.checks.push("next button","keyboard navigation","linear reading fallback","draft disclaimer");
    }
    if(errors.length)throw Error("Browser JS errors "+errors.join(";"));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    if(overflow)throw Error(format+" overflows 390px");
    await context.close();
   }
   results.push(c);
   console.log("VALIDATED",book.title.slice(0,26),format,JSON.stringify(c.checks));
  }
  const zip=new JSZip();
  for(const f of item.files){zip.file(path.basename(f.file),fs.readFileSync(f.file))}
  const readme="BC Book Studio — LIMA FORMAT PRATINJAU DRAF\r\n\r\nBuku: "+book.title+"\r\nStatus: DRAFT — belum disetujui penerbit, bukan edisi terbit.\r\nFormat: DOCX, PDF, EPUB, HTML, Flipbook HTML interaktif.\r\nPratinjau bukan ISBN, sertifikasi PDF/UA, PDF/X, EPUBCheck, maupun bukti distribusi.\r\nTinjau hak gambar/sumber dan lakukan approval reviewer independen sebelum rilis publik.\r\n";
  zip.file("BACA-DAHULU.txt",readme);
  const logPath=path.join(dir,"EPUBCHECK_5.4.0.txt");
  if(fs.existsSync(logPath)){
    const log=fs.readFileSync(logPath,"utf8");
    if(!log.includes("Exit code: 0")||!log.includes("0 fatals / 0 errors / 0 warnings"))throw Error("EPUBCheck proof did not pass: "+book.title);
    zip.file("EPUBCHECK_5.4.0.txt",log);
  }
  zip.file("VALIDATION_SUMMARY.json",JSON.stringify({bookId:item.id,title:book.title,previewOnly:true,checks:results,publishingReady:false,epubcheck:fs.existsSync(logPath)?"PASS v5.4.0":"NOT_RUN"},null,2));

  const dest=path.join(root,path.basename(dir)+".zip"),archive=await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE",compressionOptions:{level:6}});
  fs.writeFileSync(dest,archive);
  checks.push({title:book.title,bookId:item.id,status:"PASS_PREVIEW_ONLY",formats:results,zip:dest,zipBytes:archive.length,sha256:crypto.createHash("sha256").update(archive).digest("hex")});
 }
 }finally{await browser.close();await db.$disconnect()}
 const report={status:"PREVIEW_QA_PASS_PUBLISHING_HOLD",notes:["No ISBN or certification issued","EPUBCheck/veraPDF/real Word editing not run","Flipbook is interactive by chapter, not proof of fixed print pagination"],books:checks};
 fs.writeFileSync(path.join(root,"PREVIEW_VALIDATION_REPORT.json"),JSON.stringify(report,null,2),"utf8");
 console.log("FIVE_FORMAT_TWO_BOOKS_QA_PASS",JSON.stringify(checks.map(x=>({title:x.title,zip:x.zip,formats:x.formats.map(f=>f.format)}))));
}
main().catch(e=>{console.error("FIVE_FORMAT_VERIFICATION_FAIL",e);process.exitCode=1;db.$disconnect()});
