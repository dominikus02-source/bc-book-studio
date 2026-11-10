import {PDFDocument,PDFName,PDFNumber,rgb,type PDFObject} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import type {PaginationSettings} from "./book-pagination";

export type PaginationPart={kind:string;title:string;content:string};
export function zone(kind:string):"cover"|"front"|"main"|"back"|"backCover"{
 if(kind==="frontCover")return "cover";
 if(kind==="backCover")return "backCover";
 if(kind.startsWith("chapter-"))return "main";
 if(["titlePage","copyrightPage","preface","contentsIntro","readerGuide","dedication","figures","graphs","tables","equations"].includes(kind))return "front";
 return "back";
}
export function roman(n:number):string {
 if(!Number.isInteger(n)||n<1||n>3999)throw Error("Roman counter out of range");
 const pairs:[number,string][]=[[1000,"m"],[900,"cm"],[500,"d"],[400,"cd"],[100,"c"],[90,"xc"],[50,"l"],[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]];
 let result="";for(const [value,s] of pairs){while(n>=value){result+=s;n-=value}}return result;
}
function clean(s:string){return s.normalize("NFKC").replace(/\s+/g," ").trim().toLowerCase()}
async function pdfLines(bytes:Uint8Array){
 const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,disableFontFace:true,verbosity:0});
 try{
  const doc=await task.promise, pages:Array<{top:string;all:string}>=[];
  for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i),viewport=page.getViewport({scale:1});
   const text=await page.getTextContent();
   const items=text.items.filter((item):item is typeof item&{str:string;transform:number[]}=>"str" in item && "transform" in item);
   const top=items.filter(item=>item.transform[5]>viewport.height*.57).map(item=>item.str).join(" ");
   pages.push({top:clean(top),all:clean(items.map(item=>item.str).join(" "))});
   page.cleanup();
  }
  return pages;
 }finally{await task.destroy()}
}
/** Map PDF section starts using the printed section headings, not estimated word counts. Fail closed on ambiguous mapping. */
export async function paginatePdf(bytes:Uint8Array,parts:PaginationPart[],config:PaginationSettings,chapterFolios?:Map<string,string>):Promise<Uint8Array>{
 if(parts.length===0)return bytes;
 const pages=await pdfLines(bytes);
 const anchors:number[]=[];
 let from=0;
 for(let i=0;i<parts.length;i++){
  const title=clean(parts[i].title);
  // Quarto headings are printed near the page top; a heading inside the contents is not a section anchor.
  const matches:number[]=[];
  for(let p=from;p<pages.length;p++){
   if(pages[p].top.includes(title))matches.push(p);
  }
  if(!matches.length)throw Error("Pagination section anchor not found: "+parts[i].kind);
  const chosen=i===0?matches[0]:matches.find(p=>p>anchors[i-1]);
  if(chosen===undefined)throw Error("Ambiguous pagination section order: "+parts[i].kind);
  if(i>0&&chosen===anchors[i-1])throw Error("Section page break missing: "+parts[i].kind);
  anchors.push(chosen);from=chosen+1;
 }
 const pdf=await PDFDocument.load(bytes);
 const out=await PDFDocument.create();
 out.setTitle(pdf.getTitle()||"BC Book Studio");
 out.setCreator("BC Book Studio pagination engine");
 // Standard PDF Type 1 fonts are not embedded; use licensed TTFs so preflight succeeds.
 out.registerFontkit(fontkit);
 const [regularBytes,boldBytes]=await Promise.all([
  readFile(join(process.cwd(),"node_modules","katex","dist","fonts","KaTeX_Main-Regular.ttf")),
  readFile(join(process.cwd(),"node_modules","katex","dist","fonts","KaTeX_Main-Bold.ttf")),
 ]);
 const font=await out.embedFont(regularBytes,{subset:true});
 const bold=await out.embedFont(boldBytes,{subset:true});
 const classifications=pages.map((_,i)=>{
  let index=0;for(let j=1;j<anchors.length;j++)if(anchors[j]<=i)index=j;
  return {part:parts[index],z:zone(parts[index].kind),opener:i===anchors[index]};
 });
 // The covers are outside the interior bookblock. Recto means odd interior physical sheet page.
 let interior=0,front=0,arabic=0;
 const emitted:Array<{zone:ReturnType<typeof zone>;folio:string;opener:boolean;part:PaginationPart;interior:number}>=[];
 for(let i=0;i<pages.length;i++){
  const meta=classifications[i];
  if(config.chapterStart==="recto"&&meta.opener&&meta.z==="main"&&interior%2===1){
   const [blank]=await out.copyPages(pdf,[i]);
   const empty=out.addPage([blank.getWidth(),blank.getHeight()]);
   // Blank verso intentionally has no printed folio, but is counted in the bookblock.
   interior++;if(arabic>0)arabic++;
   emitted.push({zone:"main",folio:"",opener:false,part:meta.part,interior});
  }
  const [copy]=await out.copyPages(pdf,[i]);out.addPage(copy);
  let label="";
  if(meta.z==="front"){interior++;front++;label=config.frontMatter==="lowerRoman"?roman(front):String(front)}
  else if(meta.z==="main"){interior++;if(meta.opener&&arabic===0)arabic=1;else arabic++;label=String(arabic)}
  else if(meta.z==="back"){interior++;arabic++;label=String(arabic)}
  if(meta.z==="main"&&label){
   const chapter=meta.part.kind.slice("chapter-".length);
   for(const match of pages[i].all.matchAll(/\b(gambar|grafik|tabel|persamaan|bagian)\s+(\d+(?:\.\d+)+)(?![\d.])/g)){
    if(match[2].split(".")[0]!==chapter)continue;
    const key=match[1][0].toUpperCase()+match[1].slice(1)+" "+match[2];
    if(!chapterFolios?.has(key))chapterFolios?.set(key,label);
   }
  }
  emitted.push({zone:meta.z,folio:label,opener:meta.opener,part:meta.part,interior});
 }
 for(const entry of emitted){
  if(entry.opener&&entry.folio)chapterFolios?.set(entry.part.kind,entry.folio);
 }
 // PDF PageLabels are zero-based physical pages; encode cover and separate front/main runs.
 const starts:Array<{index:number;style:"r"|"D"|null;prefix?:string;start?:number}>=[];
 for(let i=0;i<emitted.length;i++){
  const curr=emitted[i],prev=emitted[i-1];
  const prevType=prev?.zone==="front"?"r":prev?.zone==="main"||prev?.zone==="back"?"D":null;
  const type=curr.zone==="front"?"r":curr.zone==="main"||curr.zone==="back"?"D":null;
  if(i===0||type!==prevType){
   starts.push({index:i,style:type,prefix:type===null?(curr.zone==="cover"?"Cover ":"Back cover "):undefined,start:curr.folio?curr.zone==="front"?frontCounterAt(emitted,i):Number(curr.folio):undefined});
  }
 }
 const nums:PDFObject[]=[];
 for(const range of starts){
  const entry:Record<string,PDFObject>={};
  if(range.style)entry.S=PDFName.of(range.style);
  if(range.prefix)entry.P=out.context.obj(range.prefix);
  if(range.start)entry.St=PDFNumber.of(range.start);
  nums.push(PDFNumber.of(range.index),out.context.obj(entry));
 }
 out.catalog.set(PDFName.of("PageLabels"),out.context.obj({Nums:nums}));
 out.getPages().forEach((page,i)=>{
  const meta=emitted[i];
  if(!meta.folio)return;
  if(meta.opener&&meta.zone==="front"&&["titlePage","copyrightPage"].includes(meta.part.kind))return;
  if(meta.opener&&meta.zone!=="front"&&config.chapterOpeningFolio==="hidden")return;
  const {width,height}=page.getSize();
  // Clear potentially duplicated renderer footer without altering the content rectangle.
  page.drawRectangle({x:0,y:0,width,height:31,color:rgb(1,1,1)});
  const open=meta.opener&&meta.zone!=="front";
  const size=9.2;
  const tw=font.widthOfTextAtSize(meta.folio,size);
  let x=(width-tw)/2;
  if(!open||config.chapterOpeningFolio==="outer"){
   if(config.normalFolioPosition==="outer"){
    x=meta.interior%2===0?42:width-tw-42;
   }else if(config.normalFolioPosition==="center")x=(width-tw)/2;
  }
  const y=!open&&config.normalFolioPosition==="top"?height-26:19;
  page.drawText(meta.folio,{x,y,size,font:open?bold:font,color:rgb(.19,.22,.27)});
  if(config.footerText){
   const size=8, text=config.footerText;
   page.drawText(text,{x:Math.max(20,(width-font.widthOfTextAtSize(text,size))/2),y:7,size,font,color:rgb(.38,.4,.43)});
  }
  if(config.runningHeaders&&!open&&meta.zone!=="front"){
   const heading=config.headerText||(meta.interior%2===0?"BC Book Studio":meta.part.title);
   const trimmed=heading.slice(0,70);
   const wt=font.widthOfTextAtSize(trimmed,8);
   page.drawText(trimmed,{x:meta.interior%2===0?42:width-wt-42,y:height-24,size:8,font,color:rgb(.38,.4,.43)});
  }
 });
 return new Uint8Array(await out.save());
}
function frontCounterAt(entries:Array<{zone:ReturnType<typeof zone> }>,end:number){
 return entries.slice(0,end+1).filter(x=>x.zone==="front").length;
}
