"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{spawnSync}=require("node:child_process");
const base=path.resolve("artifacts/20261108-two-book-draft-previews");
const manifest=JSON.parse(fs.readFileSync(path.join(base,"PREVIEW_MANIFEST.json"),"utf8"));
const formats=["pdf","docx","epub","html","flipbook"];
const jar=path.resolve("tools/validators/epubcheck-5.4.0/epubcheck-5.4.0/epubcheck.jar");
const reports=[];
for(const book of manifest.books){
 const args=["scripts/validate-release-artifacts.cjs"];
 for(const format of formats){
  const artifact=book.files.find(x=>x.format===format);
  if(!artifact||!fs.existsSync(artifact.file))throw Error(book.id+" missing "+format);
  const digest=crypto.createHash("sha256").update(fs.readFileSync(artifact.file)).digest("hex");
  if(digest!==artifact.sha256)throw Error(book.id+" modified "+format);
  args.push("--"+format,artifact.file);
 }
 const output=path.join(base,book.id+"-RELEASE_QA.json");
 args.push("--output",output);
 const result=spawnSync(process.execPath,args,{cwd:process.cwd(),env:{...process.env,EPUBCHECK_JAR:jar},encoding:"utf8",timeout:240000,maxBuffer:1000000,windowsHide:true});
 if(result.status!==0)throw Error(book.id+" validator crashed: "+(result.stderr||result.error));
 const report=JSON.parse(fs.readFileSync(output,"utf8"));
 const statuses=report.formats.map(x=>({format:x.format,structure:x.structure,validator:x.validator}));
 if(statuses.some(x=>x.structure!=="PASS"))throw Error(book.id+" invalid structure: "+JSON.stringify(statuses));
 if(statuses.find(x=>x.format==="epub")?.validator!=="EPUBCheck PASS")throw Error(book.id+" EPUBCheck not PASS");
 reports.push({bookId:book.id,title:book.title,artifactStatus:"PASS",publicationDecision:"NO_GO",formats:statuses});
 console.log("FIVE_FORMAT_ARTIFACT_STRUCTURE_PASS",book.id);
}
const out=path.join(base,"TWO_BOOKS_RELEASE_QA.json");
fs.writeFileSync(out,JSON.stringify({createdAt:new Date().toISOString(),scope:"QA DRAFT ONLY",publicationDecision:"NO_GO",books:reports},null,2)+"\n");
console.log("STRUCTURAL_VALIDATION_PASS; OFFICIAL_RELEASE_NO_GO",out);