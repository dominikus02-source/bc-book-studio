const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=function(mod,filename){
 const source=fs.readFileSync(filename,"utf8");
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 mod._compile(result.outputText,filename);
};
const {PDFDocument,StandardFonts}=require("pdf-lib");
const {paginatePdf,roman,zone}=require("../lib/pagination-output.ts");
const {DEFAULT_PAGINATION}=require("../lib/book-pagination.ts");

test("Roman numerals and book-matter classification",()=>{
 assert.equal(roman(1),"i");assert.equal(roman(9),"ix");assert.equal(roman(49),"xlix");
 assert.equal(zone("frontCover"),"cover");assert.equal(zone("contentsIntro"),"front");
 assert.equal(zone("chapter-14"),"main");assert.equal(zone("references"),"back");
 assert.equal(zone("backCover"),"backCover");
});

test("PDF footers: cover excluded, front roman, main Arabic, recto chapter",async()=>{
 const parts=[
  {kind:"frontCover",title:"Sampul Depan",content:""}, {kind:"titlePage",title:"Halaman Judul",content:""},
  {kind:"copyrightPage",title:"Hak Cipta",content:""}, {kind:"preface",title:"Kata Pengantar",content:""},
  {kind:"contentsIntro",title:"Daftar Isi",content:""}, {kind:"chapter-1",title:"Gerak Lurus",content:""},
  {kind:"chapter-2",title:"Hukum Newton",content:""}, {kind:"references",title:"Referensi",content:""},
  {kind:"backCover",title:"Sampul Belakang",content:""}
 ];
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(const p of parts){
  const page=doc.addPage([420,600]);page.drawText(p.title,{font,size:18,x:50,y:550});
  page.drawText("Isi uji "+p.title,{font,size:10,x:50,y:400});
 }
 const original=new Uint8Array(await doc.save());
 const result=await paginatePdf(original,parts,DEFAULT_PAGINATION);
 const parsed=await PDFDocument.load(result);
 assert.equal(parsed.getPageCount(),10,"odd-page chapter should insert one unnumbered verso");
 assert.equal(parsed.getPage(6).getWidth(),420);
 assert.ok(parsed.catalog.get(require("pdf-lib").PDFName.of("PageLabels")),"PDF page labels");
 assert.ok(result.length>original.length);
});

test("DOCX semantic sections preserve cover, Roman and decimal Word PAGE fields",async()=>{
 const JSZip=require("jszip");
 const {paginateDocx}=require("../lib/pagination-docx.ts");
 const p=[
  {kind:"frontCover",title:"Sampul Depan",content:""},
  {kind:"titlePage",title:"Halaman Judul",content:""},
  {kind:"preface",title:"Kata Pengantar",content:""},
  {kind:"chapter-1",title:"Gerak Lurus",content:""},
  {kind:"references",title:"Referensi",content:""},
  {kind:"backCover",title:"Sampul Belakang",content:""}
 ];
 const zip=new JSZip();
 const par=(t)=>'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>'+t+'</w:t></w:r></w:p><w:p><w:r><w:t>Isi</w:t></w:r></w:p>';
 const body=p.map(x=>par(x.title)).join("");
 const sect='<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:bottom="1200" w:left="1000" w:right="1000"/></w:sectPr>';
 zip.file("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+sect+'</w:body></w:document>');
 zip.file("word/_rels/document.xml.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
 zip.file("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
 const result=await paginateDocx(new Uint8Array(await zip.generateAsync({type:"nodebuffer"})),p,DEFAULT_PAGINATION,"Fisika");
 const doc=await JSZip.loadAsync(result),xml=await doc.file("word/document.xml").async("string");
 assert.equal((xml.match(/<w:sectPr>/g)||[]).length,p.length);
 assert.match(xml,/w:fmt="lowerRoman"/);
 assert.match(xml,/w:fmt="decimal" w:start="1"/);
 assert.match(xml,/w:type w:val="oddPage"/);
 assert.match(await doc.file("word/footer-bc-odd.xml").async("string"),/w:instr="PAGE"/);
 assert.match(await doc.file("word/_rels/document.xml.rels").async("string"),/rIdBcFolioEven/);
});
