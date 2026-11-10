"use strict";
const fs=require("node:fs"),crypto=require("node:crypto"),path=require("node:path"),JSZip=require("jszip"),{spawnSync}=require("node:child_process");
const formats=["docx","pdf","epub","html","flipbook"];
const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i++)if(args[i].startsWith("--"))opts[args[i].slice(2)]=args[i+1]&&!args[i+1].startsWith("--")?args[++i]:true;
function tool(file,argv){const result=spawnSync(file,argv,{encoding:"utf8",timeout:60000,maxBuffer:2_000_000,windowsHide:true,shell:false});return {exitCode:result.status,error:result.error?.message??null,output:(result.stdout||result.stderr||"").slice(-2500)}}
async function inspect(format,file){
 if(!file||file===true)return {format,status:"NOT_RUN",message:"Tidak ada artefak untuk divalidasi; jangan menandai lulus."};
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())return {format,status:"ERROR",message:"Berkas tidak ditemukan."};
 const buffer=fs.readFileSync(file),checksum=crypto.createHash("sha256").update(buffer).digest("hex");
 const data={format,path:path.resolve(file),sizeBytes:buffer.length,sha256:checksum,structure:"NOT_RUN",validator:"NOT_RUN",humanReview:"NOT_RUN",status:"NO_GO"};
 try{
  if(format==="docx"){
   const zip=await JSZip.loadAsync(buffer),xml=await zip.file("word/document.xml")?.async("string");
   data.structure=zip.file("[Content_Types].xml")&&xml&&xml.includes("<w:document")?"PASS":"FAIL";
   data.validator="Paket OOXML dasar diperiksa; buka-edit Word/LibreOffice, TOC, gambar, relasi dan round-trip MANUAL NOT_RUN";
  }else if(format==="epub"){
   const zip=await JSZip.loadAsync(buffer),mime=await zip.file("mimetype")?.async("string");
   data.structure=mime==="application/epub+zip"&&zip.file("META-INF/container.xml")&&Object.keys(zip.files).some(k=>k.endsWith(".opf"))?"PASS":"FAIL";
   if(process.env.EPUBCHECK_JAR&&fs.existsSync(process.env.EPUBCHECK_JAR)){const r=tool("java",["-jar",process.env.EPUBCHECK_JAR,file]);data.validator=r.exitCode===0?"EPUBCheck PASS":"EPUBCheck FAIL: "+(r.error||r.output)}
   else data.validator="EPUBCheck NOT_RUN: set EPUBCHECK_JAR untuk pemeriksaan standar EPUB";
  }else if(format==="pdf"){
   const ascii=buffer.toString("latin1");
   data.structure=ascii.startsWith("%PDF-")&&ascii.slice(-1500).includes("%%EOF")?"PASS":"FAIL";
   data.validator="veraPDF PDF/A atau PDF/UA NOT_RUN: instal validator, pilih profil yang sesuai; pemeriksaan manusia tetap wajib";
  }else if(format==="html"){
   const html=buffer.toString("utf8");
   data.structure=/<!doctype html>/i.test(html)&&/<html\b/i.test(html)&&/<(?:main|article)\b/i.test(html)?"PASS":"FAIL";
   if(process.env.VNU_JAR&&fs.existsSync(process.env.VNU_JAR)){const r=tool("java",["-jar",process.env.VNU_JAR,"--errors-only",file]);data.validator=r.exitCode===0?"Nu HTML Checker PASS":"Nu HTML Checker FAIL: "+(r.error||r.output)}
   else data.validator="Nu HTML Checker dan axe-core NOT_RUN; keyboard/pembaca layar juga NOT_RUN";
  }else if(format==="flipbook"){
   const html=buffer.toString("utf8");
   const hasDocument=/<!doctype html>/i.test(html)&&/<html\b/i.test(html);
   const hasReader=/(data-reader=["\x27]flipbook["\x27]|reader-next|flipbook)/i.test(html);
   const hasNavigation=/(reader-prev|prev-page|Sebelumnya|previous)/i.test(html)&&/(reader-next|next-page|Berikutnya|next)/i.test(html);
   data.structure=hasDocument&&hasReader&&hasNavigation?"PASS":"FAIL";
   data.validator="Struktur interaktif diperiksa; browser Playwright, keyboard, touch dan screen reader wajib dibuktikan melalui tes terpisah.";
  }
 }catch(e){data.structure="FAIL";data.validator=e instanceof Error?e.message:"Tidak dapat memeriksa berkas"}
 return data;
}
(async()=>{
 const results=[];for(const format of formats)results.push(await inspect(format,opts[format]));
 const report={generatedAt:new Date().toISOString(),scope:"LOCAL_ARTIFACT_CHECK_ONLY",sourceSnapshot:"NOT_SUPPLIED",decision:"NO_GO",formats:results,
  warning:"Pemeriksaan struktur dasar atau suksesnya EPUBCheck tidak menyatakan sertifikasi resmi. Pemeriksaan artefak terhadap snapshot, aksesibilitas, lisensi, bukti manusia dan distribusi tetap wajib."};
 if(opts.output&&opts.output!==true){fs.mkdirSync(path.dirname(opts.output),{recursive:true});fs.writeFileSync(opts.output,JSON.stringify(report,null,2)+"\n")}
 process.stdout.write(JSON.stringify(report,null,2)+"\n");
})().catch(e=>{process.stderr.write(String(e)+"\n");process.exitCode=1});
