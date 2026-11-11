const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=function(mod,filename){
 const source=fs.readFileSync(filename,"utf8");
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 mod._compile(result.outputText,filename);
};
const JSZip=require("jszip");
const {PDFDocument}=require("pdf-lib");
const {renderPreviewPdf,renderPreviewDocx,renderPreviewEpub}=require("../lib/preview-manuscript.ts");

const book={
 id:"book-preview-1",
 title:"Cerita Pelabuhan",
 author:"Sari Wibowo",
 subject:"Sastra",
 grade:"8",
 language:"en",
 description:"A draft about a harbour season.",
 pageSize:"A5",
 preview:true,
 chapters:[{position:1,title:"Chapter 1",content:"## Opening\n\nBahasa Indonesia — “kutipan” … naïve.\n\n- Satu contoh yang dapat diperiksa.\n"}],
};

test("preview PDF keeps Unicode, author, and language",async()=>{
 const bytes=await renderPreviewPdf(book);
 assert.ok(bytes.byteLength>1000);
 assert.equal(Buffer.from(bytes.subarray(0,5)).toString(),"%PDF-");
 const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getTitle(),"Cerita Pelabuhan");
 assert.equal(pdf.getAuthor(),"Sari Wibowo");
 const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
 const doc=await pdfjs.getDocument({data:new Uint8Array(bytes),disableFontFace:true,verbosity:0}).promise;
 const meta=await doc.getMetadata();
 assert.equal(meta.info.Language,"en");
 let text="";
 for(let i=1;i<=doc.numPages;i++){
  const page=await doc.getPage(i);
  const content=await page.getTextContent();
  text+=content.items.map(item=>"str" in item?item.str:"").join(" ");
  page.cleanup();
 }
 assert.match(text,/Cerita Pelabuhan/);
 assert.match(text,/Sari Wibowo/);
 assert.match(text,/kutipan/);
 assert.match(text,/naïve/);
 assert.doesNotMatch(text,/ISBN:\s*\d/);
});

test("preview DOCX carries core metadata, language, and chapter text",async()=>{
 const bytes=await renderPreviewDocx(book);
 const zip=await JSZip.loadAsync(bytes);
 const document=await zip.file("word/document.xml").async("string");
 const core=await zip.file("docProps/core.xml").async("string");
 const styles=await zip.file("word/styles.xml").async("string");
 const footer=await zip.file("word/footer1.xml").async("string");
 assert.match(document,/Cerita Pelabuhan/);
 assert.match(document,/kutipan/);
 assert.match(footer,/PAGE/);
 assert.match(core,/<dc:creator>Sari Wibowo<\/dc:creator>/);
 assert.match(core,/<dc:language>en-US<\/dc:language>/);
 assert.match(core,/<dc:title>Cerita Pelabuhan<\/dc:title>/);
 assert.match(styles,/w:val="en-US"/);
 assert.ok(zip.file("word/header1.xml"));
 assert.ok(zip.file("word/footer1.xml"));
});

test("preview EPUB is a package with language, creator, nav, and chapter order",async()=>{
 const bytes=await renderPreviewEpub(book);
 const data=Buffer.from(bytes);
 assert.equal(data.subarray(0,2).toString(),"PK");
 const nameLength=data.readUInt16LE(26);
 assert.equal(data.subarray(30,30+nameLength).toString(),"mimetype");
 assert.equal(data.readUInt16LE(8),0);
 const zip=await JSZip.loadAsync(bytes);
 const opf=await zip.file("OEBPS/content.opf").async("string");
 const nav=await zip.file("OEBPS/nav.xhtml").async("string");
 const chapter=await zip.file("OEBPS/chapter-1.xhtml").async("string");
 assert.match(opf,/<dc:language>en<\/dc:language>/);
 assert.match(opf,/<dc:creator>Sari Wibowo<\/dc:creator>/);
 assert.match(opf,/<dc:title>Cerita Pelabuhan<\/dc:title>/);
 assert.match(opf,/dcterms:modified/);
 assert.match(nav,/epub:type="toc"/);
 assert.match(nav,/chapter-1.xhtml/);
 assert.match(chapter,/xml:lang="en"/);
 assert.match(chapter,/kutipan/);
 assert.doesNotMatch(opf,/BC Book Studio/);
});
