"use client";

import {useEffect,useReducer,useRef,useState,type SetStateAction} from "react";
import "./editing-preview.css";
import {indexChapter} from "../lib/book-index";
import {bookSidebarCss,chapterOpenerMarkdown,readChapterOpener,readSidebar,sidebarMarkdown,sidebarTypes,type SidebarPosition,type SidebarType} from "../lib/book-sidebar";
import {paperSizes,paperSpec} from "../lib/paper-sizes";
import {assetImageRegex,parseVideo} from "../lib/book-media";
import {prepareImageUpload} from "../lib/client-image-upload";
import {MediaImageEditor,MediaVideoEditor,InsertYouTube} from "./media-controls";
import {marked} from "marked";
import {cleanAlignmentArtifacts,renderBookPreview} from "../lib/quarto-book-preview";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";

const WRITING_TRANSFER_FIELDS:TransferField[]=[
 {key:"title",label:"Judul bab",required:true,maxLength:180},
 {key:"content",label:"Isi naskah Markdown",required:true,maxLength:200000},
];
type Chapter={id:string;title:string;content:string;updatedAt:string};
type Recovery={title:string;content:string;version:string};
type MarkdownHeading={level:number;text:string};
function quartoHeadings(markdown:string):MarkdownHeading[]{
 const headings:MarkdownHeading[]=[];
 let fenced=false;
 for(const line of markdown.replace(/\r\n?/g,"\n").split("\n")){
  if(/^\s{0,3}(?:\x60{3,}|~{3,})/.test(line)){fenced=!fenced;continue}
  if(fenced)continue;
  const m=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
  if(m){const label=m[2].replace(/\s+\{[^{}]*\}\s*$/,"").replace(/[*_]/g,"").trim();if(label)headings.push({level:m[1].length,text:label});}
 }return headings;
}
type RevisionRecord={revision:number;title:string;content:string;createdAt:string};
type OutlineSection={id:string;title:string;objective:string;position:number;parentId:string|null;archivedAt:string|null};
type Asset={id:string;name:string;altText:string};
type Kind="heading"|"paragraph"|"image"|"video"|"exercise"|"list"|"table"|"quote"|"code"|"source";
import {blockLayoutFields,editorialBlockLayout,parseBlockLayout,wrapBlockLayout,type BlockLayout} from "../lib/book-block-layout";

