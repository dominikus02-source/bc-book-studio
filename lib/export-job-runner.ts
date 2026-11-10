import {createHash} from "node:crypto";
import {mkdir,rename,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import JSZip from "jszip";
import {PDFDocument} from "pdf-lib";
import {db} from "./db";
import {paperSizes,paperSpec,mmToTwips} from "./paper-sizes";
import {worksheetPreviewProducts,answerSection} from "./worksheet-preview-products";
import {quartoExport} from "./quarto";
import {publicationHtml} from "./publishing-html";
import {DEFAULT_PAGINATION,paginationSchema} from "./book-pagination";
import {paginatePdf} from "./pagination-output";
import {paginateDocx} from "./pagination-docx";
import {resolvedPublishingPackage,publishingSequence} from "./publishing-package";
import {approvedManuscript,referencedAssets} from "./approval-snapshot";
import {applyLayout,storedLayout} from "./book-layout";
import {validatePdfGeometry,epubcheck,fontPreflight,rasterResolutionPreflight,veraPdfPreflight} from "./quality-preflight";

export const artifactRoot=resolve(process.env.EXPORT_ARTIFACT_DIR||join(process.cwd(),".data","export-jobs"));
export function artifactPath(id:string){
 if(!/^[a-z0-9]{15,40}$/.test(id))throw Error("Invalid job ID");
 return join(artifactRoot,id+".zip");
}
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
let active=false;
const limit=100*1024*1024;
type Kind="pdf"|"docx"|"epub"|"html"|"flipbook";
function verifier(kind:Kind,bytes:Buffer,paperId:string){
 const base={status:"PASS",checks:["Nonempty artifact","Signature validated"] as string[]};
 if(bytes.length<200||bytes.length>20*1024*1024)throw Error("Invalid output length");
 if(kind==="pdf"&&!bytes.subarray(0,4).equals(Buffer.from("%PDF")))throw Error("Invalid PDF header");
 if((kind==="docx"||kind==="epub")&&bytes.subarray(0,2).toString()!=="PK")throw Error("Invalid ZIP signature");
 if(kind==="html"||kind==="flipbook"){
  const text=bytes.toString("utf8");
  if(!text.includes("<!doctype html>")||!text.includes('class="book-page"'))throw Error("HTML structure invalid");
 }
 return {...base,kind,paperId};
}
function validations(){
 return {
  EPUBCheck:{status:"NOT_RUN",reason:"EPUBCheck binary/tooling not installed or executed"},
  DAISY_Ace:{status:"NOT_RUN",reason:"Automated accessibility validator not executed"},
  veraPDF:{status:"NOT_RUN",reason:"PDF/A or PDF/UA profile not independently validated"},
  WCAG:{status:"NOT_RUN",reason:"Manual assistive-technology audit pending"},
  editorial:{status:"NOT_RUN",reason:"Human review and ISBN evidence pending"},
 };
}
async function buildJob(jobId:string){
 const job=await db.exportJob.findUniqueOrThrow({where:{id:jobId}});
 const sizes=Array.isArray(job.sizes)?job.sizes.filter((x):x is string=>typeof x==="string"):[];
 if(!sizes.length||sizes.length>13||sizes.some(x=>!paperSpec(x)))throw Error("Invalid size request");
 const source=await db.book.findUnique({where:{id:job.bookId},include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}}}});
 if(!source||source.ownerId!==job.ownerId||source.archivedAt)throw Error("Book ownership changed");
 const paginationRow=await db.bookPagination.findUnique({where:{bookId:source.id}});
 const parsedPagination=paginationSchema.safeParse(paginationRow?.settings);
 const pagination=parsedPagination.success?parsedPagination.data:DEFAULT_PAGINATION;
 if(!job.preview&&source.status!=="APPROVED")throw Error("Final release requires current approval");
 if(!job.preview&&source.approvedAt&&source.approvedAt>job.createdAt)throw Error("Approval changed after this job was queued; request a new export.");
 const snapshot=!job.preview?await approvedManuscript(db,source):null;
 if(!job.preview&&!snapshot)throw Error("Missing immutable approval snapshot");
 const savedLayout=snapshot&&source.approvedAt?await storedLayout(db,source.id,source.approvedAt,snapshot.chapters):null;
 if(!job.preview&&(!job.sourceApprovedAt||job.sourceApprovedAt.getTime()!==source.approvedAt?.getTime()||job.sourceSnapshotHash!==hash(Buffer.from(JSON.stringify(snapshot)))||job.sourceLayoutVersion!==(savedLayout?.version??0)||job.sourcePaginationVersion!==(paginationRow?.version??0)))throw Error("Versi sumber/layout/pagination berubah atau job lama belum terikat versi. Buat ekspor baru.");
 const approved=snapshot?applyLayout(snapshot,savedLayout?.settings??null):null;
 const companions=job.preview?await worksheetPreviewProducts(source):[];
 const book={...(approved??source),chapters:approved?.chapters??source.chapters.map(chapter=>companions.length?{...chapter,content:chapter.content.replace(answerSection,"")}:chapter)};
 if(book.chapters.length<1)throw Error("No chapters");
 const row=job.preview?await db.studioFormDraft.findFirst({where:{ownerId:job.ownerId,module:"PUBLISHING_PACKAGE:"+job.bookId},orderBy:{updatedAt:"desc"}}):null;
 const parts=approved?publishingSequence(approved.publishingPackage,book.chapters):job.preview?publishingSequence(resolvedPublishingPackage(source,row?.payload),book.chapters):null;
 const refs=referencedAssets(parts??book.chapters);
 if(refs.length>20)throw Error("Too many assets");
 const imageRows=!approved&&refs.length?await db.bookAsset.findMany({where:{bookId:source.id,id:{in:refs}}}):[];
 const assets=approved?.assets??imageRows.map(a=>({id:a.id,mime:a.mime,data:Buffer.from(a.bytes).toString("base64"),altText:a.altText}));
 if(assets.length!==refs.length)throw Error("Missing licensed assets");
 const archive=new JSZip(),manifest:{
  version:string;bookId:string;preview:boolean;createdAt:string;renderer:string;source:unknown;
  sizes:string[];files:Record<string,{sha256:string;bytes:number;checks:unknown}>;
  externalValidators:ReturnType<typeof validations>;warnings:string[];
 }={
  version:"2.0.0-draft",bookId:job.bookId,preview:job.preview,createdAt:new Date().toISOString(),
  source:{approvedAt:source.approvedAt?.toISOString()??null,sha256:snapshot?hash(Buffer.from(JSON.stringify(snapshot))):null,schemaVersion:snapshot?.schemaVersion??null,layoutVersion:savedLayout?.version??0,paginationVersion:paginationRow?.version??0},
  renderer:process.env.QUARTO_WORKER_URL?"quarto-worker":"quarto-local-development",
  sizes,files:{},externalValidators:validations(),
  warnings:["EPUB reflowable: no physical paper size","ISO and Indonesia publishing formats are not proof of Perpusnas registration","Release requires human verification"],
 };
 const total=(sizes.length*2+3)*(1+companions.length);
 let done=0;
 async function add(name:string,kind:Kind,sizeId:string,bytes:Uint8Array){
  const data=Buffer.from(bytes),checks=verifier(kind,data,sizeId);
  if(kind==="pdf"){
   const result=await validatePdfGeometry(data,sizeId);
   checks.checks.push(...result.checks,"Total PDF pages: "+result.pages);
   const fonts=await fontPreflight(data);
   checks.checks.push("Font preflight: "+fonts.status+" - "+fonts.summary);
   if(fonts.status==="FAIL")throw Error("PDF fonts not embedded: "+sizeId);
   if(!job.preview&&fonts.status!=="PASS")throw Error("Final PDF font validation required: "+sizeId);
   const raster=await rasterResolutionPreflight(data);
   manifest.warnings.push(sizeId+": "+raster.summary);
   const vera=await veraPdfPreflight(data);
   checks.checks.push("veraPDF "+(vera.version||"unconfigured")+": "+vera.status);
   if(vera.status==="FAIL")throw Error("veraPDF validation failed: "+sizeId);
   manifest.externalValidators.veraPDF={status:vera.status,reason:vera.summary};
  }
  if(kind==="docx"){
   const doc=await JSZip.loadAsync(data),xml=await doc.file("word/document.xml")?.async("string");
   if(!xml)throw Error("Missing Word body");
   const spec=paperSpec(sizeId)!;
   const match=xml.match(/<w:pgSz\b[^>]*>/);
   if(!match||!match[0].includes('w:w="'+mmToTwips(spec.widthMm)+'"')||!match[0].includes('w:h="'+mmToTwips(spec.heightMm)+'"'))throw Error("DOCX physical paper size mismatch");
   checks.checks.push("DOCX dimensions verified");
  }
  if(kind==="epub"){
   const epub=await JSZip.loadAsync(data);
   if(!epub.file("META-INF/container.xml")||!epub.file("mimetype"))throw Error("EPUB package incomplete");
   checks.checks.push("EPUB package structure present");
   const check=await epubcheck(data);
   manifest.externalValidators.EPUBCheck={status:check.status,reason:check.summary};
   checks.checks.push("EPUBCheck "+check.status);
   if(!job.preview&&check.status!=="PASS")throw Error("Final EPUB must pass EPUBCheck");
  }
  archive.file(name,data);
  manifest.files[name]={sha256:hash(data),bytes:data.length,checks};
  done++;
  const state=await db.exportJob.findUniqueOrThrow({where:{id:jobId},select:{cancellationRequested:true}});
  if(state.cancellationRequested)throw Error("CANCELLED_BY_USER");
  await db.exportJob.update({where:{id:jobId},data:{progress:Math.floor(done/total*95),currentStep:name,leaseUntil:new Date(Date.now()+45*1000)}});
 }
 for(const id of sizes){
  const paper=paperSpec(id)!;
  for(const format of ["pdf","docx"] as const){
   const state=await db.exportJob.findUniqueOrThrow({where:{id:jobId},select:{cancellationRequested:true}});
   if(state.cancellationRequested)throw Error("CANCELLED_BY_USER");
   const file=format.toUpperCase()+"/"+id+"."+format;
   const rendered=await quartoExport({...book,pageSize:id,publishingLayout:Boolean(parts),chapters:parts??book.chapters,assets},format);
   let output=parts&&format==="pdf"?await paginatePdf(rendered,parts,pagination):parts&&format==="docx"?await paginateDocx(rendered,parts,pagination,book.title):rendered;
   if(format==="pdf"){const pdf=await PDFDocument.load(output);pdf.setTitle(book.title);pdf.setAuthor(book.author);pdf.setSubject(book.subject);pdf.setLanguage(approved?.language??"id");output=await pdf.save();}
   await add(file,format,id,output);
  }
 }
 const defaultSize=sizes[0];
 await add("EPUB/book-reflowable.epub","epub",defaultSize,await quartoExport({...book,pageSize:defaultSize,publishingLayout:Boolean(parts),chapters:parts??book.chapters,assets},"epub"));
 const htmlParts=parts??book.chapters.map((x,i)=>({title:x.title,content:x.content,kind:"chapter-"+(i+1)}));
 await add("HTML/book.html","html",defaultSize,Buffer.from(publicationHtml(book.title,htmlParts,job.preview,false,defaultSize,assets,pagination,{author:book.author,language:approved?.language??"id",snapshotId:snapshot?source.id+":"+source.approvedAt!.toISOString():"DRAFT"})));
 await add("Flipbook/book-flipbook.html","flipbook",defaultSize,Buffer.from(publicationHtml(book.title,htmlParts,job.preview,true,defaultSize,assets,pagination,{author:book.author,language:approved?.language??"id",snapshotId:snapshot?source.id+":"+source.approvedAt!.toISOString():"DRAFT"})));
 for(const product of companions){
  const render=(format:"pdf"|"docx"|"epub",size:string)=>quartoExport({...book,title:product.title,pageSize:size,publishingLayout:true,chapters:product.parts,assets:[]},format);
  for(const size of sizes){
   await add(product.prefix+"/PDF/"+size+".pdf","pdf",size,await paginatePdf(await render("pdf",size),product.parts,pagination));
   await add(product.prefix+"/DOCX/"+size+".docx","docx",size,await paginateDocx(await render("docx",size),product.parts,pagination,product.title));
  }
  await add(product.prefix+"/EPUB/ebook.epub","epub",defaultSize,await render("epub",defaultSize));
  await add(product.prefix+"/HTML/reader.html","html",defaultSize,Buffer.from(publicationHtml(product.title,product.parts,true,false,defaultSize)));
  await add(product.prefix+"/Flipbook/reader.html","flipbook",defaultSize,Buffer.from(publicationHtml(product.title,product.parts,true,true,defaultSize)));
 }
 archive.file("MANIFEST.json",JSON.stringify(manifest,null,2));
 archive.file("README.txt","BC Book Studio export package. Files have per-item SHA-256 in MANIFEST.json. External validators are NOT_RUN until logs are attached. This ZIP is not an ISBN certificate.\n");
 const bytes=await archive.generateAsync({type:"nodebuffer",compression:"DEFLATE",compressionOptions:{level:6}});
 if(bytes.length>limit)throw Error("Archive exceeded capacity");
 if((await db.exportJob.findUniqueOrThrow({where:{id:jobId},select:{cancellationRequested:true}})).cancellationRequested)throw Error("CANCELLED_BY_USER");
 await mkdir(artifactRoot,{recursive:true});
 const final=artifactPath(jobId),temp=final+".partial";
 try{await rm(temp,{force:true});await writeFile(temp,bytes,{flag:"wx"});await rename(temp,final)}finally{await rm(temp,{force:true})}
 return {bytes:bytes.length,sha256:hash(bytes)};
}
async function runOne(jobId:string){
 const claimed=await db.exportJob.updateMany({where:{id:jobId,OR:[{status:"QUEUED"},{status:"RUNNING",leaseUntil:{lt:new Date()}}]},data:{status:"RUNNING",startedAt:new Date(),attempts:{increment:1},leaseUntil:new Date(Date.now()+15*60*1000),currentStep:"Preparing book"}});
 if(!claimed.count)return;
 const heartbeat=setInterval(()=>{void db.exportJob.updateMany({where:{id:jobId,status:"RUNNING"},data:{leaseUntil:new Date(Date.now()+45*1000)}}).catch(()=>{})},12000);
 try{
  const done=await buildJob(jobId);
  await db.exportJob.update({where:{id:jobId},data:{status:"COMPLETE",progress:100,currentStep:"Ready to download",finishedAt:new Date(),leaseUntil:null,resultBytes:done.bytes,resultSha256:done.sha256}});
 }catch(e){
  const message=e instanceof Error?e.message:"Unknown export failure";
  await db.exportJob.update({where:{id:jobId},data:{status:message==="CANCELLED_BY_USER"?"CANCELLED":"FAILED",currentStep:message==="CANCELLED_BY_USER"?"Cancelled":"Failed",error:message.slice(0,500),finishedAt:new Date(),leaseUntil:null}});
  await rm(artifactPath(jobId),{force:true});
 }finally{clearInterval(heartbeat)}
}
export async function expireOldExportArtifacts():Promise<number>{
 const configured=Number(process.env.EXPORT_RETENTION_DAYS||7);
 const days=Number.isFinite(configured)?Math.max(1,Math.min(90,Math.trunc(configured))):7;
 const old=await db.exportJob.findMany({where:{status:"COMPLETE",finishedAt:{lt:new Date(Date.now()-days*86400000)}},take:100,select:{id:true}});
 let expired=0;
 for(const job of old){
  const changed=await db.exportJob.updateMany({where:{id:job.id,status:"COMPLETE"},data:{status:"EXPIRED",currentStep:"Download expired; generate a new package"}});
  if(!changed.count)continue;
  await rm(artifactPath(job.id),{force:true});
  expired++;
 }
 return expired;
}
export async function runExportJobBatch(maxJobs=10):Promise<number>{
 let count=0;
 for(let i=0;i<maxJobs;i++){
  const job=await db.exportJob.findFirst({where:{OR:[{status:"QUEUED"},{status:"RUNNING",leaseUntil:{lt:new Date()}}]},orderBy:{createdAt:"asc"},select:{id:true,attempts:true}});
  if(!job)break;
  if(job.attempts>=3){await db.exportJob.updateMany({where:{id:job.id,status:{in:["QUEUED","RUNNING"]}},data:{status:"FAILED",error:"Renderer interrupted repeatedly; manual retry required",finishedAt:new Date(),leaseUntil:null}});continue}
  await runOne(job.id);count++;
 }
 return count;
}
export function kickExportJobs(){
 // Only local development executes in the Next.js process. Production needs
 // a separately supervised worker running npm run export:worker.
 if(process.env.NODE_ENV==="production")return;
 if(active)return;
 active=true;
 void runExportJobBatch(10).catch(e=>console.error("Export dev worker failed",e instanceof Error?e.message:e)).finally(()=>{active=false});
}
