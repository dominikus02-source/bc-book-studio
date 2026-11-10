import {marked, type Token} from "marked";
import sanitizeHtml from "sanitize-html";

export type Block={kind:"heading"|"paragraph"|"bullet"|"number"|"quote"|"code"|"table"|"rule";text:string;level?:number;cells?:string[][]};
const plain=(value:string)=>value.replace(/<[^>]+>/g,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/!\[([^\]]*)\]\([^)]+\)/g,"$1").replace(/\*\*|__|~~|\*|_/g,"").trim();
export function manuscriptBlocks(markdown:string):Block[]{
 const out:Block[]=[];
 function collect(tokens:Token[]){
  for(const t of tokens){
   switch(t.type){
    case "heading":out.push({kind:"heading",level:t.depth,text:plain(t.text)});break;
    case "paragraph":case "text":out.push({kind:"paragraph",text:plain(t.text)});break;
    case "blockquote":out.push({kind:"quote",text:plain(t.text)});break;
    case "code":out.push({kind:"code",text:t.text});break;
    case "hr":out.push({kind:"rule",text:""});break;
    case "list":{
     let n=t.start||1;
     for(const item of t.items){out.push({kind:t.ordered?"number":"bullet",text:plain(item.text),level:t.ordered?n++:undefined});}
     break;
    }
    case "table":
     out.push({kind:"table",text:"",cells:[t.header.map((c:{text:string})=>plain(c.text)),...t.rows.map((row:{text:string}[])=>row.map((c:{text:string})=>plain(c.text)))]});
     break;
    case "space":break;
    default:if("text" in t&&typeof t.text==="string")out.push({kind:"paragraph",text:plain(t.text)});
   }
  }
 }
 collect(marked.lexer(markdown,{gfm:true,breaks:false}));
 return out.filter(b=>b.kind==="rule"||b.kind==="table"||b.text.length>0);
}
export function manuscriptHtml(markdown:string):string{
 return sanitizeHtml(marked.parse(markdown,{async:false,gfm:true}),{
  allowedTags:["p","h1","h2","h3","h4","h5","h6","strong","em","b","i","del","ul","ol","li","blockquote","code","pre","table","thead","tbody","tr","th","td","a","hr","br"],
  allowedAttributes:{a:["href","title"]},allowedSchemes:["https","http","mailto"]
 });
}
export const escapeXml=(text:string)=>text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
export function docxBody(blocks:Block[]):string{
 const run=(s:string)=>'<w:r><w:t xml:space="preserve">'+escapeXml(s)+'</w:t></w:r>';
 const para=(s:string,style?:string,indent?:boolean)=>'<w:p>'+ (style?'<w:pPr><w:pStyle w:val="'+style+'"/>'+(indent?'<w:ind w:left="720" w:hanging="360"/>':'')+'</w:pPr>':"") +run(s)+'</w:p>';
 return blocks.map(b=>{
  if(b.kind==="table"){
   return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>'+ (b.cells||[]).map(row=>'<w:tr>'+row.map(cell=>'<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>'+para(cell)+'</w:tc></w:tr>').join("")+'</w:tr>').join("")+'</w:tbl>';
  }
  if(b.kind==="rule")return para("────────────────────────");
  if(b.kind==="heading")return para(b.text,"Heading"+Math.min(b.level||2,6));
  if(b.kind==="bullet")return para("• "+b.text,"ListParagraph",true);
  if(b.kind==="number")return para(String(b.level||1)+". "+b.text,"ListParagraph",true);
  if(b.kind==="quote")return para(b.text,"Quote",true);
  if(b.kind==="code")return para(b.text,"Code");
  return para(b.text,"Normal");
 }).join("");
}
export const docxStyles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
 '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>'+
 Array.from({length:6},(_,i)=>'<w:style w:type="paragraph" w:styleId="Heading'+(i+1)+'"><w:name w:val="heading '+(i+1)+'"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="'+(36-i*3)+'"/></w:rPr></w:style>').join("")+
 '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:rPr><w:i/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style></w:styles>';
