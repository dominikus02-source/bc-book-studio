export type MediaImage={assetId:string;alt:string;width:number;unit:"%"|"px";height:number|null;align:"left"|"center"|"right";padding:number;radius:number;href:string};
export const assetImageRegex=/^!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)(?:\{\.bc-media ([^}\n]*)\})?$/i;
export const richImageRegex=/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)\{\.bc-media ([^}\n]*)\}/g;
export const youtubeRegex=/\[Video: ([^\]\n]+)\]\((https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11})\)\{\.bc-youtube(?: width="(\d{1,4})(%|px)" align="(left|center|right)")?\}/g;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const clean=(s:string)=>s.replace(/[\[\]\r\n]/g," ").trim().slice(0,180);
export function safeMediaLink(value:string):string{
 if(!value.trim()||value.trim().length>1000)return "";
 try{const u=new URL(value.trim());return u.protocol==="https:"&&u.hostname&&!u.username&&!u.password?u.href:""}catch{return ""}
}
export function youtubeId(value:string):string|null{
 try{const u=new URL(value.trim());if(u.protocol!=="https:"||u.username||u.password)return null;
 const host=u.hostname.toLowerCase();let id="";
 if(host==="youtu.be")id=u.pathname.split("/")[1]||"";
 else if(["youtube.com","www.youtube.com","m.youtube.com","www.youtube-nocookie.com"].includes(host))id=u.pathname==="/watch"?u.searchParams.get("v")||"":/^\/(?:embed|shorts|live)\//.test(u.pathname)?u.pathname.split("/")[2]||"":"";
 return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null}catch{return null}
}
export type VideoLayout={width:number;unit:"%"|"px";align:"left"|"center"|"right"};
export const defaultVideoLayout:VideoLayout={width:100,unit:"%",align:"center"};
export function videoMarkdown(title:string,url:string,layout:VideoLayout=defaultVideoLayout):string{const id=youtubeId(url);if(!id)throw Error("Gunakan tautan HTTPS YouTube/youtu.be yang valid.");if(!["%","px"].includes(layout.unit)||!["left","center","right"].includes(layout.align)||!Number.isInteger(layout.width)||layout.width<1||layout.width>(layout.unit==="%"?100:2000))throw Error("Lebar atau posisi video tidak valid.");
 const attributes=layout.width===100&&layout.unit==="%"&&layout.align==="center"
  ? "{.bc-youtube}"
  : '{.bc-youtube width="'+layout.width+layout.unit+'" align="'+layout.align+'"}';
 return "[Video: "+(clean(title)||"Video pembelajaran")+"](https://www.youtube.com/watch?v="+id+")"+attributes;
}
export function parseVideo(raw:string){const m=new RegExp("^"+youtubeRegex.source+"$").exec(raw.trim());return m?{title:m[1],url:m[2],id:youtubeId(m[2])!,layout:{width:Math.max(1,Math.min(m[4]==="px"?2000:100,Number(m[3]||100))),unit:m[4]||"%",align:m[5]||"center"} as VideoLayout}:null}
export function parseMediaImage(raw:string):MediaImage|null{
 const m=assetImageRegex.exec(raw.trim());if(!m)return null;
 const attrs=m[3]||"";const get=(key:string)=>new RegExp("(?:^|\\s)"+key+'="([^"]*)"').exec(attrs)?.[1]||"";
 const w=/^(\d+)(%|px)$/.exec(get("width"));const h=/^(\d+)px$/.exec(get("height"));
 let href="";try{href=safeMediaLink(decodeURIComponent(get("data-bc-link")))}catch{}
 const bounded=(v:string,max:number)=>Math.max(0,Math.min(max,Math.round(Number(v)||0)));
 return {assetId:m[2],alt:m[1],width:w?Math.max(1,Math.min(w[2]==="%"?100:2000,Number(w[1]))):100,unit:w?.[2]==="px"?"px":"%",height:h?Math.max(1,Math.min(2000,Number(h[1]))):null,align:["left","right"].includes(get("fig-align"))?get("fig-align") as "left"|"right":"center",padding:bounded(get("data-bc-padding"),96),radius:bounded(get("data-bc-radius"),128),href};
}
export function mediaImageMarkdown(value:MediaImage):string{
 if(!/^[a-z0-9]{6,100}$/.test(value.assetId))throw Error("Pilih gambar terlebih dahulu.");
 if(!["%","px"].includes(value.unit)||!["left","center","right"].includes(value.align))throw Error("Satuan atau posisi gambar tidak valid.");
 const href=safeMediaLink(value.href);if(value.href.trim()&&!href)throw Error("Hyperlink gambar harus berupa URL HTTPS yang valid.");
 if(!Number.isInteger(value.width)||value.width<1||value.width>(value.unit==="%"?100:2000)||value.height!==null&&(!Number.isInteger(value.height)||value.height<1||value.height>2000)||!Number.isInteger(value.padding)||value.padding<0||value.padding>96||!Number.isInteger(value.radius)||value.radius<0||value.radius>128)throw Error("Ukuran, padding, atau radius gambar di luar batas.");
 const alt=clean(value.alt);if(alt.length<5)throw Error("Isi minimal 5 karakter teks alternatif gambar.");
 const attrs=['width="'+value.width+value.unit+'"',...(value.height?['height="'+value.height+'px"']:[]),'fig-align="'+value.align+'"','data-bc-padding="'+value.padding+'"','data-bc-radius="'+value.radius+'"',...(href?['data-bc-link="'+encodeURIComponent(href)+'"']:[])].join(" ");
 return "!["+alt+"](asset:"+value.assetId+"){.bc-media "+attrs+"}";
}
export function prepareMediaHtml(markdown:string,resolveAsset:(id:string)=>string,embedVideo=true){
 const parts:string[]=[];const stash=(html:string)=>{const i=parts.push(html)-1;return "\n\nBCMEDIATOKEN"+i+"END\n\n"};
 let source=markdown.replace(richImageRegex,(all)=>{
  const m=parseMediaImage(all);if(!m)return all;const src=resolveAsset(m.assetId);if(!src)return "";
  const margin=m.align==="left"?"1em auto 1em 0":m.align==="right"?"1em 0 1em auto":"1em auto";
  const img='<img src="'+esc(src)+'" alt="'+esc(m.alt)+'" style="display:block;width:100%;max-width:100%;height:'+(m.height?m.height+"px":"auto")+';object-fit:contain;border-radius:'+m.radius+'px" loading="lazy"/>';
  return stash('<figure class="book-rich-image" style="box-sizing:border-box;max-width:100%;width:'+m.width+m.unit+';padding:'+m.padding+'px;margin:'+margin+'">'+(m.href?'<a href="'+esc(m.href)+'" target="_blank" rel="noopener noreferrer">'+img+'</a>':img)+'</figure>');
 });
 source=source.replace(youtubeRegex,(all,title,url)=>{
  const {layout}=parseVideo(all)!;
  const margin=layout.align==="left"?"1.25em auto 1.25em 0":layout.align==="right"?"1.25em 0 1.25em auto":"1.25em auto";
  const id=youtubeId(url);if(!id)return "";
  const frame=embedVideo?'<iframe src="https://www.youtube-nocookie.com/embed/'+id+'" title="'+esc(title)+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="display:block;width:100%;height:auto;aspect-ratio:16/9;border:0;border-radius:12px"></iframe>':"";
  return stash('<figure class="book-youtube" style="box-sizing:border-box;min-width:0;max-width:100%;width:'+layout.width+layout.unit+';margin:'+margin+'">'+frame+'<figcaption><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Video: '+esc(title)+'</a></figcaption><p class="book-video-note">Video eksternal YouTube; memerlukan koneksi internet.</p></figure>');
 });
 return {source,restore:(html:string)=>html.replace(/<p>BCMEDIATOKEN(\d+)END<\/p>/g,(_m,i)=>parts[Number(i)]||"").replace(/BCMEDIATOKEN(\d+)END/g,(_m,i)=>parts[Number(i)]||"")};
}
