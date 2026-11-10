import {marked} from "marked";
import sanitizeHtml from "sanitize-html";
import katex from "katex";
import {prepareSidebarHtml} from "./book-sidebar";
import {prepareMediaHtml} from "./book-media";

type BookChapter={title:string;content:string};
function esc(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
const typeLabels:Record<string,string>={note:"Catatan",tip:"Tips",important:"Penting",warning:"Perhatian",caution:"Hati-hati"};
export function cleanAlignmentArtifacts(markdown:string):string {
 return markdown.split(/(^[ \t]*(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*(?:`{3,}|~{3,})[ \t]*(?=\n|$))/gm).map((part,index)=>{
  if(index%2)return part;
  return part.replace(/^([^\n]+?):::[ \t]*\{style="text-align:[ \t]*(left|center|right)"\}[ \t]*(.*?)[ \t]*:::[ \t]*$/gm,
   (_match,prefix,alignment,body)=>prefix.trimEnd()+"\n\n"+'::: {style="text-align: '+alignment+'"}\n'+body+"\n:::")
   .replace(/^[ \t]*(?:&#x20;|&#32;|&nbsp;)+[ \t]*$/gim,"");
 }).join("");
}
export type PreviewEditingTarget={chapterIndex:number;raw:string;occurrence:number;label:string;id?:string};
export type PreviewBlockLink={chapterIndex:number;id:string;raw:string;label:string};
export function renderBookPreview(chapters:BookChapter[],bookId:string,editing?:PreviewEditingTarget,blockLinks?:PreviewBlockLink[]):string{
 return chapters.map((chapter,chapterIndex)=>{
  let source=chapter.content.replace(/\r\n?/g,"\n");
  const links=(blockLinks??[]).filter(item=>item.chapterIndex===chapterIndex);
  const ranges:{start:number;end:number;link:PreviewBlockLink;index:number}[]=[];
  let linkCursor=0;
  for(const link of links){
   const raw=link.raw.replace(/\r\n?/g,"\n").trim();if(!raw)continue;
   const start=source.indexOf(raw,linkCursor);if(start<0)continue;
   ranges.push({start,end:start+raw.length,link,index:ranges.length});linkCursor=start+raw.length;
  }
  for(const range of [...ranges].reverse())source=source.slice(0,range.start)+"\n\nBCPREVIEWSTART"+range.index+"TOKEN\n\n"+source.slice(range.start,range.end)+"\n\nBCPREVIEWEND"+range.index+"TOKEN\n\n"+source.slice(range.end);
  let editingFound=false;
  if(!blockLinks&&editing?.chapterIndex===chapterIndex&&editing.raw.trim()){
   const needle=editing.raw.replace(/\r\n?/g,"\n");
   let start=-1,cursor=0;
   for(let n=0;n<=editing.occurrence;n++){start=source.indexOf(needle,cursor);if(start<0)break;cursor=start+needle.length}
   if(start>=0){source=source.slice(0,start)+"\n\nBCEDITINGSTARTTOKEN\n\n"+source.slice(start,start+needle.length)+"\n\nBCEDITINGENDTOKEN\n\n"+source.slice(start+needle.length);editingFound=true}
  }
  const sidebar=prepareSidebarHtml(source);source=sidebar.markdown;
  const media=prepareMediaHtml(source,id=>"/api/books/"+encodeURIComponent(bookId)+"/assets/"+encodeURIComponent(id));source=media.source;
  const replacements:string[]=[];
  const stash=(html:string)=>{const id=replacements.length;replacements.push(html);return "\n\nBOOKSPECIALTOKEN"+id+"END\n\n"};
  source=source.replace(/^::: \{style="text-align: (left|center|right)"\}[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm,(_match,alignment,body)=>
   stash('<div style="text-align:'+alignment+'">'+String(marked.parse(body,{async:false}))+"</div>"));
  const figures=new Map<string,string>(),tables=new Map<string,string>();
  let figureNum=0,tableNum=0;
  source=source.replace(/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)\s*\{#(fig-[a-z0-9-]+)\}/gi,(_match,alt,id,label)=>{
   figureNum++;figures.set(label,"Gambar "+figureNum);
   return stash('<figure class="book-figure"><img src="/api/books/'+encodeURIComponent(bookId)+'/assets/'+encodeURIComponent(id)+'" alt="'+esc(alt)+'"/><figcaption>Gambar '+figureNum+'. '+esc(alt)+'</figcaption></figure>');
  });
  source=source.replace(/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)/gi,(_match,alt,id)=>"!["+alt+"](/api/books/"+encodeURIComponent(bookId)+"/assets/"+encodeURIComponent(id)+")");
  source=source.replace(/\n: ([^\n]+)\s+\{#(tbl-[a-z0-9-]+)\}/gi,(_match,cap,label)=>{
   tableNum++;tables.set(label,"Tabel "+tableNum);
   return stash('<p class="book-table-caption">Tabel '+tableNum+'. '+esc(cap)+'</p>');
  });
  source=source.replace(/^:::\s*\{\.callout-(note|tip|important|warning|caution)[^}]*\}\s*\n([\s\S]*?)\n:::\s*$/gm,(_match,kind,body)=>{
   const head=/^#{1,4}\s+(.+)\n?/.exec(body);
   const title=head?head[1]:typeLabels[kind];
   const text=head?body.slice(head[0].length):body;
   return stash('<aside class="book-callout book-callout-'+kind+'"><p class="book-callout-title">'+esc(title)+'</p>'+String(marked.parse(text,{async:false}))+'</aside>');
  });
  source=source.replace(/(?:~~~|```)\{mermaid\}\s*\n([\s\S]*?)\n(?:~~~|```)/g,(_match,body)=>{
   const pairs=[...body.matchAll(/^\s*(\w+)(?:\[([^\]]+)\])?\s*-->\s*(\w+)(?:\[([^\]]+)\])?/gm)];
   const labelMap=new Map<string,string>();
   for(const [,a,al,b,bl] of pairs){labelMap.set(a,al||labelMap.get(a)||a);labelMap.set(b,bl||labelMap.get(b)||b)}
   const labels=[...labelMap.values()].slice(0,9);
   if(!labels.length)return stash('<div class="book-diagram"><p>Peta konsep tersedia pada format digital Quarto.</p></div>');
   return stash('<figure class="book-diagram"><figcaption>Peta konsep</figcaption><div class="book-diagram-flow">'+labels.map((label,i)=>'<span class="book-diagram-node">'+esc(label)+'</span>'+(i<labels.length-1?'<span class="book-diagram-arrow" aria-hidden="true">→</span>':'')).join('')+'</div></figure>');
  });
  source=source.replace(/\$\$([\s\S]*?)\$\$\s*(?:\{#eq-[\w-]+\})?/g,(_m,tex)=>{
   const html=katex.renderToString(tex.trim(),{throwOnError:false,trust:false,output:"html"});
   return stash('<div class="book-display-math" role="math">'+html+'</div>');
  });
  source=source.replace(/\$([^\n$]+)\$/g,(_m,tex)=>{
   const html=katex.renderToString(tex,{throwOnError:false,trust:false,output:"html"});
   return stash('<span class="book-inline-math" role="math">'+html+'</span>').trim();
  });
  const notes:[string,string][]=[];
  source=source.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm,(_m,key,body)=>{notes.push([key,body]);return ""});
  source=source.replace(/\[\^([^\]]+)\]/g,(_m,key)=>'<sup class="book-footnote-ref">'+esc(key)+'</sup>');
  source=source.replace(/@(fig-[a-z0-9-]+|tbl-[a-z0-9-]+)/gi,(_m,key)=>figures.get(key)||tables.get(key)||esc(key));
  let html=String(marked.parse(source,{async:false}));
  html=html.replace(/<p>BOOKSPECIALTOKEN(\d+)END<\/p>/g,(_m,i)=>replacements[Number(i)]||"");
  html=html.replace(/BOOKSPECIALTOKEN(\d+)END/g,(_m,i)=>replacements[Number(i)]||"");
  const allow=["article","header","section","h1","h2","h3","h4","h5","h6","p","strong","em","blockquote","ul","ol","li","table","thead","tbody","tr","th","td","pre","code","hr","a","img","del","sup","sub","br","span","mark","u","div","figure","figcaption","aside"];
  const sanitized=sanitizeHtml(html,{
   allowedTags:allow,
   allowedAttributes:{'*':["class","role","aria-hidden"],div:["style"],a:["href","title"],img:["src","alt","title"]},
   allowedStyles:{div:{"text-align":[/^(left|center|right)$/]}},
   allowedSchemes:["https","http","mailto"],
   allowedClasses:{
    '*':["book-*","katex","katex-*","mord","mop","mbin","mrel","mspace","mopen","mclose","mpunct","vlist","vlist-t","vlist-r","sizing","reset-size6","size6","base","strut","frac-line","pstrut","mfrac","mspace","accent","mord","mtext","mop","msupsub","text","textbf","newline","svg-align"]
   },
   transformTags:{img:(_tag,attrs)=>({tagName:"img",attribs:{src:/^\/api\/books\/[a-z0-9]+\/assets\/[a-z0-9]+$/i.test(attrs.src||"")?attrs.src:"",alt:attrs.alt||"Ilustrasi"}})}
  });
  let previewBody=editingFound?sanitized.replace(/<p>BCEDITINGSTARTTOKEN<\/p>/g,'<section class="book-editing-target"><span class="book-editing-label">Sedang diedit: '+esc(editing?.label||"Blok aktif")+'</span>').replace(/<p>BCEDITINGENDTOKEN<\/p>/g,'</section>'):sanitized;
  if(blockLinks){
   previewBody=previewBody.replace(/<p>BCPREVIEWSTART(\d+)TOKEN<\/p>/g,(_m,index)=>{
    const link=ranges[Number(index)]?.link;if(!link)return "";
    const active=editing?.id===link.id;
    return '<section class="book-preview-block'+(active?' book-editing-target':'')+'" data-preview-block-id="'+esc(link.id)+'"><button type="button" class="book-preview-pick" aria-label="Tandai di editor: '+esc(link.label)+'">Tandai di editor</button>'+(active?'<span class="book-editing-label">Sedang diedit: '+esc(link.label)+'</span>':'');
   }).replace(/<p>BCPREVIEWEND\d+TOKEN<\/p>/g,'</section>');
  }
  const footnoteHtml=notes.length?'<section class="book-footnotes"><h3>Catatan</h3><ol>'+notes.map(([key,text])=>'<li><strong>'+esc(key)+'.</strong> '+esc(text)+'</li>').join('')+'</ol></section>':"";
  const number=chapter.title.match(/^Bab\s+(\d+)/i)?.[1]||String(chapterIndex+1);
  return '<article class="book-chapter"><header class="book-chapter-heading"><span class="book-chapter-kicker">BAB '+esc(number)+'</span><h1>'+esc(chapter.title.replace(/^Bab\s+\d+\s*[—–:-]\s*/i,""))+'</h1><span class="book-chapter-rule" aria-hidden="true"></span></header>'+sidebar.restore(media.restore(previewBody))+footnoteHtml+'</article>';
 }).join("");
}
