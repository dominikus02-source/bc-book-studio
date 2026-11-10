"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),JSZip=require("jszip");
require.extensions[".ts"]=function(mod,filename){const src=fs.readFileSync(filename,"utf8");mod._compile(ts.transpileModule(src,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename)};
const {paginatePdf}=require("../lib/pagination-output.ts"),{paginateDocx}=require("../lib/pagination-docx.ts");
const {publicationHtml}=require("../lib/publishing-html.ts"),{DEFAULT_PAGINATION}=require("../lib/book-pagination.ts");
const endpoint=process.env.PAGINATION_QA_WORKER_URL||"http://127.0.0.1:34991/render",token="qa-only-contract-v2-20261108-key-00000001";
const chapters=[
 {kind:"frontCover",title:"Sampul Depan",content:"Fisika Terapan SMP\n\nOleh Penguji"},
 {kind:"titlePage",title:"Halaman Judul",content:"Fisika Terapan SMP\n\nEdisi Uji"},
 {kind:"copyrightPage",title:"Halaman Hak Cipta",content:"Hak cipta untuk buku pengujian"},
 {kind:"preface",title:"Kata Pengantar",content:"Kata pengantar menjelaskan cara belajar."},
 {kind:"contentsIntro",title:"Daftar Isi",content:"Bab Pertama\n\nBab Kedua"},
 {kind:"readerGuide",title:"Petunjuk Pembaca",content:"Ikuti penjelasan dalam tiap bab."},
 {kind:"chapter-1",title:"Bab Pertama",content:"Ini adalah bagian utama.\n\n## Materi\n\nUraian materi awal."},
 {kind:"chapter-2",title:"Bab Kedua",content:"Bab kedua membahas konsep dan penerapan."},
 {kind:"references",title:"Daftar Pustaka",content:"Sumber pengujian bebas."},
 {kind:"backCover",title:"Sampul Belakang",content:"Penutup buku uji."}
];
async function render(format){
 const book={id:"qa-book",title:"Fisika Terapan SMP",subject:"Fisika",author:"BC QA",pageSize:"a5",publishingLayout:true,chapters:chapters.map(({title,content})=>({title,content})),assets:[]};
 const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-worker-key":token},body:JSON.stringify({contractVersion:2,format,book})});
 const bytes=Buffer.from(await r.arrayBuffer());if(!r.ok)throw Error("Worker "+format+": "+r.status+" "+bytes.toString().slice(0,120));return new Uint8Array(bytes);
}
(async()=>{
 const target=path.resolve(__dirname,"../artifacts/pagination-qa");fs.mkdirSync(target,{recursive:true});
 const pdf=await paginatePdf(await render("pdf"),chapters,DEFAULT_PAGINATION);
 fs.writeFileSync(path.join(target,"test-book.pdf"),pdf);
 assert.equal(Buffer.from(pdf).subarray(0,4).toString(),"%PDF");
 const docx=await paginateDocx(await render("docx"),chapters,DEFAULT_PAGINATION,"Fisika Terapan SMP");
 fs.writeFileSync(path.join(target,"test-book.docx"),docx);
 const dxml=await (await JSZip.loadAsync(docx)).file("word/document.xml").async("string");
 assert.match(dxml,/w:fmt="lowerRoman"/);
 assert.match(dxml,/w:fmt="decimal"/);
 const epub=await render("epub");
 fs.writeFileSync(path.join(target,"test-book.epub"),epub);
 assert((await JSZip.loadAsync(epub)).file("mimetype"));
 const html=publicationHtml("Fisika Terapan SMP",chapters,true,false,"a5",[],DEFAULT_PAGINATION);
 const flip=publicationHtml("Fisika Terapan SMP",chapters,true,true,"a5",[],DEFAULT_PAGINATION);
 assert(html.includes("data-pagination="));assert(flip.includes('data-reader="flipbook"'));
 fs.writeFileSync(path.join(target,"test-book.html"),html);
 fs.writeFileSync(path.join(target,"test-book-flipbook.html"),flip);
 console.log(JSON.stringify({status:"PASS",pdf:pdf.length,docx:docx.length,epub:epub.length,html:html.length,flipbook:flip.length,directory:target}));
})().catch(e=>{console.error("PAGINATION_INTEGRATION_FAIL",e.stack||e);process.exitCode=1});
