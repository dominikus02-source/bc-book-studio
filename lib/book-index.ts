import {parseBlockLayout} from "./book-block-layout";
import type {PaginationSettings} from "./book-pagination";
type Leader=PaginationSettings["listLeader"];

type Entry = {number:string; title:string; line:number};
type ChapterIndex = {sections:Entry[]; figures:Entry[]; graphs:Entry[]; tables:Entry[]; equations:Entry[]};
type Chapter = {title:string;content:string};

function plain(text:string) {
 return text.replace(/\{#[^}]*\}/g,"").replace(/[\r\n\\<>\[\]*_\u0060]/g," ").replace(/\s+/g," ").trim();
}
export function indexChapter(content:string, chapterNumber:number):ChapterIndex {
 const index:ChapterIndex={sections:[],figures:[],graphs:[],tables:[],equations:[]};
 const levels=[0,0];
 const lines=content.replace(/\r\n?/g,"\n").split("\n");
 let code="", math=false, mathStart=0;
 const divisions:boolean[]=[];
 function add(kind:keyof ChapterIndex,title:string,line:number) {
  const entries=index[kind];
  entries.push({number:chapterNumber+"."+(entries.length+1),title:plain(title),line});
 }
 for(let i=0;i<lines.length;i++) {
  const line=lines[i];
  const fence=/^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
  if(code) {
   if(fence&&fence[1][0]===code[0]&&fence[1].length>=code.length&&!fence[2].trim()) code="";
   continue;
  }
  if(fence){code=fence[1];continue}
  if(line.trimStart().startsWith("$$")||math) {
   if(!math)mathStart=i;
   const delimiters=(line.match(/\$\$/g)||[]).length;
   const label=/\$\$[ \t]*\{#eq-([a-z0-9_-]+)\}/i.exec(line);
   if(label) add("equations",label[1].replace(/[-_]+/g," "),mathStart);
   if(delimiters%2) math=!math;
   continue;
  }
  if(/^:::\s*\{/.test(line)){divisions.push(!parseBlockLayout(line));continue}
  if(/^:::\s*$/.test(line)){divisions.pop();continue}
  const heading=/^ {0,3}(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
  if(heading&&!divisions.includes(true)){
   const depth=heading[1].length-2;
   if(depth===0){levels[0]++;levels[1]=0}else{if(!levels[0])levels[0]=1;levels[1]++}
   index.sections.push({number:[chapterNumber,...levels.slice(0,depth+1)].join("."),title:plain(heading[2]),line:i});
  }
  const visible=line.replace(/\x60+[^\x60]*\x60+/g,"");
  for(const image of visible.matchAll(/!\[([^\]\n]*)\]\(asset:[a-z0-9]{6,100}\)/gi)) add(/^(?:grafik|graph)\b/i.test(image[1].trim())?"graphs":"figures",image[1]||"Ilustrasi",i);
  if(!line.includes("|")||!/^ {0,3}\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1]??""))continue;
  let end=i+2;
  while(end<lines.length&&lines[end].trim()&&lines[end].includes("|"))end++;
  while(end<lines.length&&!lines[end].trim())end++;
  const caption=/^:\s+(.+)/.exec(lines[end]??"");
  add("tables",caption?.[1]||line.split("|").map(cell=>cell.trim()).filter(Boolean).join(" / "),i);
 }
 return index;
}

export function addChapterFolios(contents:string, folios:ReadonlyMap<string,string>, parts:readonly {kind:string;title:string}[],leader:Leader) {
 const notesStart=contents.indexOf("\n\n## Catatan penulis");
 const generated=notesStart<0?contents:contents.slice(0,notesStart);
 const notes=notesStart<0?"":contents.slice(notesStart);
 const front=parts.filter(part=>["titlePage","copyrightPage","preface","figures","graphs","tables","equations","readerGuide"].includes(part.kind)&&folios.has(part.kind));
 const entries=front.map(part=>appendFolio("**"+part.title+"**",folios.get(part.kind),leader));
 return (entries.length?entries.join("\n\n")+"\n\n":"")+generated.replace(/^\*\*Bab (\d+) — (.+)\*\*$/gm,(line,number)=>{
  const folio=folios.get("chapter-"+number);
  return appendFolio(line,folio,leader);
 })+notes;
}

export function automaticBookLists(chapters:Chapter[]) {
 const indexes=chapters.map((chapter,i)=>indexChapter(chapter.content,i+1));
 const contents=chapters.flatMap((chapter,i)=>[
  "**Bab "+(i+1)+" — "+plain(chapter.title.replace(/^Bab\s+\d+\s*[-–—:]?\s*/i,""))+"**",
  ...indexes[i].sections.map(entry=>entry.number+" — "+entry.title),
 ]).join("\n\n");
 const lists=(["figures","graphs","tables","equations"] as const).flatMap(kind=>{
  const entries=indexes.flatMap(index=>index[kind]);
  if(!entries.length)return [];
  const label={figures:"Gambar",graphs:"Grafik",tables:"Tabel",equations:"Persamaan"}[kind];
  return [{kind,title:"Daftar "+label,content:entries.map(entry=>label+" "+entry.number+" — "+entry.title).join("\n\n")}];
 });
 return {contents,lists};
}

export const indexedLabels={figures:"Gambar",graphs:"Grafik",tables:"Tabel",equations:"Persamaan",sections:"Bagian"} as const;

export function markPdfEntries(content:string, chapter:number){
 const index=indexChapter(content,chapter);
 const labels=new Map<number,string[]>();
 for(const kind of Object.keys(indexedLabels) as (keyof ChapterIndex)[]){
  for(const entry of index[kind]){
   const list=labels.get(entry.line)??[];
   list.push(indexedLabels[kind]+" "+entry.number);
   labels.set(entry.line,list);
  }
 }
 const fence=String.fromCharCode(96).repeat(3);
 return content.replace(/\r\n?/g,"\n").split("\n").map((line,i)=>{
  const text=labels.get(i);
  if(!text)return line;
  return "\n"+fence+"{=typst}\n#block(sticky: true)[#text(size: 8pt)[" +text.join(" / ")+"]]\n"+fence+"\n\n"+line;
 }).join("\n");
}

export function addEntryFolios(kind:string, content:string, folios:ReadonlyMap<string,string>,leader:Leader){
 if(kind==="contentsIntro"){
  const stop=content.indexOf("\n\n## Catatan penulis");
  const list=stop<0?content:content.slice(0,stop);
  return list.replace(/^(\d+(?:\.\d+)+) [^\n]+$/gm,(line,n)=>appendFolio(line,folios.get("Bagian "+n),leader))+(stop<0?"":content.slice(stop));
 }
 if(!["figures","graphs","tables","equations"].includes(kind))return content;
 return content.replace(/^(Gambar|Grafik|Tabel|Persamaan) (\d+\.\d+) [^\n]+$/gm,(line,label,n)=>appendFolio(line,folios.get(label+" "+n),leader));
}

function appendFolio(line:string,folio:string|undefined,leader:Leader){
 if(!folio||!/^(?:\d+|[ivxlcdm]+)$/.test(folio))return line;
 const fill=leader==="empty"?"#h(1fr)":("#box(width: 1fr)[#repeat(gap: 2pt)["+ (leader==="dashes"?"-":".")+"]]");
 const tick=String.fromCharCode(96);
 return line+" "+tick+"#h(4pt)"+fill+"#h(4pt)#box["+folio+"]"+tick+"{=typst}";
}
