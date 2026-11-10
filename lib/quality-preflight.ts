import {PDFDocument} from "pdf-lib";
import {existsSync} from "node:fs";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawn} from "node:child_process";
import {paperSpec,mmToPt} from "./paper-sizes";
export type ValidatorOutcome={status:"PASS"|"FAIL"|"NOT_RUN";validator:string;version?:string;summary:string;observations?:string[]};
function execute(cmd:string,args:string[],timeoutMs=45000):Promise<{code:number;out:string}>{
 return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{stdio:["ignore","pipe","pipe"],windowsHide:true});
  let output="";p.stdout.on("data",b=>output=(output+b.toString()).slice(-10000));
  p.stderr.on("data",b=>output=(output+b.toString()).slice(-10000));
  const timer=setTimeout(()=>{p.kill("SIGKILL");reject(Error("Validator timeout"))},timeoutMs);
  p.on("error",e=>{clearTimeout(timer);reject(e)});
  p.on("close",code=>{clearTimeout(timer);resolve({code:code??-1,out:output})});
 });
}
export async function validatePdfGeometry(bytes:Uint8Array,paperId:string):Promise<{pages:number;paper:string;checks:string[]}>{
 const spec=paperSpec(paperId);if(!spec)throw Error("Invalid size");
 const pdf=await PDFDocument.load(bytes,{ignoreEncryption:true});
 const pages=pdf.getPages();if(!pages.length||pages.length>3000)throw Error("Invalid PDF page count");
 for(const [i,page] of pages.entries()){
  const actual=page.getSize(),target={width:mmToPt(spec.widthMm),height:mmToPt(spec.heightMm)};
  if(Math.abs(actual.width-target.width)>1.2||Math.abs(actual.height-target.height)>1.2)throw Error("PDF physical size mismatch on page "+(i+1));
 }
 return {pages:pages.length,paper:paperId,checks:["PDF syntax parsed","All page sizes match selected paper"]};
}
export async function epubcheck(bytes:Uint8Array):Promise<ValidatorOutcome>{
 const defaultJar=resolve(process.cwd(),"tools/validators/epubcheck-5.4.0/epubcheck-5.4.0/epubcheck.jar");
 const jar=process.env.EPUBCHECK_JAR||defaultJar;
 if(!existsSync(jar))return {status:"NOT_RUN",validator:"EPUBCheck",summary:"EPUBCHECK_JAR not configured or installed"};
 const root=await mkdtemp(join(tmpdir(),"bc-epubcheck-"));
 try{
  const src=join(root,"book.epub");await writeFile(src,bytes);
  const result=await execute(process.env.JAVA_BIN||"java",["-jar",jar,src],60000);
  return {status:result.code===0?"PASS":"FAIL",validator:"EPUBCheck",version:"5.4.0",summary:result.out.slice(-1500)};
 }catch(e){
  return {status:"NOT_RUN",validator:"EPUBCheck",summary:e instanceof Error?e.message:"Validator unavailable"};
 }finally{await rm(root,{recursive:true,force:true})}
}
export async function veraPdfPreflight(bytes:Uint8Array):Promise<ValidatorOutcome>{
 const cmd=process.env.VERAPDF_BIN;
 if(!cmd)return {status:"NOT_RUN",validator:"veraPDF",summary:"VERAPDF_BIN belum dikonfigurasi; sertifikasi PDF/UA belum diuji"};
 const profile=process.env.VERAPDF_FLAVOUR||"ua1";
 if(!["ua1","ua2","1b","2u","3u","4"].includes(profile))return {status:"NOT_RUN",validator:"veraPDF",summary:"PDF validation profile tidak dikenal"};
 const root=await mkdtemp(join(tmpdir(),"bc-verapdf-"));
 try{
  const filename=join(root,"publication.pdf");await writeFile(filename,bytes);
  const result=await execute(cmd,["--flavour",profile,"--format","xml",filename],75000);
  const passed=/isCompliant="true"/.test(result.out)&&!/isCompliant="false"/.test(result.out);
  const failed=/isCompliant="false"/.test(result.out);
  return {status:passed&&result.code===0?"PASS":failed?"FAIL":"NOT_RUN",validator:"veraPDF",version:profile,summary:result.out.slice(-2500)};
 }catch(e){return {status:"NOT_RUN",validator:"veraPDF",summary:e instanceof Error?e.message:"Validator unavailable"}}
 finally{await rm(root,{recursive:true,force:true})}
}
export async function fontPreflight(bytes:Uint8Array):Promise<ValidatorOutcome>{
 const root=await mkdtemp(join(tmpdir(),"bc-pdffonts-"));
 try{
  const target=join(root,"document.pdf");await writeFile(target,bytes);
  const r=await execute(process.env.PDFFONTS_BIN||"pdffonts",[target],15000);
  if(r.code!==0)return {status:"FAIL",validator:"Poppler pdffonts",summary:r.out.slice(-1000)};
  const lines=r.out.split(/\r?\n/).filter(x=>x.trim());
  const header=lines.findIndex(x=>/\bemb\s+sub\s+uni\b/.test(x));
  if(header<0)return {status:"NOT_RUN",validator:"Poppler pdffonts",summary:"Unknown font table columns"};
  const fonts=lines.slice(header+2);
  // Parse the final 3 yes/no columns from the right. Long PostScript font names
  // exceed Poppler's nominal column width, so slicing at the header position is unsafe.
  const observations=fonts.map(row=>({row,match:row.match(/\s(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/)}));
  if(observations.some(x=>!x.match))return {status:"NOT_RUN",validator:"Poppler pdffonts",summary:"Could not reliably parse every font row"};
  const nonEmbedded=observations.filter(x=>x.match?.[1]!=="yes").map(x=>x.row);
  return {status:nonEmbedded.length?"FAIL":"PASS",validator:"Poppler pdffonts",summary:fonts.length+" font rows inspected",observations:nonEmbedded.map(x=>x.slice(0,130))};
 }catch(e){return {status:"NOT_RUN",validator:"Poppler pdffonts",summary:e instanceof Error?e.message:"Validator unavailable"}}
 finally{await rm(root,{recursive:true,force:true})}
}
export async function rasterResolutionPreflight(bytes:Uint8Array):Promise<ValidatorOutcome>{
 const root=await mkdtemp(join(tmpdir(),"bc-pdfimages-"));
 try{
  const file=join(root,"document.pdf");
  await writeFile(file,bytes);
  const result=await execute(process.env.PDFIMAGES_BIN||"pdfimages",["-list",file],15000);
  if(result.code!==0||!/\bx-ppi\s+y-ppi\b/.test(result.out))return {status:"NOT_RUN",validator:"Poppler pdfimages",summary:"Effective image resolution unavailable"};
  const images=result.out.split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(row=>/^\d+$/.test(row[0])&&row[2]==="image");
  if(images.some(row=>!Number(row[12])||!Number(row[13])))return {status:"NOT_RUN",validator:"Poppler pdfimages",summary:"Could not read effective image resolution"};
  const lowest=Math.min(...images.flatMap(row=>[Number(row[12]),Number(row[13])]));
  return {status:"PASS",validator:"Poppler pdfimages",summary:images.length?images.length+" raster placements measured; lowest "+lowest+" PPI; compare with printer requirements":"No raster images"};
 }catch(e){return {status:"NOT_RUN",validator:"Poppler pdfimages",summary:e instanceof Error?e.message:"Validator unavailable"}}
 finally{await rm(root,{recursive:true,force:true})}
}
