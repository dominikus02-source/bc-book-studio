import {createHash} from "node:crypto";
import {manuscriptHtml} from "./structured-manuscript";
import {readerScript} from "./publishing-reader-script";
import {marked} from "marked";
import {DEFAULT_PAGINATION, type PaginationSettings} from "./book-pagination";
import sanitizeHtml from "sanitize-html";
type Part={kind:string;title:string;content:string};
const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
export function publicationReaderCsp(){
 const hash=createHash("sha256").update(readerScript,"utf8").digest("base64");
 return "default-src 'none'; script-src 'sha256-"+hash+"'; style-src 'unsafe-inline'; img-src data: blob:; media-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
}
export function publicationHtml(title:string,parts:Part[],draft:boolean,flip:boolean,defaultPaper:string="a4",assets:Array<{id:string;mime:string;data:string;altText:string}>=[],pagination:PaginationSettings=DEFAULT_PAGINATION){
 const assetUrls=new Map<string,string>();
 for(const a of assets){if(!/^[a-z0-9]{6,100}$/.test(a.id)||!["image/png","image/jpeg"].includes(a.mime)||!/^[A-Za-z0-9+/=]+$/.test(a.data)||a.data.length>750000)throw Error("Invalid embedded image");assetUrls.set(a.id,"data:"+a.mime+";base64,"+a.data)}
 const approvedUrls=new Set(assetUrls.values());
 function renderChapter(markdown:string){
  if(!markdown.includes("asset:"))return manuscriptHtml(markdown);
  const inline=markdown.replace(/!\[([^\]\n]*)\]\(asset:([a-z0-9]{6,100})\)/g,(_all,alt,id)=>{const src=assetUrls.get(id);if(!src)throw Error("Missing image for HTML/Flipbook "+id);const asset=assets.find(x=>x.id===id);return "!["+(alt||asset?.altText||"Ilustrasi")+" ]("+src+")"});
  return sanitizeHtml(marked.parse(inline,{async:false,gfm:true}),{
   allowedTags:["p","h1","h2","h3","h4","h5","h6","strong","em","b","i","del","ul","ol","li","blockquote","code","pre","table","thead","tbody","tr","th","td","a","hr","br","img"],
   allowedAttributes:{a:["href","title"],img:["src","alt","title"]},allowedSchemes:["http","https","mailto","data"],
   transformTags:{img:(_tag,attribs)=>({tagName:"img",attribs:{src:approvedUrls.has(attribs.src)?attribs.src:"",alt:attribs.alt||"Ilustrasi"}})}
  });
 }
 const toc='<nav class="book-toc" aria-label="Daftar isi"><h3>Daftar isi navigasi</h3><ol>'+parts.map((part,i)=>'<li><a href="#part-'+(i+1)+'">'+xml(part.title)+'</a></li>').join("")+'</ol></nav>';
 const sections=parts.map((part,i)=>'<section class="book-page" data-kind="'+xml(part.kind)+'" data-folio-zone="'+(part.kind==="frontCover"||part.kind==="backCover"?"cover":part.kind.startsWith("chapter-")?"main":["titlePage","copyrightPage","preface","contentsIntro","readerGuide"].includes(part.kind)?"front":"back")+'" id="part-'+(i+1)+'" aria-label="'+xml(part.title)+'"><h2>'+xml(part.title)+'</h2>'+renderChapter(part.content)+(part.kind==="contentsIntro"?toc:"")+'</section>').join("");
 const css=`
 .book-page[data-folio-zone="cover"]{--folio-display:none}
 @media print{.book-page[data-kind="frontCover"],.book-page[data-kind="backCover"]{page:cover;}@page cover{margin:0;} .book-page[data-folio-zone="main"]{break-before:page;} }
 :root{color-scheme:light;--bg:#edf2f7;--paper:#fff;--text:#17243a;--muted:#475569;--accent:#1558a6;--border:#b8c6d6;--toolbar:#f8fafc;--focus:#ad5d00;--shadow:0 5px 22px rgba(25,45,76,.13);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
 :root[data-theme="dark"]{color-scheme:dark;--bg:#111827;--paper:#1c2637;--text:#f0f5ff;--muted:#c5d1e1;--accent:#8bc5ff;--border:#53657d;--toolbar:#202e42;--focus:#ffce73;--shadow:0 5px 24px rgba(0,0,0,.4)}
 *,*:before,*:after{box-sizing:border-box}
 html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:clamp(15px,1.4vw,18px)/1.7 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
 a{color:var(--accent)}button,select{font:inherit;background:var(--paper);color:var(--text);border:1px solid var(--border);padding:7px 11px;border-radius:8px;min-height:40px}
 button{cursor:pointer}button:disabled{opacity:.48;cursor:not-allowed}
 button:hover:not(:disabled),select:hover{border-color:var(--accent)}
 button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
 .reader-toolbar{position:sticky;top:0;z-index:10;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:var(--toolbar);border-bottom:1px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.09)}
 .reader-toolbar label{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
 .reader-toolbar .reader-group{display:inline-flex;align-items:center;gap:6px}
 .reader-toolbar small{color:var(--muted)}
 .reader-counter{font-variant-numeric:tabular-nums;font-weight:650}
 .reader-status{min-height:1.4em;padding:0 14px;color:var(--muted);font-size:13px}
 .draft-label{padding:6px 20px;font-size:14px;font-weight:700;color:var(--muted)}
 .reader-stage{overflow:auto;overscroll-behavior-x:contain;padding:16px 12px 26px}
 #book-view{--columns:1;--page-zoom:1;display:grid;gap:14px;align-items:start}
 #book-view[data-orientation="portrait"]{--page-ratio:0.707}
 #book-view[data-orientation="landscape"]{--page-ratio:1.414}
 .book-page{background:var(--paper);color:var(--text);border:1px solid var(--border);padding:clamp(18px,3.5vw,52px);overflow-wrap:anywhere;box-shadow:var(--shadow)}
 .book-page[hidden]{display:none!important}
 .book-page h1,.book-page h2,.book-page h3{color:var(--text);line-height:1.28}
 .book-page h2{font-size:clamp(19px,2vw,30px)}
 .book-page p,.book-page li{color:var(--text)}
 .book-page blockquote{color:var(--muted);border-left:4px solid var(--accent);padding-inline:1rem}
 .book-page img,.book-page table,.book-page pre{max-width:100%;height:auto;overflow-x:auto}
 .book-page table{border-collapse:collapse}.book-page th,.book-page td{border:1px solid var(--border);padding:7px}
 .book-page a{color:var(--accent)}
 .book-page[data-kind="frontCover"],.book-page[data-kind="backCover"]{display:flex;flex-direction:column;justify-content:center;text-align:center}
 .book-toc{border-top:1px solid var(--border);margin-top:20px;padding-top:14px}
 .book-toc a{font-size:.92em}
 :root[data-reader="html"] #book-view{max-width:900px;margin:0 auto;display:block}
 :root[data-reader="html"] .book-page{min-height:90vh;margin-bottom:22px;break-before:page;page-break-before:always}
 :root[data-reader="html"] .book-page:first-child{break-before:auto}
 :root[data-reader="flipbook"] #book-view{width:max(calc(var(--columns) * var(--page-width,520px) * var(--page-zoom)),min(100%,520px));margin-inline:auto;grid-template-columns:repeat(var(--columns),minmax(0,1fr));font-size:calc(16px * var(--page-zoom))}
 :root[data-reader="flipbook"] .book-page{aspect-ratio:var(--page-ratio);min-height:calc(340px * var(--page-zoom));padding:clamp(12px,2.6vw,35px);overflow:auto}
 :root[data-reader="flipbook"] .book-page h2{font-size:1.35em}
 :root[data-reader="flipbook"] .book-page p{font-size:1em}

 /* Realistic book presentation: spine, page grain, page corners and movement. */
 :root[data-reader="flipbook"] .reader-stage{position:relative;perspective:1900px;scroll-margin-top:88px}
 :root[data-reader="flipbook"] #book-view{position:relative;isolation:isolate;padding:18px;background:linear-gradient(90deg,transparent 0%,rgba(31,41,55,.06) 49%,rgba(31,41,55,.12) 50%,rgba(31,41,55,.06) 51%,transparent 100%);border-radius:8px;min-height:370px}
 :root[data-reader="flipbook"] .book-page{position:relative;border-radius:2px 12px 12px 2px;border-inline-end:3px solid var(--border);background-color:var(--paper);background-image:linear-gradient(105deg,var(--paper),var(--paper) 87%,var(--toolbar));box-shadow:var(--shadow),4px 4px 0 -1px var(--paper),6px 6px 0 -1px var(--border);transition:box-shadow .24s ease,transform .24s ease;transform-origin:center center}
 :root[data-reader="flipbook"] .book-page:not([hidden]):hover{box-shadow:0 12px 34px rgba(0,0,0,.22),4px 4px 0 -1px var(--paper),6px 6px 0 -1px var(--border)}
 :root[data-reader="flipbook"] .book-page:before{content:"";position:absolute;inset:0 auto 0 0;width:18px;pointer-events:none;background:linear-gradient(to right,rgba(40,49,67,.18),rgba(40,49,67,0));opacity:.45}
 :root[data-reader="flipbook"] .book-page:after{content:"";position:absolute;right:0;bottom:0;width:43px;height:43px;pointer-events:none;background:linear-gradient(135deg,transparent 48%,var(--border) 49%,var(--toolbar) 51%,var(--paper) 100%);filter:drop-shadow(-2px -2px 2px rgba(0,0,0,.09));clip-path:polygon(100% 0,100% 100%,0 100%);transition:width .2s,height .2s}
 :root[data-reader="flipbook"] .book-page:not([hidden]):hover:after{width:67px;height:67px}
 .edge-turn{display:none}
 :root[data-reader="flipbook"] .edge-turn{display:flex;position:sticky;top:47vh;z-index:7;width:46px;height:72px;align-items:center;justify-content:center;font-size:30px;font-weight:700;border-radius:100px;background:var(--toolbar);color:var(--text);box-shadow:var(--shadow);opacity:.65;transition:transform .2s ease,opacity .2s ease,background-color .2s ease}
 :root[data-reader="flipbook"] .edge-turn:hover:not(:disabled),:root[data-reader="flipbook"] .edge-turn:focus-visible{opacity:1;transform:scale(1.13);background:var(--paper)}
 :root[data-reader="flipbook"] .edge-turn:disabled{opacity:.13}
 :root[data-reader="flipbook"] #edge-prev{float:left;margin-right:-46px;left:2px}
 :root[data-reader="flipbook"] #edge-next{float:right;margin-left:-46px;right:2px}
 :root[data-reader="flipbook"] #reader-prev,:root[data-reader="flipbook"] #reader-next{font-weight:650}
 :root[data-reader="flipbook"] .page-turn-ghost{position:absolute;z-index:6;transform-style:preserve-3d;backface-visibility:hidden;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,.25);overflow:hidden;background:var(--paper);color:var(--text)}
 :root[data-reader="flipbook"] .turn-paper-face{background:var(--paper);color:var(--text);padding:clamp(12px,2.6vw,35px);height:100%;overflow:hidden;backface-visibility:hidden}
 :root[data-reader="flipbook"] .turn-forward{transform-origin:left center;animation:flip-next .54s cubic-bezier(.25,.7,.25,1) both}
 :root[data-reader="flipbook"] .turn-backward{transform-origin:right center;animation:flip-prev .54s cubic-bezier(.25,.7,.25,1) both}
 @keyframes flip-next{0%{transform:rotateY(0deg);opacity:1}65%{transform:rotateY(-85deg);opacity:.83}100%{transform:rotateY(-170deg);opacity:0}}
 @keyframes flip-prev{0%{transform:rotateY(0deg);opacity:1}65%{transform:rotateY(85deg);opacity:.83}100%{transform:rotateY(170deg);opacity:0}}

 :root[data-reader="flipbook"] .book-page.corner-peek-next{cursor:e-resize}
 :root[data-reader="flipbook"] .book-page.corner-peek-next:after{width:80px;height:80px;filter:drop-shadow(-5px -4px 4px rgba(0,0,0,.2))}
 :root[data-reader="flipbook"] .book-page.corner-peek-prev{cursor:w-resize}
 :root[data-reader="flipbook"] .book-page.corner-peek-prev:after{left:0;right:auto;clip-path:polygon(0 0,100% 100%,0 100%);width:80px;height:80px;transform:scaleX(-1)}
 @media(hover:none){:root[data-reader="flipbook"] .edge-turn{opacity:.87}}
 @media(prefers-reduced-motion:reduce){.page-turn-ghost{display:none!important}.book-page{transition:none!important}}

 .reader-shell{position:relative;display:grid;grid-template-columns:minmax(0,1fr);min-width:0;max-width:100vw}
 .reader-stage{min-width:0;max-width:100%;overflow-x:auto}
 .reader-sidebar{display:flex;flex-direction:column;position:fixed;z-index:20;top:0;left:0;bottom:0;width:min(86vw,340px);background:var(--toolbar);color:var(--text);border-right:1px solid var(--border);box-shadow:var(--shadow);transform:translateX(-105%);visibility:hidden;transition:transform .22s ease,visibility .22s;overflow-y:auto;overscroll-behavior:contain}
 .reader-sidebar[inert]{pointer-events:none}
 .sidebar-header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--toolbar);z-index:1}
 .sidebar-toc{padding:10px 12px;flex:1}.sidebar-toc ol{margin:0;padding:0;list-style:none}.sidebar-toc li{margin:3px 0}
 .sidebar-toc a{display:flex;align-items:start;gap:9px;padding:10px 12px;border-radius:9px;text-decoration:none;color:var(--text);font-size:14px;line-height:1.4;overflow-wrap:anywhere}
 .sidebar-toc a:hover,.sidebar-toc a:focus-visible{background:var(--bg);color:var(--accent)}
 .sidebar-toc a[aria-current="page"]{background:var(--bg);font-weight:700;border-left:3px solid var(--accent);padding-left:9px}
 .sidebar-number{flex:none;font-variant-numeric:tabular-nums;color:var(--muted)}
 .sidebar-footnote{margin:0;padding:10px 22px 20px;color:var(--muted);font-size:12px}
 .sidebar-backdrop{position:fixed;inset:0;z-index:19;background:rgba(0,0,0,.48);border:0;border-radius:0;width:100vw;height:100vh;padding:0}.sidebar-backdrop[hidden]{display:none!important}
 :root[data-sidebar="open"] .reader-sidebar{visibility:visible;transform:translateX(0)}
 #sidebar-toggle{font-weight:650}
 @media(min-width:1024px){:root[data-sidebar="open"] .reader-shell{grid-template-columns:clamp(240px,23vw,310px) minmax(0,1fr)}:root[data-sidebar="open"] .reader-sidebar{position:sticky;grid-column:1;grid-row:1;top:0;height:100dvh;width:100%;box-shadow:none;transform:none}:root[data-sidebar="open"] .reader-stage{grid-column:2;grid-row:1}:root[data-sidebar="open"] .sidebar-backdrop{display:none!important}}
 @media(max-width:600px){.reader-sidebar{width:min(88vw,320px)}.sidebar-toc a{padding:12px 10px}.sidebar-header{padding:12px}}
 @media(prefers-reduced-motion:reduce){.reader-sidebar{transition:none}}
 @media print{.reader-sidebar,.sidebar-backdrop,#sidebar-toggle{display:none!important}.reader-shell{display:block!important}.reader-stage{max-width:none!important}}
  @media(max-width:600px){.reader-toolbar{gap:5px;padding:8px}.reader-toolbar label{font-size:13px}.reader-toolbar button,.reader-toolbar select{padding:6px 8px}.reader-stage{padding:8px}.book-page{padding:18px} :root[data-reader="flipbook"] #book-view{width:max(calc(var(--columns) * var(--page-width,520px) * var(--page-zoom)),min(100%,520px))}} 

 /* Reading canvas auto fits the paper in both axes at 100% while preserving ISO ratios. */
 :root[data-reader="flipbook"] body{overflow-x:hidden}
 :root[data-reader="flipbook"] .reader-shell{min-height:0}
 :root[data-reader="flipbook"] .reader-stage{min-height:0;height:var(--reader-height,calc(100dvh - 110px));overflow-y:hidden;overflow-x:auto;scrollbar-gutter:auto;padding:10px 10px 0}
 :root[data-reader="flipbook"] #book-view{width:var(--spread-width,520px);max-width:none;min-height:0;grid-template-columns:repeat(var(--columns),minmax(0,1fr));align-items:start;gap:var(--page-gap,12px);padding:var(--spread-padding,12px)}
 :root[data-reader="flipbook"] .book-page{aspect-ratio:unset;width:100%;height:var(--page-height,700px);min-height:0;max-height:none;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;overscroll-behavior:contain}
 :root[data-reader="flipbook"] .reader-stage[data-fit="true"] .book-page:not([data-overflow="true"]){scrollbar-width:none}
 :root[data-reader="flipbook"] .book-page[data-overflow="true"]{scrollbar-width:thin}
 :root[data-reader="flipbook"] .reader-stage[data-fit="true"] .book-page:not([data-overflow="true"])::-webkit-scrollbar{display:none}
 :root[data-reader="flipbook"] .book-page[data-kind="frontCover"],:root[data-reader="flipbook"] .book-page[data-kind="backCover"]{justify-content:center}
 :root[data-reader="html"] #book-view{max-width:var(--html-paper-width,840px);width:min(100%,var(--html-paper-width,840px));transition:max-width .2s ease}
 :root[data-reader="html"] .book-page{min-height:calc(var(--html-paper-width,840px) * var(--paper-ratio,1.414));margin-bottom:16px}
 .reader-paper-label{min-width:0}
 #paper-size{max-width:min(220px,45vw)}
 .reader-paper-info{color:var(--muted);font-size:12px;white-space:nowrap}
 .reader-toolbar{min-height:0;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;overscroll-behavior-x:contain;white-space:nowrap;max-height:68px}
 .reader-toolbar>*{flex-shrink:0}
 :root[data-reader="flipbook"] .reader-toolbar{min-height:0}
 @media(max-width:600px){.reader-paper-info{display:none}#paper-size{max-width:160px}:root[data-reader="flipbook"] .book-page{padding:12px}}

 /* Compact reader toolbar: one row, secondary options in an accessible popover. */
 .reader-toolbar{height:56px;max-height:none;min-height:56px;padding:6px 12px;gap:10px;overflow:visible;flex-wrap:nowrap;position:sticky;top:0;z-index:30;white-space:normal}
 .reader-toolbar>*{flex-shrink:0}
 .reader-toolbar .reader-group{gap:5px}
 .reader-toolbar button{min-height:36px;padding:5px 10px}
 .reader-toolbar-spacer{flex:1 1 auto;min-width:0}
 .reader-counter{font-size:13px;white-space:nowrap;min-width:0}
 .reader-navigation button{font-size:20px;line-height:1}
 .reader-zoom{font-variant-numeric:tabular-nums}
 .reader-zoom button{min-width:34px}
 #reader-settings-toggle{font-weight:650}
 .reader-settings{position:absolute;right:12px;top:calc(100% + 6px);width:min(350px,calc(100vw - 24px));max-height:min(75dvh,650px);overflow-y:auto;overscroll-behavior:contain;padding:14px;background:var(--toolbar);color:var(--text);border:1px solid var(--border);box-shadow:0 16px 48px rgba(0,0,0,.2);border-radius:14px;white-space:normal;z-index:35;display:grid;gap:12px}
 .reader-settings[hidden]{display:none!important}
 .reader-settings-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid var(--border);padding-bottom:8px}
 .reader-settings-heading button{font-size:24px;line-height:1;min-width:36px}
 .reader-option{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);align-items:center;gap:12px;font-size:13px}
 .reader-option label{white-space:normal;line-height:1.35}
 .reader-option button,.reader-option select{width:100%;min-width:0;max-width:none;white-space:normal;text-align:left;min-height:38px}
 .reader-paper-option{grid-template-columns:1fr;gap:6px}
 .reader-paper-option select{width:100%;max-width:none}
 .reader-paper-info{white-space:normal;font-size:11px}
 .reader-zoom-mobile{display:none}
 .reader-zoom-mobile .reader-group{justify-content:flex-end}
 .reader-zoom-mobile button{width:auto;min-width:40px;text-align:center}
 .reader-status:empty{display:none}
 :root[data-reader="flipbook"] .reader-stage{scroll-margin-top:56px}
 @media(max-width:600px){.reader-toolbar{height:52px;min-height:52px;padding:6px 8px;gap:6px}.reader-toolbar button{padding:5px 8px}.reader-counter{font-size:12px}.reader-navigation button{min-width:30px}.reader-settings-label{display:none}.reader-zoom{gap:2px}.reader-zoom button{min-width:30px}.reader-zoom #zoom-value{font-size:12px}.reader-settings{right:8px;width:min(340px,calc(100vw - 16px))}}
 @media(max-width:500px){.reader-zoom{display:none!important}:root[data-reader="flipbook"] .reader-zoom-mobile{display:grid!important}}@media(max-width:370px){.reader-counter{font-size:11px}#sidebar-toggle{font-size:12px}}
 @media print{.reader-settings{display:none!important}}

 @media print{:root[data-reader="flipbook"] .book-page{height:auto!important;overflow:visible!important}:root[data-reader="html"] .book-page{min-height:0}}
 @media print{html,body{background:white!important;color:#111!important}.reader-toolbar,.reader-status,.draft-label{display:none!important}.reader-stage{overflow:visible;padding:0}#book-view{display:block!important;width:100%!important}.book-page{background:white!important;color:#111!important;min-height:0!important;aspect-ratio:auto!important;break-before:page;page-break-before:always;box-shadow:none;border:0;margin:0!important;padding:12mm!important;overflow:visible!important}.book-page:first-child{break-before:auto}.book-page[hidden]{display:block!important}}
 @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
 `;
 const base='<button type="button" id="theme-toggle" aria-pressed="false">Mode gelap</button>';
 const controls=flip?'<div class="reader-group reader-navigation"><button type="button" id="reader-prev" aria-label="Halaman sebelumnya" title="Halaman sebelumnya">‹</button><span id="page-counter" class="reader-counter" aria-live="polite"></span><button type="button" id="reader-next" aria-label="Halaman berikutnya" title="Halaman berikutnya">›</button></div><div class="reader-group reader-zoom"><button type="button" id="zoom-out" aria-label="Perkecil" title="Perkecil">−</button><span id="zoom-value" aria-live="polite">100%</span><button type="button" id="zoom-in" aria-label="Perbesar" title="Perbesar">+</button></div>':'';
 const paperSelector='<label for="paper-size">Ukuran buku</label><select id="paper-size" aria-label="Ukuran kertas buku"><option value="a4">A4 · 210 × 297 mm</option><option value="a5">A5 · 148 × 210 mm</option><option value="b5">ISO B5 · 176 × 250 mm</option><option value="a3">A3 · 297 × 420 mm</option><option value="a6">A6 · 105 × 148 mm</option><option value="b4">ISO B4 · 250 × 353 mm</option><option value="b6">ISO B6 · 125 × 176 mm</option><option value="jis-b5">JIS B5 · 182 × 257 mm</option><option value="letter">US Letter · 216 × 279 mm</option><option value="legal">US Legal · 216 × 356 mm</option><option value="trade-6x9">Trade 6 × 9 in · 152 × 229 mm</option><option value="id-14x21">Buku 14 × 21 cm</option><option value="id-15x23">Buku 15 × 23 cm</option></select><small id="paper-size-info" class="reader-paper-info" aria-live="polite">A4 · 210 × 297 mm</small>';
 const speech='<button type="button" id="reader-speak" aria-pressed="false" title="Baca halaman dengan suara browser">Bacakan</button>';
 const options=flip?'<div class="reader-option"><label for="page-layout">Halaman per tampilan</label><select id="page-layout" aria-label="Jumlah halaman per tampilan"><option value="1">1 halaman</option><option value="2">2 halaman</option><option value="4">4 halaman</option><option value="6">6 halaman</option><option value="8">8 halaman</option></select></div><div class="reader-option"><label for="page-orientation">Orientasi</label><select id="page-orientation" aria-label="Orientasi halaman"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div><div class="reader-option"><label>Audio halaman</label><button type="button" id="turn-sound" aria-pressed="false" aria-label="Unmute suara membalik halaman">Suara halaman: mute</button></div>':'';
 const settings='<button type="button" id="reader-settings-toggle" aria-expanded="false" aria-controls="reader-settings" aria-label="Buka pengaturan pembaca" title="Pengaturan pembaca">⚙ <span class="reader-settings-label">Pengaturan</span></button><div id="reader-settings" class="reader-settings" hidden role="group" aria-label="Pengaturan lanjutan"><div class="reader-settings-heading"><strong>Pengaturan pembaca</strong><button type="button" id="reader-settings-close" aria-label="Tutup pengaturan">×</button></div><div class="reader-option"><label>Tema tampilan</label>'+base+'</div><div class="reader-option reader-paper-option">'+paperSelector+'</div>'+options+'<div class="reader-option reader-zoom-mobile"><label>Zoom halaman</label><div class="reader-group"><button type="button" id="zoom-out-secondary" aria-label="Perkecil">−</button><span id="zoom-value-secondary">100%</span><button type="button" id="zoom-in-secondary" aria-label="Perbesar">+</button></div></div><div class="reader-option"><label>Pembaca suara</label>'+speech+'</div></div>';

 const sidebar='<aside id="reader-sidebar" class="reader-sidebar" aria-label="Navigasi buku" aria-hidden="true" inert><div class="sidebar-header"><strong>Isi buku</strong><button id="sidebar-close" type="button" aria-label="Tutup sidebar">Tutup ×</button></div><nav class="sidebar-toc" aria-label="Daftar isi sidebar"><ol>'+parts.map((part,i)=>'<li><a href="#part-'+(i+1)+'" data-page="'+i+'"><span class="sidebar-number">'+(i+1)+'.</span><span>'+xml(part.title)+'</span></a></li>').join('')+'</ol></nav><p class="sidebar-footnote">Pilih bagian untuk berpindah halaman.</p></aside><button id="sidebar-backdrop" class="sidebar-backdrop" aria-label="Tutup menu daftar isi" type="button" hidden></button>';
 const sidebarToggle='<button type="button" id="sidebar-toggle" aria-controls="reader-sidebar" aria-expanded="false" aria-label="Tampilkan daftar isi">☰ Daftar isi</button>';
 const toolbar='<div class="reader-toolbar" role="toolbar" aria-label="Navigasi dan pengaturan pembaca">'+sidebarToggle+controls+'<span class="reader-toolbar-spacer" aria-hidden="true"></span>'+settings+'</div>';
 const status='<p id="reader-status" class="reader-status" role="status" aria-live="polite"></p>';
 return '<!doctype html><html lang="id" data-reader="'+(flip?'flipbook':'html')+'" data-pagination="'+xml(JSON.stringify(pagination))+'" data-theme="light" data-paper="'+(defaultPaper||'a4')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>'+xml(title)+'</title><style>'+css+'</style></head><body>'+toolbar+status+(draft?'<p class="draft-label">DRAF — BELUM DISETUJUI</p>':'')+'<div class="reader-shell">'+sidebar+'<main class="reader-stage">'+(flip?'<button class="edge-turn" id="edge-prev" type="button" aria-label="Balik halaman ke belakang" title="Halaman sebelumnya">‹</button><button class="edge-turn" id="edge-next" type="button" aria-label="Balik halaman ke depan" title="Halaman berikutnya">›</button>':'')+'<div id="book-view" data-orientation="portrait">'+sections+'</div></main></div><script>'+readerScript+'</script></body></html>';
}

