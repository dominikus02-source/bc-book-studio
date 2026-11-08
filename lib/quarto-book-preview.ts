import {marked} from "marked";
import sanitizeHtml from "sanitize-html";
import katex from "katex";

type BookChapter={title:string;content:string};
function esc(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
const typeLabels:Record<string,string>={note:"Catatan",tip:"Tips",important:"Penting",warning:"Perhatian",caution:"Hati-hati"};
export function renderBookPreview(chapters:BookChapter[],bookId:string):string{
 return chapters.map((chapter,chapterIndex)=>{
  let source=chapter.content.replace(/\r\n?/g,"\n");
  const replacements:string[]=[];
  const stash=(html:string)=>{const id=replacements.length;replacements.push(html);return "\n\nBOOKSPECIALTOKEN"+id+"END\n\n"};
  const figures=new Map<string,string>(),tables=new Map<string,string>();
  let figureNum=0,tableNum=0;
  source=source.replace(/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)\s*\{#(fig-[a-z0-9-]+)\}/gi,(_match,alt,id,label)=>{
   figureNum++;figures.set(label,"Gambar "+figureNum);
   return stash('<figure class="book-figure"><img src="/api/books/'+encodeURIComponent(bookId)+'/assets/'+encodeURIComponent(id)+'" alt="'+esc(alt)+'"/><figcaption>Gambar '+figureNum+'. '+esc(alt)+'</figcaption></figure>');
  });
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
   allowedAttributes:{'*':["class","role","aria-hidden"],a:["href","title"],img:["src","alt","title"]},
   allowedSchemes:["https","http","mailto"],
   allowedClasses:{
    '*':["book-*","katex","katex-*","mord","mop","mbin","mrel","mspace","mopen","mclose","mpunct","vlist","vlist-t","vlist-r","sizing","reset-size6","size6","base","strut","frac-line","pstrut","mfrac","mspace","accent","mord","mtext","mop","msupsub","text","textbf","newline","svg-align"]
   },
   transformTags:{img:(_tag,attrs)=>({tagName:"img",attribs:{src:/^\/api\/books\/[a-z0-9]+\/assets\/[a-z0-9]+$/i.test(attrs.src||"")?attrs.src:"",alt:attrs.alt||"Ilustrasi"}})}
  });
  const footnoteHtml=notes.length?'<section class="book-footnotes"><h3>Catatan</h3><ol>'+notes.map(([key,text])=>'<li><strong>'+esc(key)+'.</strong> '+esc(text)+'</li>').join('')+'</ol></section>':"";
  const number=chapter.title.match(/^Bab\s+(\d+)/i)?.[1]||String(chapterIndex+1);
  return '<article class="book-chapter"><header class="book-chapter-heading"><span class="book-chapter-kicker">BAB '+esc(number)+'</span><h1>'+esc(chapter.title.replace(/^Bab\s+\d+\s*[—–:-]\s*/i,""))+'</h1><span class="book-chapter-rule" aria-hidden="true"></span></header>'+sanitized+footnoteHtml+'</article>';
 }).join("");
}
