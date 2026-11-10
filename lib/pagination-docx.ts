import JSZip from "jszip";
import type {PaginationSettings} from "./book-pagination";
import {zone,type PaginationPart} from "./pagination-output";

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]||c));
const plain=(s:string)=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,x=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"}[x]||x)).replace(/\s+/g," ").trim().toLowerCase();
function pageField(){return '<w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>'}
function footer(where:"left"|"center"|"right",text?:string){
 const p=where==="center"?"center":where;
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="'+p+'"/></w:pPr>'+pageField()+'</w:p>'+(text?'<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>'+esc(text)+'</w:t></w:r></w:p>':'')+'</w:ftr>';
}
function header(contents:string){
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">'+esc(contents)+'</w:t></w:r></w:p></w:hdr>';
}
function sectionProps(part:PaginationPart,settings:PaginationSettings,firstFront:boolean,firstMain:boolean,geometry:string){
 const z=zone(part.kind);
 const start=part.kind.startsWith("chapter-")&&settings.chapterStart==="recto"?"oddPage":"nextPage";
 const props=['<w:sectPr>'];
 const noFolio=z==="cover"||z==="backCover";
 const frontHidden=z==="front"&&["titlePage","copyrightPage"].includes(part.kind);
 const opener=z==="main"||z==="back";
 const firstHidden=frontHidden||(opener&&settings.chapterOpeningFolio==="hidden");
 const special=frontHidden||(opener&&settings.chapterOpeningFolio!=="outer");
 if(!noFolio){
  if(settings.runningHeaders&&z!=="front"){
   props.push('<w:headerReference w:type="default" r:id="rIdBcHeaderOdd"/>');
   props.push('<w:headerReference w:type="even" r:id="rIdBcHeaderEven"/>');
  }
  props.push('<w:footerReference w:type="default" r:id="rIdBcFolioOdd"/>');
  props.push('<w:footerReference w:type="even" r:id="rIdBcFolioEven"/>');
  if(special&&!firstHidden)props.push('<w:footerReference w:type="first" r:id="rIdBcFolioFirst"/>');
 }
 props.push('<w:type w:val="'+start+'"/>',geometry);
 if(!noFolio){
  if(z==="front")props.push('<w:pgNumType w:fmt="lowerRoman"'+(firstFront?' w:start="1"':'')+'/>');
  else props.push('<w:pgNumType w:fmt="decimal"'+(firstMain?' w:start="1"':'')+'/>');
  if(special)props.push('<w:titlePg/>');
 }
 props.push('</w:sectPr>');
 return props.join("");
}
/** Real Word sections with PAGE fields. A word processor computes final physical folios on layout. */
export async function paginateDocx(bytes:Uint8Array,parts:PaginationPart[],settings:PaginationSettings,bookTitle:string):Promise<Uint8Array>{
 if(!parts.length)return bytes;
 const zip=await JSZip.loadAsync(bytes);
 const file=zip.file("word/document.xml");
 if(!file)throw Error("DOCX document.xml unavailable");
 const original=await file.async("string");
 const bodyEnd=original.lastIndexOf("</w:body>");
 if(bodyEnd<0)throw Error("DOCX body missing");
 const paragraphs=[...original.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
 let last=-1;
 const anchors:number[]=[];
 for(const part of parts){
  const expected=plain(part.title);
  const found=paragraphs.find((p,i)=>{
   if(i<=last||p.index!<0||p.index!>=bodyEnd)return false;
   const value=plain([...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join(""));
   const style=/<w:pStyle\b[^>]*w:val="[^"]*(?:Heading|heading|Title|title)[^"]*"/.test(p[0]);
   return style&&value===expected;
  });
  if(!found)throw Error("DOCX pagination anchor missing: "+part.kind);
  const index=paragraphs.indexOf(found);if(index<=last)throw Error("DOCX section order invalid");
  anchors.push(found.index!);last=index;
 }
 const oldSection=original.match(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g)?.at(-1);
 if(!oldSection)throw Error("DOCX geometry section missing");
 const geometry=(oldSection.match(/<w:pgSz\b[^>]*\/>/)?.[0]||"")+(oldSection.match(/<w:pgMar\b[^>]*\/>/)?.[0]||"");
 if(!geometry.includes("w:pgSz"))throw Error("DOCX size missing");
 const prefix=original.slice(0,bodyEnd);
 const withoutFinal=prefix.endsWith(oldSection)?prefix.slice(0,-oldSection.length):prefix.replace(oldSection,"");
 if(withoutFinal===prefix)throw Error("DOCX final section not at end");
 let output="",offset=0;
 let startedFront=false,startedMain=false;
 for(let i=0;i<parts.length;i++){
  const start=anchors[i];
  if(i>0){
   const prev=parts[i-1],z=zone(prev.kind);
   const props=sectionProps(prev,settings,z==="front"&&!startedFront,z==="main"&&!startedMain,geometry);
   if(z==="front")startedFront=true;if(z==="main")startedMain=true;
   output+=withoutFinal.slice(offset,start)+'<w:p><w:pPr>'+props+'</w:pPr></w:p>';
  }else output+=withoutFinal.slice(0,start);
  offset=start;
 }
 const lastPart=parts.at(-1)!;
 output+=withoutFinal.slice(offset)+sectionProps(lastPart,settings,zone(lastPart.kind)==="front"&&!startedFront,zone(lastPart.kind)==="main"&&!startedMain,geometry);
 const xmlns=' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
 let docXml=output+original.slice(bodyEnd);
 if(!docXml.includes('xmlns:r='))docXml=docXml.replace("<w:document","<w:document"+xmlns);
 zip.file("word/document.xml",docXml);
 const relations=[
  ["rIdBcFolioOdd","footer","footer-bc-odd.xml"],
  ["rIdBcFolioEven","footer","footer-bc-even.xml"],
  ["rIdBcFolioFirst","footer","footer-bc-first.xml"],
  ["rIdBcHeaderOdd","header","header-bc-odd.xml"],
  ["rIdBcHeaderEven","header","header-bc-even.xml"],
 ];
 const relFile=zip.file("word/_rels/document.xml.rels");
 if(!relFile)throw Error("DOCX relationships missing");
 let rels=await relFile.async("string");
 for(const [id,type,target] of relations){
  if(rels.includes('Id="'+id+'"'))throw Error("DOCX relation collision");
  rels=rels.replace("</Relationships>",'<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/></Relationships>');
 }
 zip.file("word/_rels/document.xml.rels",rels);
 zip.file("word/footer-bc-odd.xml",footer(settings.normalFolioPosition==="center"?"center":"right",settings.footerText));
 zip.file("word/footer-bc-even.xml",footer(settings.normalFolioPosition==="center"?"center":"left",settings.footerText));
 zip.file("word/footer-bc-first.xml",footer("center",settings.footerText));
 zip.file("word/header-bc-odd.xml",header(settings.headerText||bookTitle));
 zip.file("word/header-bc-even.xml",header(settings.headerText||"BC Book Studio"));
 let types=await zip.file("[Content_Types].xml")?.async("string");
 if(!types)throw Error("DOCX content type map missing");
 for(const [,type,target] of relations){
  const key="/word/"+target;
  if(!types.includes(key))types=types.replace("</Types>",'<Override PartName="'+key+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+type+'+xml"/></Types>');
 }
 zip.file("[Content_Types].xml",types);
 const settingsFile=zip.file("word/settings.xml");
 if(settingsFile){
  let xml=await settingsFile.async("string");
  if(!xml.includes("evenAndOddHeaders"))xml=xml.replace("</w:settings>",'<w:evenAndOddHeaders/></w:settings>');
  if(!xml.includes("updateFields"))xml=xml.replace("</w:settings>",'<w:updateFields w:val="true"/></w:settings>');
  zip.file("word/settings.xml",xml);
 }
 return new Uint8Array(await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
}
