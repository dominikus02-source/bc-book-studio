"use strict";
const fs=require("fs"),path=require("path"),ts=require("typescript"),{spawnSync}=require("child_process"),JSZip=require("jszip"),{PDFDocument}=require("pdf-lib");
require.extensions[".ts"]=function(mod,file){const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});mod._compile(output.outputText,file)};
(async()=>{
 const root=path.resolve(__dirname,".."),{makeLetter,letterDocx,letterPdf}=require(path.join(root,"lib","isbn-office.ts"));
 const dst=path.join(root,".data","publisher-letter-render-qa");fs.mkdirSync(dst,{recursive:true});
 const text=makeLetter({kind:"application_letter",publisher:{legalName:"PT Bahasa Cerdas Indonesia",directorName:"[NAMA DIREKTUR]",legalAddress:"[ALAMAT LEGAL PERUSAHAAN]",email:"[EMAIL RESMI]",officialWebsite:"[WEBSITE]"},application:{title:"Fisika untuk SMP Kelas 7",authorNames:"[NAMA PENULIS]",format:"PRINT",language:"id",editionNumber:1,rightsBasis:"ORIGINAL",catalogUrl:"[URL KATALOG]"}});
 const pdf=await letterPdf(text),word=await letterDocx(text);
 fs.writeFileSync(path.join(dst,"contoh-permohonan.pdf"),pdf);fs.writeFileSync(path.join(dst,"contoh-permohonan.docx"),word);
 const p=await PDFDocument.load(pdf);const z=await JSZip.loadAsync(word);
 const doc=await z.file("word/document.xml").async("string");
 if(p.getPageCount()<1||!doc.toUpperCase().includes("PT BAHASA CERDAS INDONESIA"))throw Error("Letter format missing");
 const render=spawnSync("pdftoppm",["-f","1","-l","1","-png","-r","110",path.join(dst,"contoh-permohonan.pdf"),path.join(dst,"preview")],{encoding:"utf8",timeout:25000});
 console.log("LETTER_QA",p.getPageCount(),"pages",pdf.length,"PDF bytes",word.length,"DOCX bytes","renderExit",render.status,render.stderr.slice(0,300),dst);
})().catch(e=>{console.error(e);process.exitCode=1});