type Block={id:string;kind:Kind;raw:string;layout?:BlockLayout};
const labels:Record<Kind,string>={heading:"Judul",paragraph:"Paragraf",image:"Gambar",video:"Video YouTube",exercise:"Latihan",list:"Daftar",table:"Tabel",quote:"Kutipan",code:"Kode",source:"Markdown asli"};
type Preset={id:string;group:string;label:string;kind:Kind;raw:string};
const BLOCK_PRESETS:Preset[]=[
 {id:"section",group:"Struktur",label:"Judul bagian",kind:"heading",raw:"## Judul bagian"},
 {id:"subsection",group:"Struktur",label:"Subbagian",kind:"heading",raw:"### Judul subbagian"},
 {id:"paragraph",group:"Struktur",label:"Paragraf",kind:"paragraph",raw:"Tulis paragraf yang koheren di sini."},
 {id:"divider",group:"Struktur",label:"Pemisah adegan",kind:"paragraph",raw:"---"},
 {id:"objectives",group:"Pembelajaran",label:"Tujuan pembelajaran",kind:"list",raw:"### Tujuan pembelajaran\n\n- Jelaskan tujuan pertama.\n- Jelaskan tujuan kedua."},
 {id:"summary",group:"Pembelajaran",label:"Rangkuman",kind:"list",raw:"### Rangkuman\n\n- Konsep penting pertama.\n- Konsep penting kedua."},
 {id:"checklist",group:"Pembelajaran",label:"Daftar periksa",kind:"list",raw:"- [ ] Langkah pertama\n- [ ] Langkah kedua"},
 {id:"exercise",group:"Pembelajaran",label:"Latihan pemahaman",kind:"exercise",raw:"> **Latihan**\n>\n> 1. Tulis pertanyaan pertama.\n> 2. Tulis pertanyaan kedua."},
 {id:"activity",group:"Pembelajaran",label:"Aktivitas pembaca",kind:"quote",raw:"> **Aktivitas**\n>\n> Tujuan: ...\n>\n> Langkah: ...\n>\n> Refleksi: ..."},
 {id:"table",group:"Visual & data",label:"Tabel",kind:"table",raw:"| Aspek | Penjelasan |\n| --- | --- |\n| Contoh | Isi tabel |"},
 {id:"figure",group:"Visual & data",label:"Keterangan gambar",kind:"paragraph",raw:"**Gambar 1.** Judul gambar. Sumber dan izin penggunaan: ..."},
 {id:"equation",group:"Visual & data",label:"Rumus matematika",kind:"paragraph",raw:"$$\nE = mc^2\n$$"},
 {id:"code",group:"Visual & data",label:"Blok kode",kind:"code",raw:"```text\nContoh kode\n```"},
 {id:"quote",group:"Referensi",label:"Kutipan",kind:"quote",raw:"> Tulis kutipan singkat dengan atribusi yang terverifikasi."},
 {id:"references",group:"Referensi",label:"Daftar pustaka",kind:"list",raw:"### Daftar pustaka\n\n- Penulis. (Tahun). *Judul*. Penerbit/DOI/URL."},
 {id:"note",group:"Referensi",label:"Catatan kaki",kind:"paragraph",raw:"Catatan sumber[^1].\n\n[^1]: Penulis, *Judul*, halaman atau URL."},
 {id:"scene",group:"Fiksi",label:"Adegan",kind:"paragraph",raw:"**Tempat dan waktu:** ...\n\nTokoh melakukan tindakan yang memajukan alur."},
 {id:"dialogue",group:"Fiksi",label:"Dialog",kind:"paragraph",raw:"“Tuliskan dialog tokoh di sini,” katanya."},
 {id:"reflection",group:"Fiksi",label:"Refleksi tokoh",kind:"quote",raw:"> Apa yang berubah pada tokoh setelah peristiwa ini?"},
];
const QUARTO_PRESETS:Preset[]=[
 {id:"chapter-opener",group:"Perangkat buku ajar",label:"Pembuka bab",kind:"source",raw:chapterOpenerMarkdown("Apa yang sudah kamu ketahui tentang topik bab ini?")},
 {"id":"q-pedagogy-1","group":"Perangkat buku ajar","label":"Tujuan pembelajaran","kind":"source","raw":"::: {.callout-note}\n## Tujuan pembelajaran\n\nSetelah mempelajari bab ini, peserta didik dapat:\n\n1. Menjelaskan konsep utama.\n2. Menerapkan konsep pada satu contoh.\n:::"},
 {"id":"q-pedagogy-2","group":"Perangkat buku ajar","label":"Kegiatan bernomor","kind":"source","raw":"::: {.callout-tip}\n## Kegiatan 1 — Judul kegiatan\n\n**Tujuan:** Tuliskan keterampilan yang dilatih.\n\n1. Amati contoh.\n2. Diskusikan hasilnya.\n3. Catat kesimpulan.\n:::"},
 {"id":"q-pedagogy-3","group":"Perangkat buku ajar","label":"Kata kunci","kind":"source","raw":"::: {.callout-note}\n## Kata kunci\n\n- **Istilah 1** — Definisi singkat.\n- **Istilah 2** — Definisi singkat.\n:::"},
 {"id":"q-pedagogy-4","group":"Perangkat buku ajar","label":"Jurnal membaca","kind":"source","raw":"::: {.callout-note}\n## Jurnal membaca\n\n| Sumber bacaan | Ringkasan | Tanggapan |\n| --- | --- | --- |\n| Judul dan penulis | Gagasan utama | Pertanyaan atau catatan |\n:::"},
 {"id":"q-pedagogy-5","group":"Perangkat buku ajar","label":"Refleksi Ya/Tidak","kind":"source","raw":"::: {.callout-important}\n## Refleksi pembelajaran\n\n| Pernyataan | Ya | Tidak |\n| --- | --- | --- |\n| Saya dapat menjelaskan konsep utama. | ☐ | ☐ |\n| Saya dapat memberi contoh penerapan. | ☐ | ☐ |\n\n**Langkah berikutnya:** Apa yang perlu saya latih lagi?\n:::"},
 {id:"sidebar-left",group:"Sidebar buku",label:"Sidebar kiri",kind:"source",raw:sidebarMarkdown("note","left","## Info tambahan\n\nTambahkan konteks atau QR dari pustaka aset.")},
 {id:"sidebar-right",group:"Sidebar buku",label:"Sidebar kanan",kind:"source",raw:sidebarMarkdown("tip","right","## Tips pembaca\n\nTambahkan tips, peringatan, atau tautan pendukung.")},
 {id:"q-callout-note",group:"Kotak informasi",label:"Catatan (note)",kind:"source",raw:"::: {.callout-note}\n## Catatan\n\nTuliskan informasi tambahan yang relevan.\n:::"},
 {id:"q-callout-tip",group:"Kotak informasi",label:"Tips",kind:"source",raw:"::: {.callout-tip}\n## Tips praktis\n\nTambahkan saran praktis bagi pembaca.\n:::"},
 {id:"q-callout-important",group:"Kotak informasi",label:"Penting",kind:"source",raw:"::: {.callout-important}\n## Penting\n\nTuliskan pokok informasi yang wajib diperhatikan.\n:::"},
 {id:"q-callout-warning",group:"Kotak informasi",label:"Peringatan",kind:"source",raw:"::: {.callout-warning}\n## Peringatan\n\nJelaskan risiko secara spesifik.\n:::"},
 {id:"q-callout-caution",group:"Kotak informasi",label:"Perhatian",kind:"source",raw:"::: {.callout-caution}\n## Perhatian\n\nTuliskan tindakan pencegahan.\n:::"},
 {id:"q-figure",group:"Ilustrasi & referensi",label:"Gambar + nomor & rujukan",kind:"source",raw:"![Deskripsi gambar](images/gambar-1.png){#fig-ilustrasi width=80%}\n\nLihat @fig-ilustrasi."},
 {id:"q-table",group:"Ilustrasi & referensi",label:"Tabel + caption & rujukan",kind:"source",raw:"| Unsur | Penjelasan |\n|:------|:-----------|\n| A | Contoh |\n| B | Contoh |\n\n: Judul tabel {#tbl-contoh}\n\nLihat @tbl-contoh."},
 {id:"q-crossref",group:"Ilustrasi & referensi",label:"Rujukan silang",kind:"paragraph",raw:"Lihat @fig-ilustrasi dan @tbl-contoh. Pastikan labelnya unik dan objeknya tersedia."},
 {id:"q-mermaid",group:"Diagram & data",label:"Diagram Mermaid",kind:"source",raw:"\`\`\`{mermaid}\nflowchart LR\n  A[Mulai] --> B{Keputusan?}\n  B -->|Ya| C[Hasil]\n  B -->|Tidak| D[Perbaikan]\n\`\`\`"},
 {id:"q-graphviz",group:"Diagram & data",label:"Diagram Graphviz",kind:"source",raw:"\`\`\`{dot}\ndigraph G {\n  A -> B;\n  B -> C;\n}\n\`\`\`"},
 {id:"q-math",group:"Diagram & data",label:"Persamaan display",kind:"source",raw:"$$\nE = mc^2\n$$"},
 {id:"q-code",group:"Diagram & data",label:"Kode dengan bahasa",kind:"code",raw:"\`\`\`python\nprint('Contoh kode untuk dibaca, bukan dieksekusi otomatis')\n\`\`\`"},
 {id:"q-video",group:"Multimedia & lampiran",label:"Video (HTML)",kind:"source",raw:"{{< video https://www.youtube.com/embed/VIDEO_ID title=\"Judul video\" >}}\n\n**Alternatif teks:** Uraikan isi video untuk pembaca non-HTML."},
 {id:"q-shortcode",group:"Multimedia & lampiran",label:"Shortcode pemisah halaman",kind:"source",raw:"{{< pagebreak >}}"},
 {id:"q-embed",group:"Multimedia & lampiran",label:"Embed notebook (bersyarat)",kind:"source",raw:"{{< embed notebooks/contoh.ipynb#fig-contoh >}}\n\n**Catatan:** File notebook harus tersedia dalam paket ekspor dan diproses oleh worker terisolasi."},
 {id:"q-citation",group:"Referensi Quarto",label:"Sitasi bibliografi",kind:"paragraph",raw:"Menurut @contoh2026, ... (lengkapi kunci dan berkas bibliografi terlebih dahulu)."},
 {id:"q-footnote",group:"Referensi Quarto",label:"Catatan kaki",kind:"source",raw:"Pernyataan yang memerlukan catatan kaki.[^catatan1]\n\n[^catatan1]: Uraian atau sumber yang dapat diverifikasi."},
 {id:"q-definition",group:"Referensi Quarto",label:"Daftar istilah",kind:"source",raw:"Istilah\n: Definisi yang akurat dan mudah dipahami."},
];
BLOCK_PRESETS.push(...QUARTO_PRESETS);
const presetGroups=["Perangkat buku ajar","Sidebar buku","Struktur","Pembelajaran","Visual & data","Referensi","Fiksi","Kotak informasi","Ilustrasi & referensi","Diagram & data","Multimedia & lampiran","Referensi Quarto"];
const image=assetImageRegex;
const exercise=/^> \*\*Latihan\*\*\n>\n((?:>[^\n]*(?:\n|$))+)/;
function split(content:string):Block[]{
 const source=cleanAlignmentArtifacts(content.replace(/\r\n?/g,"\n"));
 // Keep each Quarto fenced div intact (callouts, tabsets, layout divs).
 // Ordinary Markdown before/after them is still tokenized normally.
 if(/^:::\s*\{/m.test(source)){
  const lines=source.split("\n"), chunks:string[]=[];
  let plain:string[]=[], fenced:string[]=[], depth=0;
  function flushPlain(){if(plain.length){chunks.push(plain.join("\n"));plain=[]}}
  for(const line of lines){
   if(depth===0 && /^:::\s*\{/.test(line)){flushPlain();fenced=[line];depth=1;continue}
   if(depth>0){
    fenced.push(line);
    if(/^:::\s*\{/.test(line))depth++;
    else if(/^:::\s*$/.test(line))depth--;
    if(depth===0){chunks.push(fenced.join("\n"));fenced=[]}
   }else plain.push(line);
  }
  if(fenced.length){plain.unshift(...fenced)}
  flushPlain();
  const grouped:Block[]=[];
  for(const chunk of chunks){
   if(!chunk.trim())continue;
   const layout=parseBlockLayout(chunk.split("\n")[0]);
   if(layout){
    const raw=chunk.split("\n").slice(1,-1).join("\n").trim();
    const [block,...rest]=split(raw);
    grouped.push({id:"block-"+grouped.length,kind:block&&!rest.length?block.kind:"source",raw,layout});
   }else if(/^:::\s*\{/.test(chunk.trimStart()))grouped.push({id:"block-"+grouped.length,kind:"source",raw:chunk.trim()});
   else for(const b of splitStandard(chunk))grouped.push({...b,id:"block-"+grouped.length});
  }
  return grouped;
 }
 return splitStandard(source);
}
function splitStandard(content:string):Block[]{
 const text=content.replace(/\r\n?/g,"\n");
 const tokens=marked.lexer(text);
 if(tokens.map(token=>token.raw).join("")!==text)return text?[{id:"source",kind:"source",raw:content}]:[];
 const blocks:Block[]=[];
 for(const token of tokens){
  if(token.type==="space")continue;
  const raw=token.raw.trimEnd();
  const kind:Kind=token.type==="heading"&&/^#{1,6} /.test(raw)?"heading":
   image.test(raw)?"image":parseVideo(raw)?"video":exercise.test(raw)?"exercise":
   token.type==="list"?"list":token.type==="table"?"table":token.type==="blockquote"?"quote":token.type==="code"?"code":
   token.type==="paragraph"?"paragraph":"source";
  blocks.push({id:"block-"+blocks.length,kind,raw});
 }
 return blocks;
}
const imageMarkdown=(alt:string,assetId:string)=>"!["+alt.replace(/[\[\]\r\n]/g," ")+"](asset:"+assetId+")";
const exerciseMarkdown=(value:string)=>"> **Latihan**\n>\n"+value.split("\n").map(line=>"> "+line).join("\n");
const TYPEFACES=[
 {name:"Times New Roman",value:"Times New Roman"},
 {name:"Arial",value:"Arial"},
 {name:"Calibri",value:"Calibri"},
 {name:"Cambria",value:"Cambria"},
 {name:"Garamond",value:"Garamond"},
 {name:"Georgia",value:"Georgia"},
 {name:"Helvetica",value:"Helvetica"},
 {name:"Palatino",value:"Palatino"},
 {name:"Noto Serif",value:"Noto Serif"},
 {name:"Noto Sans",value:"Noto Sans"},
 {name:"Liberation Serif",value:"Liberation Serif"},
 {name:"Liberation Sans",value:"Liberation Sans"},
 {name:"DejaVu Serif",value:"DejaVu Serif"},
 {name:"DejaVu Sans",value:"DejaVu Sans"}
] as const;
const FONT_SIZES=[9,10,11,12,14,16,18,20,24,28,32,36,48] as const;
const TEXT_COLORS=[{name:"Hitam",value:"#222222"},{name:"Biru",value:"#164eae"},{name:"Merah",value:"#b91c1c"},{name:"Hijau",value:"#166534"},{name:"Ungu",value:"#6b21a8"},{name:"Abu-abu",value:"#64748b"}] as const;
type EditorialIssue={id:string;severity:"warning"|"info";label:string;detail:string};
function editorialAudit(title:string,content:string,chapters:Chapter[]):EditorialIssue[]{
 const issues:EditorialIssue[]=[];
 const add=(id:string,severity:"warning"|"info",label:string,detail:string)=>issues.push({id,severity,label,detail});
 if(title.trim().length<2)add("title","warning","Judul bab terlalu singkat","Gunakan judul bab sekurang-kurangnya dua karakter.");
 if(content.trim().length<20)add("content","warning","Isi bab belum cukup untuk autosave","Minimal 20 karakter diperlukan sebelum dikirim ke server.");
 const headings=[...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(m=>({level:m[1].length,title:m[2].trim()}));
 const seen=new Set<string>();
 for(const heading of headings){
  const key=heading.title.toLocaleLowerCase("id-ID");
  if(seen.has(key)){add("duplicate-heading-"+key,"warning","Judul bagian berulang","Periksa judul «"+heading.title+"» agar pembaca tidak bingung.");break}
  seen.add(key);
 }
 for(let i=1;i<headings.length;i++)if(headings[i].level>headings[i-1].level+1){
  add("heading-level","warning","Tingkat judul meloncat","Setelah heading "+headings[i-1].level+", jangan langsung meloncat ke heading "+headings[i].level+".");break
 }
 const references=[...content.matchAll(/@(?:fig|tbl|eq|sec)-[a-z0-9:_-]+/gi)].map(m=>m[0].slice(1));
 const labels=new Set([...content.matchAll(/\{#((?:fig|tbl|eq|sec)-[a-z0-9:_-]+)[^}]*\}/gi)].map(m=>m[1]));
 const missing=[...new Set(references.filter(ref=>!labels.has(ref)))];
 if(missing.length)add("refs","warning","Rujukan silang belum ditemukan","Pastikan label ada untuk: "+missing.slice(0,5).join(", ")+".");
 const placeholder=/\b(?:TODO|TBD|lorem ipsum|VIDEO_ID|contoh2026)\b|(?:\.\.\.)/i;
 if(placeholder.test(content))add("placeholder","info","Masih ada placeholder","Ganti penanda contoh dengan isi final yang sesuai bab.");
 if(/!\[([\s\S]*?)\]\((?:asset:|images\/)/.test(content)&&/!\[\s*\]\(/.test(content))add("alt","warning","Ada gambar tanpa teks alternatif","Isi alt text untuk pembaca dengan pembaca layar.");
 if(chapters.some(ch=>ch.title.trim().toLocaleLowerCase("id-ID")===title.trim().toLocaleLowerCase("id-ID")&&ch.title!==title))add("similar-title","info","Periksa kemiripan judul bab","Pastikan judul tiap bab mencerminkan cakupannya.");
 if(!headings.length&&content.trim().length>900)add("structure","info","Subbagian mungkin diperlukan","Pertimbangkan pemecahan paragraf panjang dengan subjudul yang jelas.");
 return issues;
}
function assemble(blocks:Block[]){return blocks.map(block=>wrapBlockLayout(block.raw,block.layout).trimEnd()).filter(Boolean).join("\n\n")}
function contentValue(block:Block){
 if(block.kind==="heading")return block.raw.replace(/^#{1,6} /,"");
 if(block.kind==="exercise")return block.raw.replace(/^> \*\*Latihan\*\*\n>\n/,"").split("\n").map(line=>line.replace(/^> ?/,"")).join("\n");
 return block.raw;
}
export default function DraftBlockCanvas({bookId,chapters,bookContext="",initialChapterId="",onChanged}:{
 bookId:string;chapters:Chapter[];bookContext?:string;initialChapterId?:string;onChanged:()=>Promise<void>;
}){
 const [selected,setSelected]=useState(chapters.find(item=>item.id===initialChapterId)?.id??chapters[0]?.id??"");
 const [newTitle,setNewTitle]=useState("");
 const [adding,setAdding]=useState(false);
 const [chapterError,setChapterError]=useState("");
 const [pending,setPending]=useState(false);
 const chapter=chapters.find(item=>item.id===selected)??chapters[0];
 async function archiveChapter(item:Chapter){
  if(adding||pending)return;
  if(!confirm("Arsipkan bab "+item.title+"? Isi dan revisinya tetap tersedia untuk pemulihan."))return;
  setAdding(true);setChapterError("");
  try{
   const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/chapters/"+encodeURIComponent(item.id),{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:item.updatedAt})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Bab gagal diarsipkan.");
   if(selected===item.id)setSelected(chapters.find(c=>c.id!==item.id)?.id??"");
   await onChanged();
  }catch(e){setChapterError(e instanceof Error?e.message:"Bab gagal diarsipkan.")}
  finally{setAdding(false)}
 }
 async function createChapter(){
  if(newTitle.trim().length<2||adding||pending)return;
  setAdding(true);setChapterError("");
  try{
   const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/chapters",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:newTitle.trim(),outlineObjective:"Susun isi dan tujuan bab ini."})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Bab gagal dibuat.");
   setNewTitle("");setSelected(data.chapter.id);await onChanged();
  }catch(e){setChapterError(e instanceof Error?e.message:"Bab gagal dibuat.")}
  finally{setAdding(false)}
 }
 return <section className="panel layout-output writing-workspace" role="region" aria-label="Kanvas naskah draf" style={{fontFamily:"DM Sans Variable, sans-serif"}}>
  <div className="writing-workspace-heading"><div><h2 id="draft-block-title">Studio Penulisan</h2><p className="form-hint">Fokus pada naskah. Konten tersimpan otomatis ke database saat valid dan dapat dipulihkan melalui riwayat revisi.</p></div><span>{chapters.length} bab</span></div>
  <details className="writing-chapter-manager"><summary>Kelola bab · tambah dan pilih bab</summary>
   <div className="writing-chapter-list">{chapters.map((c,i)=><div className="writing-chapter-item" key={c.id}><button type="button" className={c.id===chapter?.id?"primary-button":"secondary-button"} disabled={adding||pending} onClick={()=>setSelected(c.id)}>{i+1}. {c.title}</button><button type="button" className="secondary-button" aria-label={"Arsipkan "+c.title} title={"Arsipkan "+c.title} disabled={adding||pending} onClick={()=>void archiveChapter(c)}>Arsip</button></div>)}</div>
   <form onSubmit={event=>{event.preventDefault();void createChapter()}} className="writing-chapter-create"><label className="studio-field"><span>Bab baru</span><input value={newTitle} maxLength={180} onChange={e=>setNewTitle(e.target.value)} placeholder="Judul bab berikutnya"/></label><button className="primary-button" type="submit" disabled={adding||pending||newTitle.trim().length<2}>{adding?"Membuat…":"Tambah bab"}</button></form>
   {chapterError&&<p role="alert">{chapterError}</p>}
  </details>
  {chapter?<DraftChapterCanvas key={chapter.id} bookId={bookId} chapter={chapter} chapters={chapters} bookContext={bookContext} onSelect={setSelected} onChanged={onChanged} onPendingChange={setPending}/>
   :<p>Tambahkan bab dari Rancang atau Studio Penulisan untuk mulai mengedit.</p>}
 </section>;
}
type DraftEdit={title:string;blocks:Block[]};
type DraftHistory={past:DraftEdit[];present:DraftEdit;future:DraftEdit[]};
type DraftAction={type:"title";value:string}|{type:"blocks";value:SetStateAction<Block[]>}|{type:"undo"|"redo"};
function editHistory(history:DraftHistory,action:DraftAction):DraftHistory{
 const {past,present,future}=history;
 if(action.type==="undo")return past.length?{past:past.slice(0,-1),present:past.at(-1)!,future:[present,...future]}:history;
 if(action.type==="redo")return future.length?{past:[...past,present],present:future[0],future:future.slice(1)}:history;
 const next=action.type==="title"?{...present,title:action.value}:action.type==="blocks"?{...present,blocks:typeof action.value==="function"?action.value(present.blocks):action.value}:present;
 return next.title===present.title&&next.blocks===present.blocks?history:{past:[...past.slice(-79),present],present:next,future:[]};
}

function DraftChapterCanvas({bookId,chapter,chapters,bookContext="",onSelect,onChanged,onPendingChange}:{
 bookId:string;chapter:Chapter;chapters:Chapter[];bookContext?:string;onSelect:(id:string)=>void;onChanged:()=>Promise<void>;onPendingChange:(value:boolean)=>void;
}){
 const [history,dispatchEdit]=useReducer(editHistory,chapter,item=>({past:[],present:{title:item.title,blocks:split(item.content)},future:[]}));
 const {title,blocks}=history.present;
 const setTitle=(value:string)=>dispatchEdit({type:"title",value});
 const setBlocks=(value:SetStateAction<Block[]>)=>dispatchEdit({type:"blocks",value});
 const [activeBlockId,setActiveBlockId]=useState<string|null>(null);
 const inlinePreviewRef=useRef<HTMLDivElement|null>(null);
 const [saved,setSaved]=useState(chapter);
 const [bodyEdited,setBodyEdited]=useState(false);
 const [recoveredContent,setRecoveredContent]=useState<string|null>(null);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [assetError,setAssetError]=useState("");
 const [uploadOpen,setUploadOpen]=useState(false);
 const [uploadFile,setUploadFile]=useState<File|null>(null);
 const [uploadAlt,setUploadAlt]=useState("");
 const [uploadLicense,setUploadLicense]=useState("OWNED");
 const [uploadSource,setUploadSource]=useState("");
 const [uploadBusy,setUploadBusy]=useState(false);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [drag,setDrag]=useState<string|null>(null);
 const [view,setView]=useState<"editor"|"split"|"preview">("split");
 const [previewPaper,setPreviewPaper]=useState("a4");
 const [previewScope,setPreviewScope]=useState<"chapter"|"all">("chapter");
 const [styleScope,setStyleScope]=useState<"all"|"chapter">("all");
 const [readerPrefs,setReaderPrefs]=useState<{global:{font:"serif"|"sans";size:"small"|"medium"|"large"};chapters:Record<string,{font:"serif"|"sans";size:"small"|"medium"|"large"}>}>({global:{font:"serif",size:"medium"},chapters:{}});
 const [prefsLoaded,setPrefsLoaded]=useState(false);
 const readerCurrent=styleScope==="chapter"?(readerPrefs.chapters[chapter.id]??readerPrefs.global):readerPrefs.global;
 const readerSize=readerCurrent.size,readerFont=readerCurrent.font;
 function changeReaderPrefs(update:Partial<typeof readerCurrent>){
  setReaderPrefs(current=>styleScope==="all"?{...current,global:{...current.global,...update}}:{...current,chapters:{...current.chapters,[chapter.id]:{...(current.chapters[chapter.id]??current.global),...update}}});
 }
 useEffect(()=>{
  try{
   const raw=localStorage.getItem("bcstudio:reader:"+bookId);
   if(raw){const data=JSON.parse(raw);
    const valid=(v:unknown)=>!!v&&typeof v==="object"&&["serif","sans"].includes((v as {font?:string}).font||"")&&["small","medium","large"].includes((v as {size?:string}).size||"");
    if(valid(data.global)){
     const chapters:Record<string,{font:"serif"|"sans";size:"small"|"medium"|"large"}>={};
     if(data.chapters&&typeof data.chapters==="object")for(const [key,value] of Object.entries(data.chapters)){if(valid(value))chapters[key]=value as typeof chapters[string]}
     setReaderPrefs({global:data.global,chapters});
    }
   }
  }catch{}
  setPrefsLoaded(true);
 },[bookId]);
 useEffect(()=>{if(!prefsLoaded)return;try{localStorage.setItem("bcstudio:reader:"+bookId,JSON.stringify(readerPrefs))}catch{}},[bookId,prefsLoaded,readerPrefs]);
 const [focus,setFocus]=useState(false);
 const [libraryOpen,setLibraryOpen]=useState(false);
 const [tableRows,setTableRows]=useState(3);
 const [tableColumns,setTableColumns]=useState(3);
 const [recovery,setRecovery]=useState<Recovery|null>(null);
 const [recoveryReady,setRecoveryReady]=useState(false);
 const [storageError,setStorageError]=useState("");
 const [revisions,setRevisions]=useState<RevisionRecord[]|null>(null);
 const [outline,setOutline]=useState<OutlineSection[]>([]);
 const [outlineError,setOutlineError]=useState("");
 const [revisionBusy,setRevisionBusy]=useState(false);
 const recoveryKey="bcstudio:canvas-draft:"+bookId+":"+chapter.id;
 const content=bodyEdited?assemble(blocks):recoveredContent??chapter.content;
 const dirty=title.trim()!==saved.title||content.trim()!==saved.content.trim();
 const detectedHeadings=quartoHeadings(content);
 const markdownTitle=detectedHeadings.find(item=>item.level===1)?.text||"";
 const manuscriptIndex=indexChapter(content,Math.max(0,chapters.findIndex(item=>item.id===chapter.id))+1);
 const markdownToc=manuscriptIndex.sections;
 useEffect(()=>{onPendingChange(dirty||busy||Boolean(error));},[dirty,busy,error,onPendingChange]);
 const url="/api/books/"+encodeURIComponent(bookId);
 const valid=title.trim().length>=2&&content.trim().length>=20&&content.length<=200000;
 const wordCount=content.trim()?content.trim().split(/\s+/).length:0;
 const qualityIssues=editorialAudit(title,content,chapters);
 const previewItems=previewScope==="all"?chapters.map(item=>({id:item.id,title:item.id===chapter.id?title:item.title,content:item.id===chapter.id?content:item.content})): [{id:chapter.id,title,content}];
 const previewReadable=(source:string)=>source.replace(/:::\s*\{style="text-align:\s*(?:left|center|right)"\}\s*/g," ").replace(/\s*:::(?=\s|<|$)/g," ").replace(/<span[^>]*>\s*<\/span>/g,"");
 const activeIndex=blocks.findIndex(block=>block.id===activeBlockId);
 const activeBlock=blocks[activeIndex];
 const activeLabel=activeBlock?labels[activeBlock.kind]+" "+(activeIndex+1):"";
 const previewHtml=renderBookPreview(previewItems.map(item=>({...item,content:cleanAlignmentArtifacts(item.content)})),bookId,activeBlock?{
  chapterIndex:previewScope==="all"?chapters.findIndex(item=>item.id===chapter.id):0,
  id:activeBlock.id,raw:activeBlock.raw,occurrence:blocks.slice(0,activeIndex).filter(item=>item.raw===activeBlock.raw).length,label:activeLabel
 }:undefined,blocks.map((block,index)=>({chapterIndex:previewScope==="all"?chapters.findIndex(item=>item.id===chapter.id):0,id:block.id,raw:wrapBlockLayout(block.raw,block.layout),label:labels[block.kind]+" "+(index+1)})));
 function selectPreviewBlock(blockId:string){
  if(!blocks.some(block=>block.id===blockId))return;
  setActiveBlockId(blockId);setView(current=>current==="preview"?"split":current);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const row=document.querySelector<HTMLElement>('[data-editor-block-id="'+CSS.escape(blockId)+'"]');
   const detail=row?.querySelector<HTMLDetailsElement>("details.writing-block-item");if(detail)detail.open=true;
   row?.scrollIntoView({block:"center",behavior:"auto"});
   (row?.querySelector<HTMLElement>("textarea[data-draft-block]")??row?.querySelector<HTMLElement>("input,select")??row?.querySelector<HTMLElement>("summary"))?.focus({preventScroll:true});
  }));
 }
 function onPreviewClick(event:React.MouseEvent<HTMLDivElement>){
  const target=event.target as HTMLElement;
  if(target.closest("a,input,select,textarea")||window.getSelection()?.toString())return;
  const blockId=target.closest<HTMLElement>("[data-preview-block-id]")?.dataset.previewBlockId;
  if(blockId)selectPreviewBlock(blockId);
 }
 useEffect(()=>{inlinePreviewRef.current?.querySelector(".book-editing-target")?.scrollIntoView({block:"nearest",behavior:"auto"})},[activeBlockId,view,previewScope]);
 const liveChannelName="bcstudio:live-preview:"+bookId+":"+chapter.id;
 useEffect(()=>{
  if(typeof BroadcastChannel==="undefined")return;
  const channel=new BroadcastChannel(liveChannelName);
  const publish=()=>channel.postMessage({type:"snapshot",bookId,chapterId:chapter.id,title,html:previewHtml,activeBlockId:activeBlock?activeBlock.id:null,activeLabel,paper:previewPaper,dirty,scope:previewScope,font:readerFont,size:readerSize,updatedAt:Date.now()});
  channel.onmessage=event=>{
   const message=event.data as {type?:string;presetId?:string;requestId?:string;blockId?:string;bookId?:string;chapterId?:string};
   if(message?.type==="request"){publish();return}
   if(message?.type==="select-block"&&message.bookId===bookId&&message.chapterId===chapter.id&&typeof message.blockId==="string"){selectPreviewBlock(message.blockId);return}
   if(message?.type==="insert-preset"&&typeof message.presetId==="string"&&typeof message.requestId==="string"){
    const preset=BLOCK_PRESETS.find(item=>item.id===message.presetId);
    const reject=(reason:string)=>channel.postMessage({type:"insert-result",requestId:message.requestId,ok:false,reason});
    if(!preset){reject("Komponen tidak dikenal.");return}
    if(busy||recovery||!recoveryReady){reject(busy?"Editor sedang menyimpan. Coba lagi sebentar.":"Selesaikan pemulihan draf terlebih dahulu.");return}
    setError("");setBodyEdited(true);
    setBlocks(current=>{
     const block={id:crypto.randomUUID(),kind:preset.kind,raw:preset.raw};
     return preset.id==="chapter-opener"?[block,...current]:[...current,block];
    });
    channel.postMessage({type:"insert-result",requestId:message.requestId,ok:true,label:preset.label});
   }
  };
  publish();
  return ()=>{channel.close()};
 },[liveChannelName,bookId,chapter.id,title,previewHtml,dirty,previewScope,previewPaper,readerFont,readerSize,busy,recovery,recoveryReady,activeBlockId,activeLabel,blocks]);
 function openLivePreview(){
  const target="/studio/live-preview?bookId="+encodeURIComponent(bookId)+"&chapterId="+encodeURIComponent(chapter.id);
  const popup=window.open(target,"bcstudio-preview-"+bookId+"-"+chapter.id,"popup=yes,width=1440,height=960,resizable=yes,scrollbars=yes");
  if(!popup)setError("Browser memblokir jendela pratinjau. Izinkan pop-up untuk situs lokal ini.");
  else popup.focus();
 }

 useEffect(()=>{
  try{
   const raw=sessionStorage.getItem(recoveryKey);
   if(raw){
    const draft=JSON.parse(raw);
    if(typeof draft.title!=="string"||draft.title.length>180||typeof draft.content!=="string"||draft.content.length>200000||typeof draft.version!=="string"||!Number.isFinite(Date.parse(draft.version)))throw Error("invalid");
    if(draft.title!==chapter.title||draft.content!==chapter.content)setRecovery(draft);
    else sessionStorage.removeItem(recoveryKey);
   }
  }catch{setStorageError("Pemulihan lokal tidak tersedia. Unduh draf sebelum meninggalkan halaman.")}
  setRecoveryReady(true);
 },[recoveryKey]);
 useEffect(()=>{
  if(!recoveryReady||recovery)return;
  try{
   if(dirty)sessionStorage.setItem(recoveryKey,JSON.stringify({title,content,version:saved.updatedAt}));
   else sessionStorage.removeItem(recoveryKey);
  }catch{setStorageError("Draf belum dicadangkan di tab ini. Unduh draf sebelum meninggalkan halaman.")}
 },[content,dirty,recovery,recoveryKey,recoveryReady,saved.updatedAt,title]);
 function downloadDraft(draft:{title:string;content:string}){
  const href=URL.createObjectURL(new Blob(["# "+draft.title+"\n\n"+draft.content],{type:"text/markdown;charset=utf-8"}));
  const link=document.createElement("a");link.href=href;link.download="draf-pemulihan.md";link.click();
  window.setTimeout(()=>URL.revokeObjectURL(href),1000);
 }
 function discardRecovery(){
  if(!confirm("Buang draf lokal dan gunakan versi server?"))return;
  try{sessionStorage.removeItem(recoveryKey)}catch{}
  setRecovery(null);
 }
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url+"/assets",{signal:controller.signal,cache:"no-store"}).then(async response=>{
   if(!response.ok)throw Error("Pustaka gambar gagal dimuat.");
   const data=await response.json();
   if(!controller.signal.aborted)setAssets(data.assets);
  }).catch(cause=>{if(!controller.signal.aborted)setAssetError(cause.message)});
  return()=>controller.abort();
 },[url]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url+"/chapters/"+encodeURIComponent(chapter.id)+"/sections",{signal:controller.signal,cache:"no-store"})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Kerangka gagal dimuat");if(!controller.signal.aborted)setOutline(data.sections||[])})
   .catch(e=>{if(!controller.signal.aborted)setOutlineError(e instanceof Error?e.message:"Kerangka tidak tersedia")});
  return()=>controller.abort();
 },[url,chapter.id]);
 useEffect(()=>{
  if(!recoveryReady||recovery||!dirty||!valid||busy||error||drag!==null)return;
  const timer=window.setTimeout(async()=>{
   setBusy(true);
   try{
    const response=await fetch(url+"/chapters/"+encodeURIComponent(chapter.id),{
     method:"PATCH",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({title:title.trim(),content,expectedVersion:saved.updatedAt}),
    });
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Bab gagal disimpan.");
    setSaved(data.chapter);
    await onChanged();
   }catch(cause){setError(cause instanceof Error?cause.message:"Bab gagal disimpan.")}
   finally{setBusy(false)}
  },850);
  return()=>window.clearTimeout(timer);
 },[busy,chapter.id,content,dirty,drag,error,onChanged,recovery,recoveryReady,saved.updatedAt,title,url,valid]);
 useEffect(()=>{
  if(!dirty&&!busy)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};
  window.addEventListener("beforeunload",warn);
  return()=>window.removeEventListener("beforeunload",warn);
 },[busy,dirty]);
 function update(id:string,raw:string){setBodyEdited(true);setBlocks(current=>current.map(block=>block.id===id?{...block,raw}:block))}
 function move(id:string,target:string){
  if(busy||recovery||!recoveryReady||id===target)return;
  setBodyEdited(true);
  setBlocks(current=>{
   const next=current.slice();
   const from=next.findIndex(block=>block.id===id);
   if(from<0)return current;
   const [block]=next.splice(from,1);
   const targetIndex=next.findIndex(item=>item.id===target);
   if(targetIndex<0)return current;
   next.splice(targetIndex,0,block);
   return next;
  });
 }
 function insertAfter(id:string,kind:Kind,raw:string){
  if(busy||recovery||!recoveryReady)return;
  setBodyEdited(true);
  setBlocks(current=>{const index=current.findIndex(item=>item.id===id);const next=current.slice();next.splice(index<0?next.length:index+1,0,{id:crypto.randomUUID(),kind,raw});return next});
 }
 function applyTextFormat(block:Block,command:string,value=""){
  if(busy||recovery||!recoveryReady)return;
  const input=document.querySelector<HTMLTextAreaElement>('[data-draft-block="'+block.id+'"]');
  if(!input)return;
  const alignment=/^align-(left|center|right)$/.exec(command)?.[1];
 if(alignment){
  const body=block.raw.replace(/^::: {style="text-align: (?:left|center|right)"}\n([\s\S]*?)\n:::$/, "$1");
  setBodyEdited(true);
  setBlocks(current=>current.map(item=>item.id===block.id?{...item,kind:"source",raw:'::: {style="text-align: '+alignment+'"}\n'+body+"\n:::"}:item));
  return;
 }
 const initial=contentValue(block),start=input.selectionStart,end=input.selectionEnd;
  const selection=initial.slice(start,end)||"teks";
  let result="";
  const safe=value.replace(/[^a-zA-Z0-9 #.,-]/g,"");
  switch(command){
   case "bold":result="**"+selection+"**";break;
   case "italic":result="*"+selection+"*";break;
   case "underline":result="<u>"+selection+"</u>";break;
   case "strike":result="~~"+selection+"~~";break;
   case "link":result="["+selection+"](https://example.org)";break;
   case "font":result='<span style="font-family:'+safe+'">'+selection+"</span>";break;
   case "size":result='<span style="font-size:'+safe+'pt">'+selection+"</span>";break;
   case "color":result='<span style="color:'+safe+'">'+selection+"</span>";break;
   case "highlight":result='<mark>'+selection+"</mark>";break;
   case "bullet":result="- "+selection.split("\n").join("\n- ");break;
   case "number":result=selection.split("\n").map((line,i)=>String(i+1)+". "+line).join("\n");break;
   case "indent":result="> "+selection.split("\n").join("\n> ");break;
   default:return;
  }
  const next=initial.slice(0,start)+result+initial.slice(end);
  update(block.id,block.kind==="heading"?(block.raw.match(/^#{1,6}/)?.[0]??"##")+" "+next.replace(/\r?\n/g," "):block.kind==="exercise"?exerciseMarkdown(next):next);
  requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+result.length,start+result.length)});
 }
 async function uploadAndInsertImage(){
  if(!uploadFile||uploadAlt.trim().length<5||uploadBusy||busy)return;
  setUploadBusy(true);setAssetError("");
  try{
   const prepared=await prepareImageUpload(uploadFile);
   const response=await fetch(url+"/assets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...prepared,altText:uploadAlt.trim().slice(0,180),license:uploadLicense,...(uploadSource.trim()?{sourceUrl:uploadSource.trim()}:{})})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Gambar gagal diunggah.");
   setAssets(current=>[result.asset,...current]);
   setBodyEdited(true);setBlocks(current=>[...current,{id:crypto.randomUUID(),kind:"image",raw:imageMarkdown(result.asset.altText,result.asset.id)}]);
   setUploadFile(null);setUploadAlt("");setUploadSource("");setUploadOpen(false);
  }catch(e){setAssetError(e instanceof Error?e.message:"Gambar gagal diunggah.")}
  finally{setUploadBusy(false)}
 }
 function addTableAfter(blockId:string,rows:number,columns:number){
  const safeRows=Math.max(1,Math.min(20,rows)),safeColumns=Math.max(1,Math.min(10,columns));
  const cells=Array.from({length:safeColumns},(_,i)=>"Kolom "+(i+1));
  const row=Array.from({length:safeColumns},()=> "Isi");
  const raw="| "+cells.join(" | ")+" |\n| "+cells.map(()=> "---").join(" | ")+" |\n"+Array.from({length:safeRows},()=> "| "+row.join(" | ")+" |").join("\n");
  insertAfter(blockId,"table",raw);
 }
 function insertPreset(presetId:string,targetId?:string){
  if(busy||recovery||!recoveryReady)return;
  const preset=BLOCK_PRESETS.find(item=>item.id===presetId);
  if(!preset)return;
  setError("");setBodyEdited(true);
  setBlocks(current=>{
   const next=current.slice();
   const index=targetId?next.findIndex(item=>item.id===targetId):-1;
   next.splice(index<0?(preset.id==="chapter-opener"?0:next.length):index,0,{id:crypto.randomUUID(),kind:preset.kind,raw:preset.raw});
   return next;
  });
 }
 function onCanvasDrop(targetId?:string){
  if(!drag)return;
  if(drag.startsWith("preset:"))insertPreset(drag.slice(7),targetId);
  else if(targetId)move(drag,targetId);
  else if(!drag.startsWith("preset:")){
   if(busy||recovery||!recoveryReady)return;
   setBodyEdited(true);
   setBlocks(current=>{
    const from=current.findIndex(item=>item.id===drag);
    if(from<0||from===current.length-1)return current;
    const next=current.slice();
    const [item]=next.splice(from,1);
    next.push(item);
    return next;
   });
  }
  setDrag(null);
 }
 async function loadRevisions(){
  setRevisionBusy(true);setError("");
  try{const r=await fetch(url+"/chapters/"+encodeURIComponent(chapter.id),{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Riwayat gagal dimuat");setRevisions(data.chapter.revisions||[])}
  catch(e){setError(e instanceof Error?e.message:"Riwayat gagal dimuat")}finally{setRevisionBusy(false)}
 }
 async function restoreRevision(revision:number){
  if(dirty||busy||revisionBusy)return;
  if(!confirm("Pulihkan revisi "+revision+"? Naskah saat ini akan disimpan sebagai revisi baru."))return;
  setRevisionBusy(true);setError("");
  try{const r=await fetch(url+"/chapters/"+encodeURIComponent(chapter.id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({restoreRevision:revision,expectedVersion:saved.updatedAt})});const data=await r.json();if(!r.ok)throw Error(data.error||"Pemulihan gagal");
   setSaved(data.chapter);setTitle(data.chapter.title);setBlocks(split(data.chapter.content));setRecoveredContent(null);setBodyEdited(false);setRevisions(null);await onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Pemulihan gagal")}finally{setRevisionBusy(false)}
 }
 function insertHeading(section:OutlineSection){
  if(busy||recovery||!recoveryReady)return;
  const raw=(section.parentId?"### ":"## ")+section.title;
  setBodyEdited(true);setBlocks(current=>[...current,{id:crypto.randomUUID(),kind:"heading",raw}]);
 }
 function duplicateBlock(id:string){
  setBodyEdited(true);setBlocks(current=>{const index=current.findIndex(item=>item.id===id);if(index<0)return current;const next=current.slice();next.splice(index+1,0,{...next[index],id:crypto.randomUUID()});return next});
 }
 async function saveNow(){
  if(!dirty||!valid||busy||recovery||!recoveryReady)return;
  setBusy(true);setError("");
  try{const response=await fetch(url+"/chapters/"+encodeURIComponent(chapter.id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title.trim(),content,expectedVersion:saved.updatedAt})});const data=await response.json();if(!response.ok)throw Error(data.error||"Naskah gagal disimpan");setSaved(data.chapter);await onChanged()}
  catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan");}
  finally{setBusy(false)}
 }
 function add(kind:Exclude<Kind,"source">){
  const asset=assets[0];
  if(kind==="image"&&!asset)return;
  const raw=kind==="heading"?"## Judul bagian":kind==="exercise"?exerciseMarkdown("Tulis pertanyaan latihan."):kind==="image"?imageMarkdown(asset.altText,asset.id):kind==="list"?"- Butir pertama\n- Butir kedua":kind==="table"?"| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Isi | Isi |":kind==="quote"?"> Masukkan kutipan dengan sumber yang telah diverifikasi.":kind==="code"?"\`\`\`\nContoh kode\n\`\`\`":"Tulis paragraf di sini.";
  setBodyEdited(true);
  setBlocks(current=>[...current,{id:crypto.randomUUID(),kind,raw}]);
 }
 function stepHistory(type:"undo"|"redo"){
  if(busy||recovery||(type==="undo"?!history.past.length:!history.future.length))return;
  setBodyEdited(true);dispatchEdit({type});
 }
 return <div className="draft-edit-surface" onKeyDownCapture={event=>{
  if(event.nativeEvent.isComposing||event.altKey||!(event.ctrlKey||event.metaKey))return;
  const key=event.key.toLowerCase();
  if(key!=="z"&&key!=="y")return;
  event.preventDefault();stepHistory(key==="y"||event.shiftKey?"redo":"undo");
 }}>
  <style>{bookSidebarCss}</style>
  {storageError&&<><p role="alert">{storageError}</p>{dirty&&!recovery&&<button type="button" className="secondary-button" onClick={()=>downloadDraft({title,content})}>Unduh draf cadangan</button>}</>}
  {recovery&&<section className="panel" aria-label="Pemulihan draf kanvas">
   <h3>Draf yang belum tersimpan ditemukan</h3>
   <p>Draf tersedia di tab ini. Pilih pulihkan untuk melanjutkan, atau unduh sebelum memakai versi server.</p>
   {recovery.version!==chapter.updatedAt&&<p role="alert">Versi server sudah berubah. Draf pemulihan tetap memakai versi asal agar perubahan orang lain tidak tertimpa.</p>}
   <button type="button" className="primary-button" onClick={()=>{
    setTitle(recovery.title);setBlocks(split(recovery.content));setRecoveredContent(recovery.content);setBodyEdited(false);
    setSaved(current=>({...current,updatedAt:recovery.version}));setRecovery(null);
   }}>Pulihkan draf lokal</button>
   <button type="button" className="secondary-button" onClick={()=>downloadDraft(recovery)}>Unduh draf pemulihan</button>
   <button type="button" className="secondary-button" onClick={discardRecovery}>Gunakan versi server</button>
  </section>}
  <div className="writing-studio-toolbar" role="toolbar" aria-label="Pengaturan ruang menulis">
   <div className="writing-mode-toggle">
    {(["editor","split","preview"] as const).map(mode=><button key={mode} type="button" aria-pressed={view===mode} className={view===mode?"primary-button":"secondary-button"} onClick={()=>setView(mode)}>{mode==="editor"?"Menulis":mode==="split"?"Menulis + Pratinjau":"Pratinjau"}</button>)}
   </div>
   <button type="button" className="secondary-button" onClick={()=>{const target="/studio/editor?bookId="+encodeURIComponent(bookId)+"&chapterId="+encodeURIComponent(chapter.id);const popup=window.open(target,"_blank");if(!popup)setError("Browser memblokir tab editor. Izinkan pop-up untuk situs ini.");else popup.focus()}}>Buka editor layar penuh</button>
    <button type="button" className="secondary-button" onClick={openLivePreview} title="Buka pratinjau pada tab browser terpisah; perubahan CRUD ditampilkan langsung">↗ Buka tab pratinjau live</button>
   <button type="button" className="secondary-button" aria-pressed={focus} onClick={()=>setFocus(x=>!x)}>{focus?"Tampilkan alat":"Fokus menulis"}</button>
   <span className="writing-word-count">{wordCount.toLocaleString("id-ID")} kata · {blocks.length} blok</span>
  </div>
  <div className={"writing-studio-shell"+(focus?" is-focused":"")+(view==="split"?" is-split":"")}>
  <aside className="writing-component-sidebar writing-optional" aria-label="Pustaka komponen buku">
   <h3>Komponen buku</h3>
   <p className="form-hint">Klik <strong>Tambah</strong> atau tarik ke blok yang diinginkan.</p>
   <div className="writing-palette-contents">
   {presetGroups.map(group=><details key={group} open={group==="Struktur"}>
    <summary>{group}</summary>
    <div className="draft-palette-grid">
     {BLOCK_PRESETS.filter(item=>item.group===group).map(item=><div className="draft-palette-item" key={item.id} draggable={!busy&&!recovery} onDragStart={event=>{setDrag("preset:"+item.id);event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData("application/x-bcstudio-component",item.id);event.dataTransfer.setData("text/plain","preset:"+item.id)}} onDragEnd={()=>setDrag(null)}>
      <span aria-hidden="true" className="draft-palette-grip">⠿</span><span>{item.label}</span>
      <button type="button" className="secondary-button" onClick={()=>insertPreset(item.id)} disabled={busy||Boolean(recovery)}>Tambah</button>
     </div>)}
    </div>
   </details>)}
   <div className="draft-palette-grid">
    <div className="draft-palette-item"><span>Gambar dari pustaka aset</span><button type="button" className="secondary-button" disabled={busy||!assets.length} onClick={()=>add("image")}>Tambah gambar</button></div>
   </div>
   </div>
   <div className="writing-sidebar-end" aria-label="Tambahkan komponen di akhir bab" onDragOver={event=>{if(drag&&!busy)event.preventDefault()}} onDrop={event=>{event.preventDefault();onCanvasDrop()}}>
    <strong>+ Tambah di akhir bab</strong>
    <small>Tarik komponen ke sini, atau klik Tambah pada daftar.</small>
   </div>
  </aside>
  <div className="writing-studio-editor" hidden={view==="preview"}>
  <fieldset disabled={!recoveryReady||Boolean(recovery)} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <legend className="sr-only">Penyuntingan bab</legend>
  <label className="studio-field"><span>Bab aktif</span><select value={chapter.id} disabled={busy||dirty||Boolean(error)} onChange={event=>onSelect(event.target.value)}>{chapters.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
  <label className="studio-field"><span>Judul bab (editor blok)</span><input maxLength={180} value={title} onChange={event=>setTitle(event.target.value)}/></label>
  <section className="panel" aria-label="Daftar isi otomatis dari Quarto Markdown">
   <h3>Judul dan daftar isi otomatis (Quarto Markdown)</h3>
   <p className="form-hint">Heading # menawarkan judul bab, sedangkan ## dan ### membentuk daftar isi otomatis. Judul manual tidak ditimpa tanpa persetujuan. Autosave tetap aktif.</p>
   {markdownTitle&&markdownTitle!==title&&<button type="button" className="secondary-button" disabled={busy||Boolean(recovery)} onClick={()=>setTitle(markdownTitle.slice(0,180))}>Gunakan judul dari Markdown: {markdownTitle}</button>}
   {!markdownTitle&&<p className="form-hint">Tambahkan # Judul Bab di Markdown untuk menghasilkan judul.</p>}
   {markdownToc.length?<nav aria-label="Daftar isi naskah saat ini"><ul>{markdownToc.map(heading=><li key={heading.number}><strong>{heading.number}</strong> {heading.title}</li>)}</ul></nav>:<p className="form-hint">Tambahkan ## Judul bagian dan ### Subbagian untuk menghasilkan daftar isi.</p>}
   {([["Daftar gambar",manuscriptIndex.figures],["Daftar tabel",manuscriptIndex.tables],["Daftar persamaan",manuscriptIndex.equations]] as const).map(([label,entries])=>entries.length>0&&<details key={label}><summary>{label} ({entries.length})</summary><ul>{entries.map(entry=><li key={entry.number}><strong>{entry.number}</strong> {entry.title}</li>)}</ul></details>)}
   <p className="form-hint">Nomor mengikuti urutan bab dan elemen. Persamaan tampilan masuk daftar bila diberi label seperti <code>{"{#eq-usaha}"}</code>.</p>
   {!markdownToc.length&&outline.filter(item=>!item.archivedAt).length>0&&<button type="button" className="secondary-button" disabled={busy||Boolean(recovery)} onClick={()=>{setBodyEdited(true);setBlocks(current=>[...current,...outline.filter(item=>!item.archivedAt).sort((a,b)=>a.position-b.position).map(item=>({id:crypto.randomUUID(),kind:"heading" as const,raw:(item.parentId?"### ":"## ")+item.title}))])}}>Buat daftar isi dari kerangka Stage 2</button>}
  </section>
  <details className="stage-transfer-panel writing-optional">
   <summary>Template Stage 3 — Naskah bab dan prompt AI</summary>
   <FormTransfer name="Stage 3 Naskah Bab" bookId={bookId} fields={WRITING_TRANSFER_FIELDS}
    values={{title,content}} disabled={busy||Boolean(recovery)||!recoveryReady}
    aiContext={`STAGE=TULIS; BRIEF STAGE 1: ${bookContext}; BAB=${chapter.title}; BUKU=${bookId}; BAB SEBELUM/LAINNYA: ${chapters.map((item,i)=>`${i+1}. ${item.title}`).join("; ")}; KERANGKA BAB: ${outline.filter(item=>!item.archivedAt).sort((a,b)=>a.position-b.position).map(item=>`${item.title}: ${item.objective}`).join("; ")}. Buat isi orisinal sesuai tujuan, genre serta pembaca Stage 1. Untuk nonfiction: contoh, penjelasan, aktivitas yang aman, rangkuman, latihan dan referensi yang dapat diverifikasi. Untuk fiction: alur, tokoh, konflik dan kesinambungan. Pertahankan field_id title/content, serta Markdown sebagai konten. Jangan mengarang bukti, lisensi, sitasi atau ISBN.`}
    onApply={(data:TransferRecord)=>{
     if(dirty&&!confirm("Ganti perubahan bab yang belum tersimpan dengan hasil impor?"))return;
     if(typeof data.title==="string")setTitle(data.title);
     if(typeof data.content==="string"){setBodyEdited(true);setRecoveredContent(null);setBlocks(split(data.content))}
    }}/>
   <p className="form-hint">Impor memuat isi ke editor blok dahulu. Periksa dan ubah sesuai kebutuhan, lalu gunakan Simpan sekarang (autosave juga tersedia). Versi lama tetap tercatat sebagai revisi.</p>
  </details>
  <details className="draft-outline-context writing-optional"><summary>Kerangka Stage 2 untuk bab ini</summary>
   <p className="form-hint">Kerangka berfungsi sebagai panduan. Tombol Sisipkan hanya menambah judul di draf dan tidak mengubah naskah yang telah disetujui.</p>
   {outlineError&&<p role="alert">{outlineError}</p>}
   {outline.filter(s=>!s.archivedAt).length===0&&<p>Belum ada subbagian tersimpan di Rancang.</p>}
   <ul>{outline.filter(s=>!s.archivedAt).sort((a,b)=>a.parentId===b.parentId?a.position-b.position:!a.parentId?-1:1).map(s=><li key={s.id} style={{marginLeft:s.parentId?16:0}}>
    <strong>{s.title}</strong><p>{s.objective}</p>
    <button type="button" className="secondary-button" disabled={busy||Boolean(recovery)} onClick={()=>insertHeading(s)}>Sisipkan judul {s.title}</button>
   </li>)}</ul>
  </details>
  <details className="writing-optional draft-image-upload" open={uploadOpen} onToggle={event=>setUploadOpen(event.currentTarget.open)}>
   <summary>+ Unggah gambar dan sisipkan ke naskah</summary>
   <p className="form-hint">PNG/JPEG maksimum 12 MB; gambar dioptimalkan sebelum disimpan. Wajib isi teks alternatif dan lisensi. Gambar akan langsung muncul sebagai blok setelah berhasil diunggah.</p>
   <div className="draft-image-upload-fields">
    <label>File gambar<input type="file" accept="image/png,image/jpeg" onChange={e=>setUploadFile(e.target.files?.[0]??null)}/></label>
    <label>Deskripsi alternatif<input value={uploadAlt} maxLength={180} onChange={e=>setUploadAlt(e.target.value)} placeholder="Jelaskan isi dan fungsi gambar"/></label>
    <label>Lisensi<select value={uploadLicense} onChange={e=>setUploadLicense(e.target.value)}><option value="OWNED">Karya sendiri</option><option value="CC0">CC0</option><option value="CC_BY">CC BY</option><option value="CC_BY_SA">CC BY-SA</option><option value="LICENSED">Berizin</option></select></label>
    <label>URL sumber (opsional, HTTPS)<input type="url" value={uploadSource} onChange={e=>setUploadSource(e.target.value)} placeholder="https://..."/></label>
    <button type="button" className="primary-button" disabled={uploadBusy||busy||!uploadFile||uploadAlt.trim().length<5} onClick={()=>void uploadAndInsertImage()}>{uploadBusy?"Mengunggah…":"Unggah & sisipkan"}</button>
   </div>
  </details>
  <InsertYouTube disabled={busy||Boolean(recovery)} onInsert={raw=>{setBodyEdited(true);setBlocks(current=>[...current,{id:crypto.randomUUID(),kind:"video",raw}])}}/>
  {assetError&&<p role="alert">{assetError}</p>}
  {!assets.length&&<p className="form-hint">Unggah gambar dengan lisensi di Studio Penulisan agar tersedia di kanvas.</p>}
  <details className="writing-quality-audit">
   <summary>Koherensi & kelengkapan bab · {qualityIssues.filter(item=>item.severity==="warning").length} perhatian, {qualityIssues.filter(item=>item.severity==="info").length} saran</summary>
   <p className="form-hint">Pemeriksaan editorial lokal ini hanya memberi petunjuk; bukan pengganti pemeriksaan fakta, bahasa, atribusi, atau kualitas isi oleh editor.</p>
   {qualityIssues.length===0?<p role="status">Tidak ada masalah struktur dasar yang terdeteksi. Periksa tetap ketepatan fakta dan kesinambungan isi.</p>:
   <ul>{qualityIssues.map(item=><li key={item.id}><strong>{item.severity==="warning"?"Perlu perhatian":"Saran"}: {item.label}</strong><p>{item.detail}</p></li>)}</ul>}
  </details>
  <div className="draft-save-toolbar"><button type="button" className="secondary-button" disabled={busy||Boolean(recovery)||!history.past.length} onClick={()=>stepHistory("undo")} aria-keyshortcuts="Control+Z Meta+Z">Undo</button><button type="button" className="secondary-button" disabled={busy||Boolean(recovery)||!history.future.length} onClick={()=>stepHistory("redo")} aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z">Redo</button><button type="button" className="primary-button" disabled={!dirty||!valid||busy||Boolean(recovery)} onClick={()=>void saveNow()}>Simpan sekarang</button><span className="form-hint">Autosave tetap aktif; naskah tidak akan ditimpa bila versi berubah.</span></div>
  <p role="status">{busy?"Menyimpan revisi…":error?"Perubahan belum tersimpan.":dirty&&!valid?"Judul minimal 2 karakter dan isi 20–200.000 karakter.":dirty?"Menunggu simpan otomatis…":"Naskah tersimpan."}</p>
  {error&&<><p role="alert">{error}</p><button type="button" className="secondary-button" onClick={()=>downloadDraft({title,content})}>Unduh draf lokal</button><button type="button" className="secondary-button" onClick={()=>{if(confirm("Muat versi server dan buang perubahan yang belum tersimpan?")){try{sessionStorage.removeItem(recoveryKey)}catch{}window.location.reload()}}}>Muat versi server</button></>}
  <details className="draft-revision-history"><summary>Riwayat revisi naskah</summary>
   <button type="button" className="secondary-button" disabled={revisionBusy||busy} onClick={()=>void loadRevisions()}>Muat riwayat</button>
   {revisionBusy&&<p role="status">Memuat riwayat...</p>}
   {revisions&&<ul>{revisions.map(r=><li key={r.revision}><details><summary>Revisi {r.revision} — {new Date(r.createdAt).toLocaleString("id-ID")}</summary><p><strong>{r.title}</strong></p><pre className="draft-revision-preview">{r.content}</pre><button type="button" className="secondary-button" disabled={dirty||busy||revisionBusy} onClick={()=>void restoreRevision(r.revision)}>Pulihkan revisi {r.revision}</button></details></li>)}</ul>}
   {revisions?.length===0&&<p>Belum ada revisi tersimpan.</p>}
  </details>
  <ol className={"book-layout-canvas writing-drop-canvas"+(drag?" is-drop-target":"")} aria-label="Blok naskah" onDragOver={event=>{if(drag&&!busy&&!recovery){event.preventDefault();event.dataTransfer.dropEffect=drag.startsWith("preset:")?"copy":"move"}}} onDrop={event=>{if(!drag)return;event.preventDefault();event.stopPropagation();onCanvasDrop()}}>
   {drag&&<li className="writing-canvas-drop-hint" aria-live="polite">Lepaskan komponen di sini untuk menambahkannya di akhir naskah.</li>}
   {blocks.length===0&&!drag&&<li className="writing-canvas-empty">Area menulis masih kosong. Tarik komponen dari panel kiri ke area ini, atau klik <strong>Tambah</strong> pada komponen.</li>}
   {blocks.map((block,index)=>{
    const ref=image.exec(block.raw.trimEnd());
    const sidebar=readSidebar(block.raw);
    const opener=readChapterOpener(block.raw);
    const recommendation=editorialBlockLayout(opener?"opener":sidebar?"sidebar":block.kind==="heading"?(/^#{3,}/.test(block.raw)?"subtitle":"title"):block.raw.trimStart().startsWith("$")?"equation":block.kind==="source"?"paragraph":block.kind);
    return <li className={"draft-block-status status-"+(contentValue(block).trim().length>=(block.kind==="heading"?2:15)?(dirty?"yellow":"green"):contentValue(block).trim().length?"yellow":"red")} key={block.id} data-editor-block-id={block.id} data-preview-selected={activeBlockId===block.id?"true":undefined} onFocusCapture={event=>{if((event.target as HTMLElement).matches("textarea,input,select"))setActiveBlockId(block.id)}} onDragOver={event=>{if(drag&&!busy)event.preventDefault()}} onDrop={event=>{event.preventDefault();event.stopPropagation();onCanvasDrop(block.id)}}>
     <span className="editor-selection-label" hidden={activeBlockId!==block.id}>Bagian aktif di editor</span>
     <details className="writing-block-item" open={index===0}>
      <summary><strong>{labels[block.kind]} {index+1}</strong><span className="writing-block-excerpt">{contentValue(block).replace(/<[^>]*>/g,"").replace(/:::[^\n]*/g,"").slice(0,70)||"Klik untuk mengisi konten"}</span></summary>
     <div className="chapter-sort-heading"><strong className="sr-only">{labels[block.kind]} {index+1}</strong><button type="button" className={"card-status-label status-action status-"+(contentValue(block).trim().length>=(block.kind==="heading"?2:15)?(dirty?"yellow":"green"):contentValue(block).trim().length?"yellow":"red")} aria-label={(contentValue(block).trim().length>=(block.kind==="heading"?2:15)?(dirty?"Dalam proses":"Lengkap"):contentValue(block).trim().length?"Dalam proses":"Belum lengkap")+" ? Periksa isi blok "+(index+1)} onClick={event=>{const li=event.currentTarget.closest("li");li?.querySelector<HTMLElement>("textarea,input,select")?.focus()}}>{contentValue(block).trim().length>=(block.kind==="heading"?2:15)?(dirty?"Dalam proses":"Lengkap"):contentValue(block).trim().length?"Dalam proses":"Belum lengkap"}</button>
      {blocks.length>1&&<span className="chapter-sort-handle" draggable={!busy} onDragStart={event=>{setDrag(block.id);event.dataTransfer.setData("text/plain",block.id)}} onDragEnd={()=>setDrag(null)}>Seret</span>}
     </div>
     <details className="draft-format-details"><summary>Tata letak blok</summary>
      <div className="draft-word-toolbar draft-layout-controls">
       {blockLayoutFields.map(([key,label,max])=><label key={key}>{label} (px)<input type="number" min={0} max={max} step={1} placeholder={String(recommendation[key])} value={block.layout?.[key]??""} disabled={busy} onChange={event=>{
        const raw=event.target.value;
        const value=raw===""?undefined:Math.min(max,Math.max(0,Math.round(Number(raw))));
        setBodyEdited(true);setBlocks(current=>current.map(item=>item.id===block.id?{...item,layout:{...item.layout,[key]:value}}:item));
       }}/></label>)}
       <button type="button" disabled={busy} onClick={()=>{setBodyEdited(true);setBlocks(current=>current.map(item=>item.id===block.id?{...item,layout:recommendation}:item))}}>Pakai ukuran rekomendasi</button>
       <button type="button" disabled={busy||!block.layout} onClick={()=>{setBodyEdited(true);setBlocks(current=>current.map(item=>item.id===block.id?{...item,layout:undefined}:item))}}>Reset tata letak blok</button>
      </div>
     </details>
     {!sidebar&&!opener&&block.kind!=="image"&&block.kind!=="video"&&<details className="draft-format-details"><summary>Format teks dan sisipan</summary><div className="draft-word-toolbar draft-format-grid" role="group" aria-label={"Pemformatan blok "+(index+1)}>
      <div className="draft-word-toolbar-group" aria-label="Format teks">
       {([["bold","B"],["italic","I"],["underline","U"],["strike","S"],["highlight","Sorot"],["link","Tautan"]] as const).map(([cmd,label])=><button key={cmd} type="button" title={{bold:"Tebal",italic:"Miring",underline:"Garis bawah",strike:"Coret",highlight:"Sorot",link:"Tautan"}[cmd]} aria-label={{bold:"Tebal",italic:"Miring",underline:"Garis bawah",strike:"Coret",highlight:"Sorot",link:"Tautan"}[cmd]} onClick={()=>applyTextFormat(block,cmd)}>{label}</button>)}
      </div>
      <div className="draft-word-toolbar-group" aria-label="Jenis, ukuran dan warna huruf">
       <select aria-label="Jenis huruf" defaultValue="" onChange={e=>{if(e.target.value)applyTextFormat(block,"font",e.target.value);e.target.value=""}}><option value="">Jenis font</option>{TYPEFACES.map(font=><option key={font.name} value={font.value}>{font.name}</option>)}</select>
       <select aria-label="Ukuran huruf" defaultValue="" onChange={e=>{if(e.target.value)applyTextFormat(block,"size",e.target.value);e.target.value=""}}><option value="">Ukuran</option>{FONT_SIZES.map(size=><option key={size} value={size}>{size} pt</option>)}</select>
       <select aria-label="Warna teks" defaultValue="" onChange={e=>{if(e.target.value)applyTextFormat(block,"color",e.target.value);e.target.value=""}}><option value="">Warna</option>{TEXT_COLORS.map(color=><option key={color.value} value={color.value}>{color.name}</option>)}</select>
      </div>
      <div className="draft-word-toolbar-group" aria-label="Paragraf dan daftar">
       {([["bullet","• Daftar"],["number","1. Nomor"],["indent","Kutip"],["align-left","Kiri"],["align-center","Tengah"],["align-right","Kanan"]] as const).map(([cmd,label])=><button key={cmd} type="button" onClick={()=>applyTextFormat(block,cmd)}>{label}</button>)}
      </div>
      <div className="draft-word-toolbar-group" aria-label="Sisipkan setelah blok">
       <button type="button" onClick={()=>insertAfter(block.id,"quote","> Kutipan dengan atribusi yang jelas.")}>+ Kutipan</button>
       <button type="button" onClick={()=>insertAfter(block.id,"source",["$$","E = mc^2","$$"].join(String.fromCharCode(10)))}>+ Rumus</button>
       <label className="draft-mini-field">Baris<input aria-label="Jumlah baris tabel" type="number" min={1} max={20} value={tableRows} onChange={e=>setTableRows(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label>
       <label className="draft-mini-field">Kolom<input aria-label="Jumlah kolom tabel" type="number" min={1} max={10} value={tableColumns} onChange={e=>setTableColumns(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label>
       <button type="button" onClick={()=>addTableAfter(block.id,tableRows,tableColumns)}>+ Tabel</button>
       <button type="button" disabled={!assets.length} onClick={()=>{const asset=assets[0];if(asset)insertAfter(block.id,"image",imageMarkdown(asset.altText,asset.id))}}>+ Gambar</button>
      </div>
     </div></details>}
     {opener?<div className="media-settings-fields">
      <p className="form-hint">Nomor dan judul mengikuti bab aktif. Unggah ilustrasi ke pustaka gambar untuk menggunakannya di sini.</p>
      <label className="studio-field"><span>Ilustrasi pembuka</span><select aria-label="Ilustrasi pembuka" value={image.exec(opener.image)?.[2]??""} onChange={e=>{
       const asset=assets.find(item=>item.id===e.target.value);
       update(block.id,chapterOpenerMarkdown(opener.prompt,asset?imageMarkdown(asset.altText,asset.id):""));
      }}><option value="">Tanpa ilustrasi</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      <label className="studio-field"><span>Pertanyaan pemantik</span><textarea aria-label="Pertanyaan pemantik" data-draft-block={block.id} value={opener.prompt} rows={4} onChange={e=>update(block.id,chapterOpenerMarkdown(e.target.value,opener.image))}/></label>
     </div>:sidebar?<div className="media-settings-fields">
      <div className="media-settings-grid">
       <label className="studio-field"><span>Posisi sidebar</span><select aria-label="Posisi sidebar" value={sidebar.position} onChange={e=>update(block.id,sidebarMarkdown(sidebar.type,e.target.value as SidebarPosition,sidebar.body))}><option value="left">Kiri</option><option value="right">Kanan</option></select></label>
       <label className="studio-field"><span>Jenis sidebar</span><select aria-label="Jenis sidebar" value={sidebar.type} onChange={e=>update(block.id,sidebarMarkdown(e.target.value as SidebarType,sidebar.position,sidebar.body))}>{Object.entries(sidebarTypes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <label className="studio-field"><span>Isi sidebar (Markdown)</span><textarea data-draft-block={block.id} value={sidebar.body} rows={5} onChange={e=>update(block.id,sidebarMarkdown(sidebar.type,sidebar.position,e.target.value))}/></label>
      <label className="studio-field"><span>Sisipkan QR atau gambar dari pustaka</span><select aria-label="Sisipkan QR atau gambar dari pustaka" value="" disabled={!assets.length} onChange={e=>{const asset=assets.find(item=>item.id===e.target.value);if(asset)update(block.id,sidebarMarkdown(sidebar.type,sidebar.position,sidebar.body+"\n\n"+imageMarkdown(asset.altText,asset.id)))}}><option value="">Pilih gambar</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      <p className="form-hint">Gunakan Markdown untuk judul, daftar, tautan, dan kutipan. Unggah gambar QR melalui panel gambar sebelum menyisipkannya.</p>
     </div>:block.kind==="image"&&ref?<MediaImageEditor raw={block.raw} bookId={bookId} assets={assets} disabled={busy||Boolean(recovery)} onChange={raw=>update(block.id,raw)} onUploaded={asset=>setAssets(current=>[asset,...current.filter(item=>item.id!==asset.id)])}/>:block.kind==="video"?<MediaVideoEditor raw={block.raw} disabled={busy||Boolean(recovery)} onChange={raw=>update(block.id,raw)}/>:<label className="studio-field"><span>Isi {labels[block.kind].toLowerCase()} {index+1}</span>
      <textarea data-draft-block={block.id} rows={block.kind==="heading"?2:4} value={contentValue(block)} onChange={event=>{
       const value=event.target.value;
       update(block.id,block.kind==="heading"?(block.raw.match(/^#{1,6}/)?.[0]??"##")+" "+value.replace(/\r?\n/g," "):block.kind==="exercise"?exerciseMarkdown(value):value);
      }}/>
     </label>}
     <div className="layout-format-tabs">
      <button type="button" className="secondary-button" aria-label={"Naikkan blok "+(index+1)} disabled={busy||index===0} onClick={()=>move(block.id,blocks[index-1].id)}>Naikkan</button>
      <button type="button" className="secondary-button" aria-label={"Turunkan blok "+(index+1)} disabled={busy||index===blocks.length-1} onClick={()=>{setBodyEdited(true);setBlocks(current=>{const next=current.slice();const i=next.findIndex(b=>b.id===block.id);if(i<0||i>=next.length-1)return current;[next[i],next[i+1]]=[next[i+1],next[i]];return next})}}>Turunkan</button>
      <button type="button" className="secondary-button" aria-label={"Duplikat blok "+(index+1)} disabled={busy} onClick={()=>duplicateBlock(block.id)}>Duplikat</button>
      <button type="button" className="secondary-button" aria-label={"Hapus blok "+(index+1)} disabled={busy} onClick={()=>{if(confirm("Hapus blok ini dari draf?")){setBodyEdited(true);setBlocks(current=>current.filter(item=>item.id!==block.id))}}}>Hapus</button>
     </div>
     </details>
    </li>;
   })}
  </ol>
  </fieldset>
  </div>
  {view!=="editor"&&<aside className="writing-studio-preview" aria-label="Pratinjau langsung buku">
   <div className="writing-preview-toolbar">
    <label><span className="sr-only">Ukuran kertas pratinjau</span><select value={previewPaper} onChange={e=>setPreviewPaper(e.target.value)}>{paperSizes.map(paper=><option key={paper.id} value={paper.id}>{paper.label}</option>)}</select></label>
    <strong>Pratinjau langsung</strong>
    <label><span className="sr-only">Cakupan pratinjau</span><select value={previewScope} onChange={e=>setPreviewScope(e.target.value as "chapter"|"all")}><option value="chapter">Bab ini</option><option value="all">Semua bab</option></select></label>
    <label><span className="sr-only">Terapkan pengaturan ke</span><select value={styleScope} onChange={e=>setStyleScope(e.target.value as "all"|"chapter")}><option value="all">Gaya semua bab</option><option value="chapter">Gaya bab ini</option></select></label>
    <label><span className="sr-only">Huruf pratinjau</span><select value={readerFont} onChange={e=>changeReaderPrefs({font:e.target.value as "serif"|"sans"})}><option value="serif">Serif</option><option value="sans">Sans-serif</option></select></label>
    <label><span className="sr-only">Ukuran teks</span><select value={readerSize} onChange={e=>changeReaderPrefs({size:e.target.value as "small"|"medium"|"large"})}><option value="small">Kecil</option><option value="medium">Sedang</option><option value="large">Besar</option></select></label>
   </div>
   <p className="book-editing-status" role="status">{activeLabel?"Sedang diedit: "+activeLabel:"Pilih blok di editor untuk menandai posisinya di preview."}</p>
   <div ref={inlinePreviewRef} onClick={onPreviewClick} style={{boxSizing:"border-box",width:"min(100%, "+(paperSpec(previewPaper)?.widthMm??210)+"mm)",marginInline:"auto"}} className={"writing-preview-paper font-"+readerFont+" size-"+readerSize} dangerouslySetInnerHTML={{__html:previewHtml}}/>
   <p className="form-hint">Pratinjau langsung adalah simulasi pembacaan. Preferensi baca tersimpan otomatis di browser ini, bukan sebagai tata letak ekspor akhir.</p>
  </aside>}
  </div>
 </div>;
}
